import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

async function upsertSubject(name: string, description: string) {
  return prisma.subject.upsert({ where: { name }, update: { description }, create: { name, description } });
}

async function upsertTeacher(opts: { name: string; email: string; password: string; subjectIds: string[] }) {
  const email = opts.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email }, include: { teacher: true } });
  if (!user?.teacher) {
    user = await prisma.user.create({
      data: {
        name: opts.name,
        email,
        password: await bcrypt.hash(opts.password, 10),
        role: "TEACHER",
        teacher: { create: { subjects: { connect: opts.subjectIds.map((id) => ({ id })) } } },
      },
      include: { teacher: true },
    });
  } else {
    await prisma.teacher.update({ where: { id: user.teacher.id }, data: { subjects: { set: opts.subjectIds.map((id) => ({ id })) } } });
  }
  const teacher = user.teacher!;
  // Partner account for the teacher (receives a share of student fees)
  return prisma.partner.upsert({
    where: { teacherId: teacher.id },
    update: { name: user.name },
    create: { name: user.name, kind: "TEACHER", teacherId: teacher.id, userId: user.id },
  });
}

async function setDefaults(subjectId: string, shares: { partnerId: string; percent: number }[]) {
  const existing = await prisma.subjectShareDefault.count({ where: { subjectId } });
  if (existing > 0) return false;
  await prisma.subjectShareDefault.createMany({ data: shares.map((s) => ({ subjectId, ...s })) });
  return true;
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@vertex.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD ?? "teacher123";

  const binary = await upsertSubject("Binary", "Binary options trading course");
  const forex = await upsertSubject("Forex", "Forex trading course");
  const crypto = await upsertSubject("Crypto", "Crypto trading course");

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: process.env.SEED_ADMIN_NAME ?? "Ahmad", email: adminEmail, password: await bcrypt.hash(adminPassword, 10), role: "ADMIN" },
  });
  // Management partner for the admin (receives the management share)
  const management = await prisma.partner.upsert({
    where: { userId: admin.id },
    update: { name: admin.name },
    create: { name: admin.name, kind: "MANAGEMENT", userId: admin.id },
  });

  const uzair = await upsertTeacher({ name: "Uzair", email: "uzair@vertex.com", password: teacherPassword, subjectIds: [binary.id] });
  const hamza = await upsertTeacher({ name: "Hamza", email: "hamza@vertex.com", password: teacherPassword, subjectIds: [forex.id, crypto.id] });

  // Default fee splits (company keeps the remainder):
  //   Forex / Crypto: Hamza 30, Uzair 30, Management 20  -> company 20
  //   Binary:         Uzair 50, Management 20            -> company 30
  const forexSplit = [
    { partnerId: hamza.id, percent: 30 },
    { partnerId: uzair.id, percent: 30 },
    { partnerId: management.id, percent: 20 },
  ];
  const binarySplit = [
    { partnerId: uzair.id, percent: 50 },
    { partnerId: management.id, percent: 20 },
  ];
  const created = [await setDefaults(forex.id, forexSplit), await setDefaults(crypto.id, forexSplit), await setDefaults(binary.id, binarySplit)];

  // Students that still carry the old single-teacher share get the new subject defaults.
  if (created.some(Boolean)) {
    const students = await prisma.student.findMany({ include: { shares: true, subject: { include: { shareDefaults: true } } } });
    let updated = 0;
    for (const s of students) {
      const legacy = s.shares.length <= 1 && s.shares.every((sh) => sh.partnerId === s.teacherId);
      if (!legacy || s.subject.shareDefaults.length === 0) continue;
      await prisma.student.update({
        where: { id: s.id },
        data: { shares: { deleteMany: {}, create: s.subject.shareDefaults.map((d) => ({ partnerId: d.partnerId, percent: d.percent })) } },
      });
      updated++;
    }
    console.log(`Applied subject default shares to ${updated} existing student(s).`);
  }

  console.log("Seeded subjects: Binary, Forex, Crypto");
  console.log(`Partners: ${hamza.name} (teacher), ${uzair.name} (teacher), ${management.name} (management)`);
  console.log(`Admin login:   ${adminEmail} / ${adminPassword}`);
  console.log(`Teacher login: uzair@vertex.com / ${teacherPassword}`);
  console.log(`Teacher login: hamza@vertex.com / ${teacherPassword}`);

  if (process.env.SEED_DEMO_DATA === "true") {
    const count = await prisma.student.count();
    if (count > 0) console.log("Demo data skipped: students already exist.");
    else await seedDemo({ binary, forex }, { uzair, hamza });
  }
}

async function seedDemo(s: { binary: { id: string }; forex: { id: string } }, p: { uzair: { id: string }; hamza: { id: string } }) {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
  const teachers = await prisma.teacher.findMany({ include: { partner: true } });
  const teacherOf = (partnerId: string) => teachers.find((t) => t.partner?.id === partnerId)!.id;
  const demo = [
    { name: "Ali Raza", phone: "03001234567", subjectId: s.forex.id, partnerId: p.hamza.id, fee: 100000, pay: 50000 },
    { name: "Sara Khan", phone: "03211234567", subjectId: s.binary.id, partnerId: p.uzair.id, fee: 30000, pay: 30000 },
  ];
  for (const d of demo) {
    const defaults = await prisma.subjectShareDefault.findMany({ where: { subjectId: d.subjectId } });
    const student = await prisma.student.create({
      data: {
        name: d.name, phone: d.phone, subjectId: d.subjectId, teacherId: teacherOf(d.partnerId), fee: d.fee, discount: 0, finalPrice: d.fee,
        enrolledAt: daysAgo(20), shares: { create: defaults.map((x) => ({ partnerId: x.partnerId, percent: x.percent })) },
        installments: { create: [{ dueDate: daysAgo(10), amount: d.pay }, { dueDate: new Date(Date.now() + 5 * 86400000), amount: d.fee - d.pay }] },
      },
    });
    await prisma.payment.create({
      data: {
        studentId: student.id, teacherId: student.teacherId, amount: d.pay, method: "CASH", paidAt: daysAgo(10),
        shares: { create: defaults.map((x) => ({ partnerId: x.partnerId, percent: x.percent, amount: Math.round(((d.pay * Number(x.percent)) / 100) * 100) / 100 })) },
      },
    });
  }
  console.log("Demo students, payments and installments inserted.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
