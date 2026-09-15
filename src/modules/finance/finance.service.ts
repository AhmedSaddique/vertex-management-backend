import { prisma } from "../../database/prisma";
import { num, round2, share } from "../../common/utils/money";

/**
 * All money maths for the system lives here so the rules are in one place.
 *
 * Rules:
 *  - A student has fee, discount and finalPrice (= fee - discount).
 *  - Each payment a student makes is split: teacher gets commissionPercent
 *    of the payment (snapshotted on the payment), company gets the rest.
 *  - Earned (teacher)    = sum of their share on collected payments.
 *  - Projected (teacher) = their share of finalPrice of every assigned student,
 *                          i.e. what they will have earned once everyone pays in full.
 *  - Balance (teacher)   = earned - payouts already handed over (payable salary).
 */

export interface StudentMoney {
  finalPrice: number;
  paid: number;
  remaining: number;
  teacherShareEarned: number;
  teacherShareProjected: number;
}

type MoneyLike = { finalPrice: unknown; commissionPercent: unknown };
type PaymentLike = { amount: unknown; commissionPercent: unknown };

export function studentMoney(student: MoneyLike, payments: PaymentLike[]): StudentMoney {
  const finalPrice = num(student.finalPrice as never);
  const paid = round2(payments.reduce((s, p) => s + num(p.amount as never), 0));
  const teacherShareEarned = round2(
    payments.reduce((s, p) => s + share(p.amount as never, p.commissionPercent as never), 0),
  );
  return {
    finalPrice,
    paid,
    remaining: round2(finalPrice - paid),
    teacherShareEarned,
    teacherShareProjected: share(finalPrice, student.commissionPercent as never),
  };
}

export interface TeacherTotals {
  studentCount: number;
  activeStudentCount: number;
  totalFinalPrice: number;
  totalCollected: number;
  totalRemaining: number;
  projectedCommission: number;
  earnedCommission: number;
  pendingCommission: number;
  totalPaidOut: number;
  balance: number;
}

export async function teacherTotals(teacherId: string): Promise<TeacherTotals> {
  const [students, payments, payoutAgg] = await Promise.all([
    prisma.student.findMany({
      where: { teacherId },
      select: { id: true, finalPrice: true, commissionPercent: true, status: true },
    }),
    prisma.payment.findMany({
      where: { teacherId },
      select: { amount: true, commissionPercent: true, studentId: true },
    }),
    prisma.payout.aggregate({ where: { teacherId }, _sum: { amount: true } }),
  ]);

  const totalFinalPrice = round2(students.reduce((s, st) => s + num(st.finalPrice), 0));
  const projectedCommission = round2(
    students.reduce((s, st) => s + share(st.finalPrice, st.commissionPercent), 0),
  );
  const totalCollected = round2(payments.reduce((s, p) => s + num(p.amount), 0));
  const earnedCommission = round2(
    payments.reduce((s, p) => s + share(p.amount, p.commissionPercent), 0),
  );
  const totalPaidOut = num(payoutAgg._sum.amount);

  const studentIds = new Set(students.map((s) => s.id));
  const collectedForCurrentStudents = round2(
    payments.filter((p) => studentIds.has(p.studentId)).reduce((s, p) => s + num(p.amount), 0),
  );

  return {
    studentCount: students.length,
    activeStudentCount: students.filter((s) => s.status === "ACTIVE").length,
    totalFinalPrice,
    totalCollected,
    totalRemaining: round2(totalFinalPrice - collectedForCurrentStudents),
    projectedCommission,
    earnedCommission,
    pendingCommission: round2(projectedCommission - earnedCommission),
    totalPaidOut,
    balance: round2(earnedCommission - totalPaidOut),
  };
}

export interface CompanyTotals {
  totalFinalPrice: number;
  totalCollected: number;
  totalOutstanding: number;
  teacherShare: number;
  companyShare: number;
  totalPayouts: number;
  teacherBalanceOwed: number;
  netCash: number;
}

export async function companyTotals(): Promise<CompanyTotals> {
  const [studentAgg, payments, payoutAgg] = await Promise.all([
    prisma.student.aggregate({ _sum: { finalPrice: true } }),
    prisma.payment.findMany({ select: { amount: true, commissionPercent: true } }),
    prisma.payout.aggregate({ _sum: { amount: true } }),
  ]);

  const totalFinalPrice = num(studentAgg._sum.finalPrice);
  const totalCollected = round2(payments.reduce((s, p) => s + num(p.amount), 0));
  const teacherShare = round2(
    payments.reduce((s, p) => s + share(p.amount, p.commissionPercent), 0),
  );
  const totalPayouts = num(payoutAgg._sum.amount);

  return {
    totalFinalPrice,
    totalCollected,
    totalOutstanding: round2(totalFinalPrice - totalCollected),
    teacherShare,
    companyShare: round2(totalCollected - teacherShare),
    totalPayouts,
    teacherBalanceOwed: round2(teacherShare - totalPayouts),
    netCash: round2(totalCollected - totalPayouts),
  };
}

export interface MonthlyPoint {
  month: string;
  label: string;
  collected: number;
  teacherShare: number;
  companyShare: number;
  payouts: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export async function monthlyBreakdown(months = 6, teacherId?: string): Promise<MonthlyPoint[]> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const scope = teacherId ? { teacherId } : {};
  const [payments, payouts] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start }, ...scope },
      select: { amount: true, commissionPercent: true, paidAt: true },
    }),
    prisma.payout.findMany({
      where: { paidAt: { gte: start }, ...scope },
      select: { amount: true, paidAt: true },
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
      teacherShare: 0,
      companyShare: 0,
      payouts: 0,
    });
  }
  const byKey = new Map(points.map((p) => [p.month, p]));

  for (const p of payments) {
    const point = byKey.get(monthKey(p.paidAt));
    if (!point) continue;
    const amt = num(p.amount);
    const ts = share(p.amount, p.commissionPercent);
    point.collected = round2(point.collected + amt);
    point.teacherShare = round2(point.teacherShare + ts);
    point.companyShare = round2(point.companyShare + (amt - ts));
  }
  for (const po of payouts) {
    const point = byKey.get(monthKey(po.paidAt));
    if (point) point.payouts = round2(point.payouts + num(po.amount));
  }
  return points;
}
