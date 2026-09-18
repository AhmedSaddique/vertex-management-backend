import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest, notFound } from "../../common/utils/errors";
import { num, round2 } from "../../common/utils/money";
import { assertSharesValid, installmentStatus, studentMoney, type ShareInput } from "../finance/finance.service";
import type { StudentFilters, StudentInput, UpdateStudentInput } from "./students.schema";

export { getStudent, previewSplit } from "./students.detail";

export const studentInclude = {
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { name: true } } } },
  payments: { select: { amount: true } },
  shares: { include: { partner: { select: { id: true, name: true, kind: true } } }, orderBy: { percent: "desc" } },
  installments: { select: { id: true, dueDate: true, amount: true, paidAmount: true } },
} as const satisfies Prisma.StudentInclude;

type Loaded = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

export function shapeStudent(s: Loaded) {
  const { payments, shares, installments, ...rest } = s;
  const open = installments
    .map((i) => ({ ...i, ...installmentStatus(i) }))
    .filter((i) => i.status !== "PAID")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return {
    ...rest,
    shares: shares.map((sh) => ({ partnerId: sh.partnerId, partner: sh.partner, percent: num(sh.percent) })),
    ...studentMoney(s, payments, shares),
    nextDue: open[0] ? { id: open[0].id, dueDate: open[0].dueDate, remaining: open[0].remaining, status: open[0].status } : null,
    overdueCount: open.filter((i) => i.status === "OVERDUE").length,
  };
}

export async function listStudents(f: StudentFilters) {
  const search = f.search?.trim();
  // A numeric search also matches the admission number, e.g. "1002".
  const admissionNo =
    search && search !== "" && Number.isInteger(Number(search)) ? Number(search) : undefined;

  const where: Prisma.StudentWhereInput = {
    ...(f.teacherId ? { teacherId: f.teacherId } : {}),
    ...(f.subjectId ? { subjectId: f.subjectId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.classMode ? { classMode: f.classMode } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { fatherName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
            ...(admissionNo !== undefined ? [{ admissionNo }] : []),
          ],
        }
      : {}),
  };
  const students = await prisma.student.findMany({ where, include: studentInclude, orderBy: { createdAt: "desc" } });
  const rows = students.map(shapeStudent);
  const summary = {
    count: rows.length,
    totalFinalPrice: round2(rows.reduce((a, r) => a + r.finalPrice, 0)),
    totalPaid: round2(rows.reduce((a, r) => a + r.paid, 0)),
    totalRemaining: round2(rows.reduce((a, r) => a + r.remaining, 0)),
  };
  return { students: rows, summary };
}

/** Shares from the request, or the subject defaults when omitted. Company keeps the rest. */
async function resolveShares(subjectId: string, requested?: ShareInput[]): Promise<ShareInput[]> {
  let shares = requested;
  if (!shares) {
    const defaults = await prisma.subjectShareDefault.findMany({ where: { subjectId } });
    shares = defaults.map((d) => ({ partnerId: d.partnerId, percent: num(d.percent) }));
  }
  shares = shares.filter((sh) => sh.percent > 0);
  assertSharesValid(shares);
  if (shares.length) {
    const found = await prisma.partner.count({ where: { id: { in: shares.map((sh) => sh.partnerId) } } });
    if (found !== shares.length) throw badRequest("One of the selected partners does not exist");
  }
  return shares;
}

export async function createStudent(input: StudentInput) {
  if (input.discount > input.fee) throw badRequest("Discount cannot be greater than the fee");
  const [teacher, subject] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: input.teacherId } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
  ]);
  if (!teacher) throw badRequest("Selected teacher does not exist");
  if (!subject) throw badRequest("Selected subject does not exist");

  const finalPrice = round2(input.fee - input.discount);
  const shares = await resolveShares(input.subjectId, input.shares);
  const installments = input.installments ?? [];
  const planned = round2(installments.reduce((a, i) => a + i.amount, 0));
  if (planned > finalPrice) throw badRequest(`Installments add up to ${planned}, more than the final price ${finalPrice}`);

  const student = await prisma.student.create({
    data: {
      name: input.name,
      fatherName: input.fatherName || null,
      phone: input.phone,
      fatherPhone: input.fatherPhone || null,
      email: input.email ? input.email.toLowerCase() : null,
      address: input.address || null,
      subjectId: input.subjectId,
      teacherId: input.teacherId,
      fee: input.fee,
      discount: input.discount,
      finalPrice,
      status: input.status,
      classMode: input.classMode,
      enrolledAt: input.enrolledAt ?? new Date(),
      notes: input.notes || null,
      availableSlots: input.availableSlots ?? [],
      shares: { create: shares.map((sh) => ({ partnerId: sh.partnerId, percent: sh.percent })) },
      installments: { create: installments.map((i) => ({ dueDate: i.dueDate, amount: i.amount, note: i.note || null })) },
    },
    include: studentInclude,
  });
  return shapeStudent(student);
}

export async function updateStudent(id: string, input: UpdateStudentInput) {
  const existing = await prisma.student.findUnique({ where: { id }, include: { payments: { select: { amount: true } } } });
  if (!existing) throw notFound("Student not found");

  const fee = input.fee ?? num(existing.fee);
  const discount = input.discount ?? num(existing.discount);
  if (discount > fee) throw badRequest("Discount cannot be greater than the fee");
  const finalPrice = round2(fee - discount);
  const paid = round2(existing.payments.reduce((s, p) => s + num(p.amount), 0));
  if (finalPrice < paid) throw badRequest(`Final price (${finalPrice}) cannot be less than the amount already paid (${paid})`);

  const shares = input.shares ? await resolveShares(input.subjectId ?? existing.subjectId, input.shares) : undefined;

  const student = await prisma.student.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.fatherName !== undefined ? { fatherName: input.fatherName || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.fatherPhone !== undefined ? { fatherPhone: input.fatherPhone || null } : {}),
      ...(input.email !== undefined ? { email: input.email ? input.email.toLowerCase() : null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
      ...(input.teacherId !== undefined ? { teacherId: input.teacherId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.classMode !== undefined ? { classMode: input.classMode } : {}),
      ...(input.enrolledAt !== undefined ? { enrolledAt: input.enrolledAt } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.availableSlots !== undefined ? { availableSlots: input.availableSlots } : {}),
      ...(shares ? { shares: { deleteMany: {}, create: shares.map((sh) => ({ partnerId: sh.partnerId, percent: sh.percent })) } } : {}),
      fee,
      discount,
      finalPrice,
    },
    include: studentInclude,
  });
  return shapeStudent(student);
}

export async function deleteStudent(id: string) {
  await prisma.student.delete({ where: { id } });
}
