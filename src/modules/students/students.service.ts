import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest, notFound } from "../../common/utils/errors";
import { num, round2, share } from "../../common/utils/money";
import { studentMoney } from "../finance/finance.service";
import type { StudentFilters, StudentInput, UpdateStudentInput } from "./students.schema";

export const studentInclude = {
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { name: true } } } },
  payments: { select: { amount: true, commissionPercent: true } },
} as const;

export async function listStudents(f: StudentFilters) {
  const where: Prisma.StudentWhereInput = {
    ...(f.teacherId ? { teacherId: f.teacherId } : {}),
    ...(f.subjectId ? { subjectId: f.subjectId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.search
      ? {
          OR: [
            { name: { contains: f.search, mode: "insensitive" } },
            { fatherName: { contains: f.search, mode: "insensitive" } },
            { phone: { contains: f.search } },
            { email: { contains: f.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const students = await prisma.student.findMany({
    where,
    include: studentInclude,
    orderBy: { createdAt: "desc" },
  });

  const rows = students.map(({ payments, ...s }) => ({ ...s, ...studentMoney(s, payments) }));
  const summary = {
    count: rows.length,
    totalFinalPrice: round2(rows.reduce((a, r) => a + r.finalPrice, 0)),
    totalPaid: round2(rows.reduce((a, r) => a + r.paid, 0)),
    totalRemaining: round2(rows.reduce((a, r) => a + r.remaining, 0)),
  };
  return { students: rows, summary };
}

/** Student detail with every payment and its teacher/company split. */
export async function getStudent(id: string, scopeTeacherId?: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: {
        select: { id: true, defaultCommissionPercent: true, user: { select: { name: true } } },
      },
      payments: {
        include: { teacher: { select: { id: true, user: { select: { name: true } } } } },
        orderBy: { paidAt: "desc" },
      },
      classSlots: {
        select: {
          id: true, title: true, days: true, startTime: true, endTime: true, location: true, isActive: true,
          teacher: { select: { user: { select: { name: true } } } },
          subject: { select: { name: true } },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });
  if (!student || (scopeTeacherId && student.teacherId !== scopeTeacherId)) {
    throw notFound("Student not found");
  }

  const payments = student.payments.map((p) => {
    const teacherShare = share(p.amount, p.commissionPercent);
    return { ...p, teacherShare, companyShare: round2(num(p.amount) - teacherShare) };
  });
  return { ...student, payments, ...studentMoney(student, student.payments) };
}

export async function createStudent(input: StudentInput) {
  if (input.discount > input.fee) throw badRequest("Discount cannot be greater than the fee");

  const [teacher, subject] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: input.teacherId } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
  ]);
  if (!teacher) throw badRequest("Selected teacher does not exist");
  if (!subject) throw badRequest("Selected subject does not exist");

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
      finalPrice: round2(input.fee - input.discount),
      // Per-student share defaults to the teacher default; admin may override.
      commissionPercent: input.commissionPercent ?? num(teacher.defaultCommissionPercent),
      status: input.status,
      enrolledAt: input.enrolledAt ?? new Date(),
      notes: input.notes || null,
      availableSlots: input.availableSlots ?? [],
    },
    include: studentInclude,
  });
  const { payments, ...rest } = student;
  return { ...rest, ...studentMoney(student, payments) };
}

export async function updateStudent(id: string, input: UpdateStudentInput) {
  const existing = await prisma.student.findUnique({
    where: { id },
    include: { payments: { select: { amount: true } } },
  });
  if (!existing) throw notFound("Student not found");

  const fee = input.fee ?? num(existing.fee);
  const discount = input.discount ?? num(existing.discount);
  if (discount > fee) throw badRequest("Discount cannot be greater than the fee");
  const finalPrice = round2(fee - discount);
  const paid = round2(existing.payments.reduce((s, p) => s + num(p.amount), 0));
  if (finalPrice < paid) {
    throw badRequest(`Final price (${finalPrice}) cannot be less than the amount already paid (${paid})`);
  }

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
      ...(input.commissionPercent != null ? { commissionPercent: input.commissionPercent } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.enrolledAt !== undefined ? { enrolledAt: input.enrolledAt } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.availableSlots !== undefined ? { availableSlots: input.availableSlots } : {}),
      fee,
      discount,
      finalPrice,
    },
    include: studentInclude,
  });
  const { payments, ...rest } = student;
  return { ...rest, ...studentMoney(student, payments) };
}

export async function deleteStudent(id: string) {
  // Payments cascade-delete with the student (see schema.prisma).
  await prisma.student.delete({ where: { id } });
}
