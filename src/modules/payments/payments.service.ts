import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest, notFound } from "../../common/utils/errors";
import { num, round2 } from "../../common/utils/money";
import { installmentStatus, splitAmount } from "../finance/finance.service";
import type { CreatePaymentInput, PaymentFilters, UpdatePaymentInput } from "./payments.schema";

export const paymentInclude = {
  student: { select: { id: true, admissionNo: true, name: true, phone: true, subject: { select: { name: true } } } },
  teacher: { select: { id: true, user: { select: { name: true } } } },
  installment: { select: { id: true, dueDate: true, amount: true, paidAmount: true } },
  shares: { include: { partner: { select: { id: true, name: true } } } },
} as const satisfies Prisma.PaymentInclude;

type Loaded = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

export function shapePayment(p: Loaded) {
  const shares = p.shares.map((s) => ({ partnerId: s.partnerId, partnerName: s.partner.name, percent: num(s.percent), amount: num(s.amount) }));
  const partnerShare = round2(shares.reduce((a, s) => a + s.amount, 0));
  return { ...p, shares, partnerShare, companyShare: round2(num(p.amount) - partnerShare) };
}

export async function listPayments(f: PaymentFilters) {
  const where: Prisma.PaymentWhereInput = {
    ...(f.teacherId ? { teacherId: f.teacherId } : {}),
    ...(f.studentId ? { studentId: f.studentId } : {}),
    ...(f.method ? { method: f.method } : {}),
    ...(f.from || f.to
      ? { paidAt: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}) } }
      : {}),
  };
  const payments = await prisma.payment.findMany({ where, include: paymentInclude, orderBy: { paidAt: "desc" } });
  const rows = payments.map(shapePayment);
  return {
    payments: rows,
    summary: {
      count: rows.length,
      total: round2(rows.reduce((s, r) => s + num(r.amount), 0)),
      partnerShare: round2(rows.reduce((s, r) => s + r.partnerShare, 0)),
      companyShare: round2(rows.reduce((s, r) => s + r.companyShare, 0)),
    },
  };
}

/** Record a payment; split is snapshotted from the student's shares; optionally applied to an installment. */
export async function createPayment(input: CreatePaymentInput) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    include: { payments: { select: { amount: true } }, shares: { select: { partnerId: true, percent: true } } },
  });
  if (!student) throw notFound("Student not found");

  const paid = round2(student.payments.reduce((s, p) => s + num(p.amount), 0));
  const remaining = round2(num(student.finalPrice) - paid);
  if (input.amount > remaining) throw badRequest(`Payment exceeds remaining balance. Remaining: ${remaining}`);

  const installment = input.installmentId ? await prisma.installment.findFirst({ where: { id: input.installmentId, studentId: student.id } }) : null;
  if (input.installmentId && !installment) throw badRequest("Installment does not belong to this student");
  const split = splitAmount(input.amount, student.shares);

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        studentId: student.id,
        teacherId: student.teacherId,
        installmentId: installment?.id ?? null,
        amount: input.amount,
        method: input.method,
        note: input.note ?? null,
        paidAt: input.paidAt ?? new Date(),
        shares: { create: split.rows },
      },
      include: paymentInclude,
    });

    let nextInstallment = null;
    if (installment) {
      const newPaid = round2(num(installment.paidAmount) + input.amount);
      const shortfall = round2(num(installment.amount) - newPaid);
      if (shortfall > 0 && input.nextDueDate) {
        // Close this installment at what was actually paid; move the rest to the new date.
        await tx.installment.update({ where: { id: installment.id }, data: { paidAmount: newPaid, amount: newPaid } });
        nextInstallment = await tx.installment.create({
          data: { studentId: student.id, dueDate: input.nextDueDate, amount: shortfall, note: `Remaining from ${installment.dueDate.toISOString().slice(0, 10)}` },
        });
      } else {
        await tx.installment.update({ where: { id: installment.id }, data: { paidAmount: newPaid } });
      }
    }

    return {
      payment: shapePayment(payment),
      paid: round2(paid + input.amount),
      remaining: round2(remaining - input.amount),
      nextInstallment: nextInstallment ? { ...nextInstallment, ...installmentStatus(nextInstallment) } : null,
    };
  });
}

export async function updatePayment(id: string, input: UpdatePaymentInput) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { shares: true, student: { include: { payments: { select: { id: true, amount: true } } } } },
  });
  if (!payment) throw notFound("Payment not found");

  const oldAmount = num(payment.amount);
  const newAmount = input.amount ?? oldAmount;
  if (input.amount !== undefined) {
    const otherPaid = payment.student.payments.filter((p) => p.id !== id).reduce((s, p) => s + num(p.amount), 0);
    const maxAllowed = round2(num(payment.student.finalPrice) - otherPaid);
    if (newAmount > maxAllowed) throw badRequest(`Payment exceeds remaining balance. Maximum allowed: ${maxAllowed}`);
  }

  return prisma.$transaction(async (tx) => {
    if (newAmount !== oldAmount) {
      const split = splitAmount(newAmount, payment.shares); // same percentages as originally used
      await tx.paymentShare.deleteMany({ where: { paymentId: id } });
      await tx.paymentShare.createMany({ data: split.rows.map((r) => ({ ...r, paymentId: id })) });
      if (payment.installmentId) {
        await tx.installment.update({ where: { id: payment.installmentId }, data: { paidAmount: { increment: round2(newAmount - oldAmount) } } });
      }
    }
    const updated = await tx.payment.update({
      where: { id },
      data: {
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.method !== undefined ? { method: input.method } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
      },
      include: paymentInclude,
    });
    return shapePayment(updated);
  });
}

export async function deletePayment(id: string) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) throw notFound("Payment not found");
  await prisma.$transaction(async (tx) => {
    if (payment.installmentId) {
      const inst = await tx.installment.findUnique({ where: { id: payment.installmentId } });
      if (inst) await tx.installment.update({ where: { id: inst.id }, data: { paidAmount: Math.max(0, round2(num(inst.paidAmount) - num(payment.amount))) } });
    }
    await tx.payment.delete({ where: { id } });
  });
}
