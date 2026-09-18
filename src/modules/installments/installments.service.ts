import { prisma } from "../../database/prisma";
import { badRequest, notFound } from "../../common/utils/errors";
import { num, round2 } from "../../common/utils/money";
import { installmentStatus } from "../finance/finance.service";
import type { CreateInstallmentInput, UpdateInstallmentInput } from "./installments.schema";

const studentSelect = {
  id: true, admissionNo: true, name: true, phone: true, fatherPhone: true, teacherId: true, status: true,
  subject: { select: { name: true } },
  teacher: { select: { user: { select: { name: true } } } },
} as const;

/**
 * Fee due list for the dashboard: unpaid installments that are overdue, due today,
 * or due within the next `days` days. Teachers only see their own students.
 */
export async function listDue(days = 7, teacherId?: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(startOfToday);
  horizon.setDate(horizon.getDate() + days + 1);

  const rows = await prisma.installment.findMany({
    where: {
      dueDate: { lt: horizon },
      student: { status: "ACTIVE", ...(teacherId ? { teacherId } : {}) },
    },
    include: { student: { select: studentSelect } },
    orderBy: { dueDate: "asc" },
  });

  const items = rows
    .map((i) => ({ ...i, ...installmentStatus(i, now) }))
    .filter((i) => i.status !== "PAID");
  const isToday = (d: Date) => d >= startOfToday && d < new Date(startOfToday.getTime() + 86400000);

  return {
    items,
    summary: {
      overdue: items.filter((i) => i.status === "OVERDUE").length,
      dueToday: items.filter((i) => isToday(i.dueDate)).length,
      upcoming: items.filter((i) => i.status !== "OVERDUE" && !isToday(i.dueDate)).length,
      totalDue: round2(items.reduce((s, i) => s + i.remaining, 0)),
    },
  };
}

export async function listForStudent(studentId: string) {
  const rows = await prisma.installment.findMany({ where: { studentId }, orderBy: { dueDate: "asc" } });
  return rows.map((i) => ({ ...i, ...installmentStatus(i) }));
}

async function assertPlanFits(studentId: string, extra: number, excludeId?: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { installments: { select: { id: true, amount: true } } },
  });
  if (!student) throw notFound("Student not found");
  const planned = student.installments.filter((i) => i.id !== excludeId).reduce((s, i) => s + num(i.amount), 0);
  const total = round2(planned + extra);
  if (total > num(student.finalPrice)) {
    throw badRequest(`Installments would add up to ${total}, more than the final price ${num(student.finalPrice)}`);
  }
}

export async function createInstallment(input: CreateInstallmentInput) {
  await assertPlanFits(input.studentId, input.amount);
  const row = await prisma.installment.create({
    data: { studentId: input.studentId, dueDate: input.dueDate, amount: input.amount, note: input.note || null },
  });
  return { ...row, ...installmentStatus(row) };
}

export async function updateInstallment(id: string, input: UpdateInstallmentInput) {
  const existing = await prisma.installment.findUnique({ where: { id } });
  if (!existing) throw notFound("Installment not found");
  if (input.amount !== undefined) {
    if (input.amount < num(existing.paidAmount)) throw badRequest(`Amount cannot be less than the ${num(existing.paidAmount)} already paid on it`);
    await assertPlanFits(existing.studentId, input.amount, id);
  }
  const row = await prisma.installment.update({
    where: { id },
    data: {
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.note !== undefined ? { note: input.note || null } : {}),
    },
  });
  return { ...row, ...installmentStatus(row) };
}

export async function deleteInstallment(id: string) {
  const existing = await prisma.installment.findUnique({ where: { id } });
  if (!existing) throw notFound("Installment not found");
  if (num(existing.paidAmount) > 0) throw badRequest("A payment has already been applied to this installment. Delete the payment first.");
  await prisma.installment.delete({ where: { id } });
}
