import { prisma } from "../../database/prisma";
import { conflict, notFound } from "../../common/utils/errors";
import { num, round2 } from "../../common/utils/money";
import { monthlyBreakdown, partnerTotals } from "../finance/finance.service";
import type { CreatePartnerInput, UpdatePartnerInput } from "./partners.schema";

export const partnerInclude = {
  user: { select: { id: true, name: true, email: true, isActive: true, role: true } },
  teacher: { select: { id: true, phone: true, subjects: { select: { id: true, name: true } } } },
} as const;

async function withTotals<T extends { id: string }>(partner: T) {
  return { ...partner, totals: await partnerTotals(partner.id) };
}

export async function listPartners(onlyId?: string) {
  const partners = await prisma.partner.findMany({
    where: onlyId ? { id: onlyId } : undefined,
    include: partnerInclude,
    orderBy: [{ kind: "desc" }, { name: "asc" }],
  });
  return Promise.all(partners.map(withTotals));
}

export async function getPartner(id: string) {
  const partner = await prisma.partner.findUnique({ where: { id }, include: partnerInclude });
  if (!partner) throw notFound("Partner not found");
  return withTotals(partner);
}

export async function createPartner(input: CreatePartnerInput) {
  const partner = await prisma.partner.create({
    data: { name: input.name, kind: input.kind, userId: input.userId ?? null },
    include: partnerInclude,
  });
  return withTotals(partner);
}

export async function updatePartner(id: string, input: UpdatePartnerInput) {
  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) throw notFound("Partner not found");
  const partner = await prisma.partner.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: partnerInclude,
  });
  return withTotals(partner);
}

export async function deletePartner(id: string) {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: { _count: { select: { studentShares: true, paymentShares: true, payouts: true } } },
  });
  if (!partner) throw notFound("Partner not found");
  if (partner.teacherId) throw conflict("Teacher partners are removed together with the teacher.");
  const c = partner._count;
  if (c.studentShares > 0 || c.paymentShares > 0 || c.payouts > 0) {
    throw conflict("This partner has shares or payouts linked. Mark them inactive instead.");
  }
  await prisma.partner.delete({ where: { id } });
}

/** Make sure a teacher has a partner account (created with the teacher, kept in sync). */
export async function ensureTeacherPartner(teacher: { id: string; userId: string }, name: string, isActive = true) {
  return prisma.partner.upsert({
    where: { teacherId: teacher.id },
    update: { name, isActive },
    create: { name, kind: "TEACHER", teacherId: teacher.id, userId: teacher.userId, isActive },
  });
}

export async function getPartnerSummary(partnerId: string) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, include: partnerInclude });
  if (!partner) throw notFound("Partner not found");

  const [totals, shares, payouts, recentShares, monthly, earnedByStudent] = await Promise.all([
    partnerTotals(partnerId),
    prisma.studentShare.findMany({
      where: { partnerId },
      include: {
        student: {
          select: {
            id: true, name: true, phone: true, status: true, finalPrice: true, enrolledAt: true,
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, user: { select: { name: true } } } },
            payments: { select: { amount: true } },
          },
        },
      },
      orderBy: { student: { enrolledAt: "desc" } },
    }),
    prisma.payout.findMany({ where: { partnerId }, orderBy: { paidAt: "desc" } }),
    prisma.paymentShare.findMany({
      where: { partnerId },
      include: { payment: { select: { id: true, amount: true, paidAt: true, method: true, student: { select: { id: true, name: true } } } } },
      orderBy: { payment: { paidAt: "desc" } },
      take: 15,
    }),
    monthlyBreakdown(6, partnerId),
    prisma.paymentShare.findMany({ where: { partnerId }, select: { amount: true, payment: { select: { studentId: true } } } }),
  ]);

  const earnedMap = new Map<string, number>();
  for (const ps of earnedByStudent) {
    const sid = ps.payment.studentId;
    earnedMap.set(sid, round2((earnedMap.get(sid) ?? 0) + num(ps.amount)));
  }

  const students = shares.map((sh) => {
    const { payments, ...st } = sh.student;
    const finalPrice = num(st.finalPrice);
    const paid = round2(payments.reduce((a, p) => a + num(p.amount), 0));
    return {
      ...st,
      finalPrice,
      paid,
      remaining: round2(finalPrice - paid),
      percent: num(sh.percent),
      earned: earnedMap.get(st.id) ?? 0,
      projected: round2((finalPrice * num(sh.percent)) / 100),
    };
  });

  const recentPayments = recentShares.map((ps) => ({
    id: ps.payment.id,
    paidAt: ps.payment.paidAt,
    method: ps.payment.method,
    amount: ps.payment.amount,
    student: ps.payment.student,
    percent: ps.percent,
    share: ps.amount,
  }));

  return { partner, totals, students, payouts, recentPayments, monthly };
}
