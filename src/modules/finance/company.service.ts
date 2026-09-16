import { prisma } from "../../database/prisma";
import { num, round2 } from "../../common/utils/money";

/** Company share = collected - partner shares; company balance = company share - expenses. */
export interface CompanyTotals {
  totalFinalPrice: number;
  totalCollected: number;
  totalOutstanding: number;
  partnerShare: number;
  companyShare: number;
  totalExpenses: number;
  companyBalance: number;
  totalPayouts: number;
  partnerBalanceOwed: number;
  netCash: number;
}

export async function companyTotals(): Promise<CompanyTotals> {
  const [studentAgg, paymentAgg, shareAgg, payoutAgg, expenseAgg] = await Promise.all([
    prisma.student.aggregate({ _sum: { finalPrice: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.paymentShare.aggregate({ _sum: { amount: true } }),
    prisma.payout.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
  ]);
  const totalFinalPrice = num(studentAgg._sum.finalPrice);
  const totalCollected = num(paymentAgg._sum.amount);
  const partnerShare = num(shareAgg._sum.amount);
  const totalPayouts = num(payoutAgg._sum.amount);
  const totalExpenses = num(expenseAgg._sum.amount);
  const companyShare = round2(totalCollected - partnerShare);
  return {
    totalFinalPrice,
    totalCollected,
    totalOutstanding: round2(totalFinalPrice - totalCollected),
    partnerShare,
    companyShare,
    totalExpenses,
    companyBalance: round2(companyShare - totalExpenses),
    totalPayouts,
    partnerBalanceOwed: round2(partnerShare - totalPayouts),
    netCash: round2(totalCollected - totalPayouts - totalExpenses),
  };
}

export interface MonthlyPoint {
  month: string;
  label: string;
  collected: number;
  partnerShare: number;
  companyShare: number;
  payouts: number;
  expenses: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Company-wide by default; with partnerId only that partner's share and payouts. */
export async function monthlyBreakdown(months = 6, partnerId?: string): Promise<MonthlyPoint[]> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const [payments, payouts, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start }, ...(partnerId ? { shares: { some: { partnerId } } } : {}) },
      select: { amount: true, paidAt: true, shares: { select: { partnerId: true, amount: true } } },
    }),
    prisma.payout.findMany({ where: { paidAt: { gte: start }, ...(partnerId ? { partnerId } : {}) }, select: { amount: true, paidAt: true } }),
    partnerId ? Promise.resolve([]) : prisma.expense.findMany({ where: { spentAt: { gte: start } }, select: { amount: true, spentAt: true } }),
  ]);

  const points: MonthlyPoint[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    points.push({ month: monthKey(d), label: d.toLocaleString("en-US", { month: "short", year: "numeric" }), collected: 0, partnerShare: 0, companyShare: 0, payouts: 0, expenses: 0 });
  }
  const byKey = new Map(points.map((p) => [p.month, p]));

  for (const p of payments) {
    const point = byKey.get(monthKey(p.paidAt));
    if (!point) continue;
    const amt = num(p.amount);
    const relevant = partnerId ? p.shares.filter((s) => s.partnerId === partnerId) : p.shares;
    const share = round2(relevant.reduce((a, s) => a + num(s.amount), 0));
    point.collected = round2(point.collected + amt);
    point.partnerShare = round2(point.partnerShare + share);
    if (!partnerId) point.companyShare = round2(point.companyShare + (amt - share));
  }
  for (const po of payouts) {
    const point = byKey.get(monthKey(po.paidAt));
    if (point) point.payouts = round2(point.payouts + num(po.amount));
  }
  for (const e of expenses) {
    const point = byKey.get(monthKey(e.spentAt));
    if (point) point.expenses = round2(point.expenses + num(e.amount));
  }
  return points;
}
