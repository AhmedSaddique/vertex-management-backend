import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

async function upsertSubject(name: string, description: string) {
  return prisma.subject.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });
}

async function upsertTeacher(opts: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  percent: number;
  subjectIds: string[];
}) {
  const email = opts.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, include: { teacher: true } });
  if (existing?.teacher) {
    await prisma.teacher.update({
      where: { id: existing.teacher.id },
      data: { subjects: { set: opts.subjectIds.map((id) => ({ id })) } },
    });
    return existing.teacher;
  }
  const user = await prisma.user.create({
    data: {
      name: opts.name,
      email,
      password: await bcrypt.hash(opts.password, 10),
      role: "TEACHER",
      teacher: {
        create: {
          phone: opts.phone,
          defaultCommissionPercent: opts.percent,
          subjects: { connect: opts.subjectIds.map((id) => ({ id })) },
        },
      },
    },
    include: { teacher: true },
  });
  return user.teacher!;
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@vertex.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD ?? "teacher123";

  // Subjects (courses)
  const binary = await upsertSubject("Binary", "Binary options trading course");
  const forex = await upsertSubject("Forex", "Forex trading course");
  const crypto = await upsertSubject("Crypto", "Crypto trading course");

  // Admin
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: process.env.SEED_ADMIN_NAME ?? "Admin",
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });

  // Teachers
  const uzair = await upsertTeacher({
    name: "Uzair",
    email: "uzair@vertex.com",
    password: teacherPassword,
    percent: 30,
    subjectIds: [binary.id],
  });
  const hamza = await upsertTeacher({
    name: "Hamza",
    email: "hamza@vertex.com",
    password: teacherPassword,
    percent: 30,
    subjectIds: [forex.id, crypto.id],
  });

  console.log("Seeded subjects: Binary, Forex, Crypto");
  console.log(`Admin login:   ${adminEmail} / ${adminPassword}`);
  console.log(`Teacher login: uzair@vertex.com / ${teacherPassword}`);
  console.log(`Teacher login: hamza@vertex.com / ${teacherPassword}`);

  if (process.env.SEED_DEMO_DATA === "true") {
    const count = await prisma.student.count();
    if (count > 0) {
      console.log("Demo data skipped: students already exist.");
    } else {
      await seedDemo({ binary, forex, crypto }, { uzair, hamza });
    }
  }
}

async function seedDemo(
  s: { binary: { id: string }; forex: { id: string }; crypto: { id: string } },
  t: { uzair: { id: string }; hamza: { id: string } },
) {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
  const demo = [
    { name: "Ali Raza", fatherName: "Raza Khan", phone: "03001234567", subjectId: s.forex.id, teacherId: t.hamza.id, fee: 100000, discount: 0, pays: [[50000, 40], [30000, 10]] },
    { name: "Bilal Ahmed", fatherName: "Ahmed Ali", phone: "03111234567", subjectId: s.crypto.id, teacherId: t.hamza.id, fee: 80000, discount: 10000, pays: [[70000, 20]] },
    { name: "Sara Khan", fatherName: "Imran Khan", phone: "03211234567", subjectId: s.binary.id, teacherId: t.uzair.id, fee: 30000, discount: 0, pays: [[30000, 25]] },
    { name: "Usman Tariq", fatherName: "Tariq Mehmood", phone: "03331234567", subjectId: s.binary.id, teacherId: t.uzair.id, fee: 35000, discount: 5000, pays: [[15000, 5]] },
  ] as const;

  for (const d of demo) {
    const student = await prisma.student.create({
      data: {
        name: d.name,
        fatherName: d.fatherName,
        phone: d.phone,
        email: `${d.name.split(" ")[0].toLowerCase()}@example.com`,
        address: "Lahore, Pakistan",
        subjectId: d.subjectId,
        teacherId: d.teacherId,
        fee: d.fee,
        discount: d.discount,
        finalPrice: d.fee - d.discount,
        commissionPercent: 30,
        enrolledAt: daysAgo(45),
      },
    });
    for (const [amount, ago] of d.pays) {
      await prisma.payment.create({
        data: {
          studentId: student.id,
          teacherId: d.teacherId,
          commissionPercent: 30,
          amount,
          method: "CASH",
          paidAt: daysAgo(ago),
        },
      });
    }
  }
  await prisma.payout.create({
    data: { teacherId: t.hamza.id, amount: 20000, note: "Advance salary", paidAt: daysAgo(3) },
  });
  console.log("Demo students, payments and a payout inserted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
