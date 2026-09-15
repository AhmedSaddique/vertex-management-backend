import { prisma } from "../../database/prisma";
import { notFound } from "../../common/utils/errors";
import { teacherTotals } from "../finance/finance.service";
import type { CreatePayoutInput, UpdatePayoutInput } from "./payouts.schema";

export const payoutInclude = {
  teacher: { select: { id: true, user: { select: { name: true } } } },
} as const;

export function listPayouts(teacherId?: string) {
  return prisma.payout.findMany({
    where: teacherId ? { teacherId } : undefined,
    include: payoutInclude,
    orderBy: { paidAt: "desc" },
  });
}

/** Money handed to a teacher; it reduces their payable balance. */
export async function createPayout(input: CreatePayoutInput) {
  const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
  if (!teacher) throw notFound("Teacher not found");

  const payout = await prisma.payout.create({
    data: {
      teacherId: input.teacherId,
      amount: input.amount,
      note: input.note ?? null,
      paidAt: input.paidAt ?? new Date(),
    },
    include: payoutInclude,
  });
  return { payout, totals: await teacherTotals(input.teacherId) };
}

export async function updatePayout(id: string, input: UpdatePayoutInput) {
  const payout = await prisma.payout.update({
    where: { id },
    data: {
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
    },
    include: payoutInclude,
  });
  return { payout, totals: await teacherTotals(payout.teacherId) };
}

export async function deletePayout(id: string) {
  const payout = await prisma.payout.delete({ where: { id } });
  return { ok: true, totals: await teacherTotals(payout.teacherId) };
}
