import { prisma } from "../../database/prisma";
import { badRequest } from "../../common/utils/errors";
import { num, round2 } from "../../common/utils/money";

export * from "./company.service";

/**
 * Money rules:
 *  - finalPrice = fee - discount; remaining = finalPrice - payments.
 *  - Every student has share rows (partner + percent). Company keeps 100 - sum(percent).
 *  - Every payment is split at that moment into PaymentShare rows (snapshot).
 *  - Partner earned = sum of their PaymentShare amounts; balance = earned - payouts.
 */

export interface ShareInput {
  partnerId: string;
  percent: number;
}

export function assertSharesValid(shares: ShareInput[]) {
  const ids = new Set<string>();
  let total = 0;
  for (const s of shares) {
    if (ids.has(s.partnerId)) throw badRequest("The same partner is listed twice in the share split");
    ids.add(s.partnerId);
    if (s.percent < 0 || s.percent > 100) throw badRequest("Each share must be between 0 and 100 percent");
    total += s.percent;
  }
  if (round2(total) > 100) throw badRequest(`Partner shares add up to ${round2(total)}%. They cannot exceed 100%.`);
}

/** Split an amount between partners; whatever is left is the company share. */
export function splitAmount(amount: number, shares: { partnerId: string; percent: unknown }[]) {
  const rows = shares.map((s) => {
    const percent = num(s.percent as never);
    return { partnerId: s.partnerId, percent, amount: round2((amount * percent) / 100) };
  });
  const partnerTotal = round2(rows.reduce((a, r) => a + r.amount, 0));
  return { rows, partnerTotal, companyAmount: round2(amount - partnerTotal) };
}

export interface StudentMoney {
  finalPrice: number;
  paid: number;
  remaining: number;
  partnerPercent: number;
  companyPercent: number;
}

export function studentMoney(student: { finalPrice: unknown }, payments: { amount: unknown }[], shares: { percent: unknown }[]): StudentMoney {
  const finalPrice = num(student.finalPrice as never);
  const paid = round2(payments.reduce((s, p) => s + num(p.amount as never), 0));
  const partnerPercent = round2(shares.reduce((s, sh) => s + num(sh.percent as never), 0));
  return { finalPrice, paid, remaining: round2(finalPrice - paid), partnerPercent, companyPercent: round2(100 - partnerPercent) };
}

export type InstallmentStatus = "PAID" | "PARTIAL" | "PENDING" | "OVERDUE";

export function installmentStatus(i: { amount: unknown; paidAmount: unknown; dueDate: Date }, now = new Date()) {
  const remaining = round2(num(i.amount as never) - num(i.paidAmount as never));
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let status: InstallmentStatus;
  if (remaining <= 0) status = "PAID";
  else if (i.dueDate < startOfToday) status = "OVERDUE";
  else if (num(i.paidAmount as never) > 0) status = "PARTIAL";
  else status = "PENDING";
  return { status, remaining: Math.max(0, remaining) };
}

export interface PartnerTotals {
  studentCount: number;
  activeStudentCount: number;
  totalFinalPrice: number;
  totalCollected: number;
  totalRemaining: number;
  projectedShare: number;
  earnedShare: number;
  pendingShare: number;
  totalPaidOut: number;
  balance: number;
}

export async function partnerTotals(partnerId: string): Promise<PartnerTotals> {
  const [shares, earnedAgg, payoutAgg] = await Promise.all([
    prisma.studentShare.findMany({
      where: { partnerId },
      include: { student: { select: { finalPrice: true, status: true, payments: { select: { amount: true } } } } },
    }),
    prisma.paymentShare.aggregate({ where: { partnerId }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { partnerId }, _sum: { amount: true } }),
  ]);

  const totalFinalPrice = round2(shares.reduce((s, sh) => s + num(sh.student.finalPrice), 0));
  const totalCollected = round2(shares.reduce((s, sh) => s + sh.student.payments.reduce((a, p) => a + num(p.amount), 0), 0));
  const projectedShare = round2(shares.reduce((s, sh) => s + (num(sh.student.finalPrice) * num(sh.percent)) / 100, 0));
  const earnedShare = num(earnedAgg._sum.amount);
  const totalPaidOut = num(payoutAgg._sum.amount);

  return {
    studentCount: shares.length,
    activeStudentCount: shares.filter((sh) => sh.student.status === "ACTIVE").length,
    totalFinalPrice,
    totalCollected,
    totalRemaining: round2(totalFinalPrice - totalCollected),
    projectedShare,
    earnedShare,
    pendingShare: round2(projectedShare - earnedShare),
    totalPaidOut,
    balance: round2(earnedShare - totalPaidOut),
  };
}
