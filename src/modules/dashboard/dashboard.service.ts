import { prisma } from "../../database/prisma";
import { num, round2 } from "../../common/utils/money";
import { companyTotals, monthlyBreakdown, partnerTotals } from "../finance/finance.service";
import { listDue } from "../installments/installments.service";
import { paymentInclude, shapePayment } from "../payments/payments.service";

/** Company-wide overview for the admin dashboard and the company account page. */
export async function getOverview() {
  const [finance, statusGroups, subjects, partners, recentPayments, recentStudents, monthly, due] = await Promise.all([
    companyTotals(),
    prisma.student.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.subject.findMany({
      include: { students: { select: { finalPrice: true, payments: { select: { amount: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.partner.findMany({
      include: { teacher: { select: { id: true, subjects: { select: { name: true } } } } },
      orderBy: [{ kind: "desc" }, { name: "asc" }],
    }),
    prisma.payment.findMany({ include: paymentInclude, orderBy: { paidAt: "desc" }, take: 10 }),
    prisma.student.findMany({
      include: { subject: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    monthlyBreakdown(6),
    listDue(7),
  ]);

  const countOf = (status: string) => statusGroups.find((g) => g.status === status)?._count._all ?? 0;
  const students = {
    total: statusGroups.reduce((s, g) => s + g._count._all, 0),
    active: countOf("ACTIVE"),
    completed: countOf("COMPLETED"),
    dropped: countOf("DROPPED"),
  };

  const bySubject = subjects.map((s) => {
    const finalPrice = round2(s.students.reduce((a, st) => a + num(st.finalPrice), 0));
    const collected = round2(s.students.reduce((a, st) => a + st.payments.reduce((b, p) => b + num(p.amount), 0), 0));
    return { id: s.id, name: s.name, students: s.students.length, finalPrice, collected, remaining: round2(finalPrice - collected) };
  });

  const partnerRows = await Promise.all(
    partners.map(async (p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      isActive: p.isActive,
      teacherId: p.teacher?.id ?? null,
      subjects: p.teacher?.subjects.map((s) => s.name) ?? [],
      totals: await partnerTotals(p.id),
    })),
  );

  return {
    finance,
    students,
    bySubject,
    partners: partnerRows,
    recentPayments: recentPayments.map(shapePayment),
    recentStudents,
    monthly,
    due,
  };
}
