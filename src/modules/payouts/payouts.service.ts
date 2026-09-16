import { prisma } from "../../database/prisma";
import { notFound } from "../../common/utils/errors";
import { partnerTotals } from "../finance/finance.service";
import type { CreatePayoutInput, UpdatePayoutInput } from "./payouts.schema";

export const payoutInclude = {
  partner: { select: { id: true, name: true, kind: true } },
} as const;

export function listPayouts(partnerId?: string) {
  return prisma.payout.findMany({
    where: partnerId ? { partnerId } : undefined,
    include: payoutInclude,
    orderBy: { paidAt: "desc" },
  });
}

/** Money handed to a partner; it reduces their payable balance. */
export async function createPayout(input: CreatePayoutInput) {
  const partner = await prisma.partner.findUnique({ where: { id: input.partnerId } });
  if (!partner) throw notFound("Partner not found");
  const payout = await prisma.payout.create({
    data: { partnerId: input.partnerId, amount: input.amount, note: input.note ?? null, paidAt: input.paidAt ?? new Date() },
    include: payoutInclude,
  });
  return { payout, totals: await partnerTotals(input.partnerId) };
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
  return { payout, totals: await partnerTotals(payout.partnerId) };
}

export async function deletePayout(id: string) {
  const payout = await prisma.payout.delete({ where: { id } });
  return { ok: true, totals: await partnerTotals(payout.partnerId) };
}
