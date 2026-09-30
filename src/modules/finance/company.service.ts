import { prisma } from "../../database/prisma";
import { num, round2 } from "../../common/utils/money";
import { outstandingTotal } from "../loans/loans.service";

/**
 * Company income has two sources:
 *   - student fees: whatever is left after the partner shares
 *   - trading payouts: whatever is left after the member shares
 * Expenses come out of that combined company income.
 */
export interface CompanyTotals {
  totalFinalPrice: number;
  totalCollected: number;
  totalOutstanding: number;
  /** Partner share of student fees collected. */
  partnerShare: number;
  /** Company share of student fees collected. */
  companyFeeShare: number;
  tradingTotal: number;
  tradingPartnerShare: number;
  companyTradingShare: number;
  /** Fees plus trading. */
  companyShare: number;
  totalExpenses: number;
  companyBalance: number;
  totalPayouts: number;
  partnerBalanceOwed: number;
  /** Money taken from the company and not yet paid back. */
  loansOutstanding: number;
  netCash: number;
}

export async function companyTotals(): Promise<CompanyTotals> {
  const [studentAgg, paymentAgg, shareAgg, tradingAgg, tradingShareAgg, payoutAgg, expenseAgg, loansOutstanding] = await Promise.all([
    prisma.student.aggregate({ _sum: { finalPrice: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.paymentShare.aggregate({ _sum: { amount: true } }),
    prisma.tradingPayout.aggregate({ _sum: { amount: true } }),
    prisma.tradingPayoutShare.aggregate({ _sum: { amount: true } }),
    prisma.payout.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    outstandingTotal(),
  ]);

  const totalFinalPrice = num(studentAgg._sum.finalPrice);
  const totalCollected = num(paymentAgg._sum.amount);
  const partnerShare = num(shareAgg._sum.amount);
  const tradingTotal = num(tradingAgg._sum.amount);
  const tradingPartnerShare = num(tradingShareAgg._sum.amount);
  const totalPayouts = num(payoutAgg._sum.amount);
  const totalExpenses = num(expenseAgg._sum.amount);

  const companyFeeShare = round2(totalCollected - partnerShare);
  const companyTradingShare = round2(tradingTotal - tradingPartnerShare);
  const companyShare = round2(companyFeeShare + companyTradingShare);

  return {
    totalFinalPrice,
    totalCollected,
    totalOutstanding: round2(totalFinalPrice - totalCollected),
    partnerShare,
    companyFeeShare,
    tradingTotal,
    tradingPartnerShare,
    companyTradingShare,
    companyShare,
    totalExpenses,
    companyBalance: round2(companyShare - totalExpenses),
    totalPayouts,
    partnerBalanceOwed: round2(partnerShare + tradingPartnerShare - totalPayouts),
    loansOutstanding,
    netCash: round2(totalCollected + tradingTotal - totalPayouts - totalExpenses - loansOutstanding),
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
  trading: number;
  tradingPartnerShare: number;
  tradingCompanyShare: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Company-wide by default; with partnerId only that partner's shares and payouts. */
export async function monthlyBreakdown(months = 6, partnerId?: string): Promise<MonthlyPoint[]> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const [payments, payouts, expenses, trading] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start }, ...(partnerId ? { shares: { some: { partnerId } } } : {}) },
      select: { amount: true, paidAt: true, shares: { select: { partnerId: true, amount: true } } },
    }),
    prisma.payout.findMany({ where: { paidAt: { gte: start }, ...(partnerId ? { partnerId } : {}) }, select: { amount: true, paidAt: true } }),
    partnerId ? Promise.resolve([]) : prisma.expense.findMany({ where: { spentAt: { gte: start } }, select: { amount: true, spentAt: true } }),
    prisma.tradingPayout.findMany({
      where: { occurredAt: { gte: start }, ...(partnerId ? { shares: { some: { partnerId } } } : {}) },
      select: { amount: true, occurredAt: true, shares: { select: { partnerId: true, amount: true } } },
    }),
  ]);

  const points: MonthlyPoint[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    points.push({
      month: monthKey(d),
      label: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
      collected: 0,
      partnerShare: 0,
      companyShare: 0,
      payouts: 0,
      expenses: 0,
      trading: 0,
      tradingPartnerShare: 0,
      tradingCompanyShare: 0,
    });
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
  for (const t of trading) {
    const point = byKey.get(monthKey(t.occurredAt));
    if (!point) continue;
    const amt = num(t.amount);
    const relevant = partnerId ? t.shares.filter((s) => s.partnerId === partnerId) : t.shares;
    const share = round2(relevant.reduce((a, s) => a + num(s.amount), 0));
    point.trading = round2(point.trading + amt);
    point.tradingPartnerShare = round2(point.tradingPartnerShare + share);
    if (!partnerId) point.tradingCompanyShare = round2(point.tradingCompanyShare + (amt - share));
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
