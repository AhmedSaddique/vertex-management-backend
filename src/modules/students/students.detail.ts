import { prisma } from "../../database/prisma";
import { notFound } from "../../common/utils/errors";
import { num, round2 } from "../../common/utils/money";
import { installmentStatus, splitAmount, studentMoney } from "../finance/finance.service";

/** Student detail: shares with earnings, installments with status, payments with their split. */
export async function getStudent(id: string, scopeTeacherId?: string) {
  const s = await prisma.student.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, user: { select: { name: true } } } },
      shares: { include: { partner: { select: { id: true, name: true, kind: true } } }, orderBy: { percent: "desc" } },
      installments: { orderBy: { dueDate: "asc" } },
      payments: {
        include: {
          shares: { include: { partner: { select: { id: true, name: true } } } },
          installment: { select: { id: true, dueDate: true } },
        },
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
  if (!s || (scopeTeacherId && s.teacherId !== scopeTeacherId)) throw notFound("Student not found");

  const earned = new Map<string, number>();
  const payments = s.payments.map((p) => {
    const shares = p.shares.map((ps) => {
      earned.set(ps.partnerId, round2((earned.get(ps.partnerId) ?? 0) + num(ps.amount)));
      return { partnerId: ps.partnerId, partnerName: ps.partner.name, percent: num(ps.percent), amount: num(ps.amount) };
    });
    const partnerShare = round2(shares.reduce((a, x) => a + x.amount, 0));
    return { ...p, shares, partnerShare, companyShare: round2(num(p.amount) - partnerShare) };
  });

  const finalPrice = num(s.finalPrice);
  const shares = s.shares.map((sh) => ({
    partnerId: sh.partnerId,
    partner: sh.partner,
    percent: num(sh.percent),
    earned: earned.get(sh.partnerId) ?? 0,
    projected: round2((finalPrice * num(sh.percent)) / 100),
  }));
  const installments = s.installments.map((i) => ({ ...i, ...installmentStatus(i) }));
  return { ...s, shares, installments, payments, ...studentMoney(s, s.payments, s.shares) };
}

/** Preview how an amount would be split for a student (used by the payment dialog). */
export async function previewSplit(studentId: string, amount: number) {
  const shares = await prisma.studentShare.findMany({ where: { studentId }, include: { partner: { select: { name: true } } } });
  const split = splitAmount(amount, shares);
  return {
    rows: split.rows.map((r, i) => ({ ...r, partnerName: shares[i].partner.name })),
    partnerTotal: split.partnerTotal,
    companyAmount: split.companyAmount,
  };
}
