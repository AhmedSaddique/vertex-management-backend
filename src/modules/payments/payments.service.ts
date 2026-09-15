import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest, notFound } from "../../common/utils/errors";
import { num, round2, share } from "../../common/utils/money";
import type { CreatePaymentInput, PaymentFilters, UpdatePaymentInput } from "./payments.schema";

export const paymentInclude = {
  student: { select: { id: true, name: true, phone: true, subject: { select: { name: true } } } },
  teacher: { select: { id: true, user: { select: { name: true } } } },
} as const;

function withSplit<T extends { amount: Prisma.Decimal; commissionPercent: Prisma.Decimal }>(p: T) {
  const teacherShare = share(p.amount, p.commissionPercent);
  return { ...p, teacherShare, companyShare: round2(num(p.amount) - teacherShare) };
}

export async function listPayments(f: PaymentFilters) {
  const where: Prisma.PaymentWhereInput = {
    ...(f.teacherId ? { teacherId: f.teacherId } : {}),
    ...(f.studentId ? { studentId: f.studentId } : {}),
    ...(f.method ? { method: f.method } : {}),
    ...(f.from || f.to
      ? {
          paidAt: {
            ...(f.from ? { gte: new Date(f.from) } : {}),
            ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const payments = await prisma.payment.findMany({
    where,
    include: paymentInclude,
    orderBy: { paidAt: "desc" },
  });

  const rows = payments.map(withSplit);
  const summary = {
    count: rows.length,
    total: round2(rows.reduce((s, r) => s + num(r.amount), 0)),
    teacherShare: round2(rows.reduce((s, r) => s + r.teacherShare, 0)),
    companyShare: round2(rows.reduce((s, r) => s + r.companyShare, 0)),
  };
  return { payments: rows, summary };
}

/**
 * Record a fee payment. The teacher and share % are copied from the student at this
 * moment so later changes never rewrite history.
 */
export async function createPayment(input: CreatePaymentInput) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { payments: { select: { amount: true } } },
  });
  if (!student) throw notFound("Student not found");

  const paid = round2(student.payments.reduce((s, p) => s + num(p.amount), 0));
  const remaining = round2(num(student.finalPrice) - paid);
  if (input.amount > remaining) {
    throw badRequest(`Payment exceeds remaining balance. Remaining: ${remaining}`);
  }

  const payment = await prisma.payment.create({
    data: {
      studentId: student.id,
      teacherId: student.teacherId,
      commissionPercent: student.commissionPercent,
      amount: input.amount,
      method: input.method,
      note: input.note ?? null,
      paidAt: input.paidAt ?? new Date(),
    },
    include: paymentInclude,
  });

  return {
    payment: withSplit(payment),
    paid: round2(paid + input.amount),
    remaining: round2(remaining - input.amount),
  };
}

export async function updatePayment(id: string, input: UpdatePaymentInput) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { student: { include: { payments: { select: { id: true, amount: true } } } } },
  });
  if (!payment) throw notFound("Payment not found");

  if (input.amount !== undefined) {
    const otherPaid = payment.student.payments
      .filter((p) => p.id !== payment.id)
      .reduce((s, p) => s + num(p.amount), 0);
    const remaining = round2(num(payment.student.finalPrice) - otherPaid);
    if (input.amount > remaining) {
      throw badRequest(`Payment exceeds remaining balance. Maximum allowed: ${remaining}`);
    }
  }

  const updated = await prisma.payment.update({
    where: { id },
    data: {
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.method !== undefined ? { method: input.method } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
      ...(input.commissionPercent !== undefined ? { commissionPercent: input.commissionPercent } : {}),
    },
    include: paymentInclude,
  });
  return withSplit(updated);
}

export async function deletePayment(id: string) {
  await prisma.payment.delete({ where: { id } });
}
