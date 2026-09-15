import { prisma } from "../../database/prisma";
import { num, round2, share } from "../../common/utils/money";
import { companyTotals, monthlyBreakdown, teacherTotals } from "../finance/finance.service";

/** Company-wide overview for the admin dashboard and the company account page. */
export async function getOverview() {
  const [finance, statusGroups, subjects, teachers, recentPayments, recentStudents, monthly] =
    await Promise.all([
      companyTotals(),
      prisma.student.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.subject.findMany({
        include: {
          students: { select: { finalPrice: true, payments: { select: { amount: true } } } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.teacher.findMany({
        include: { user: { select: { name: true } }, subjects: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.payment.findMany({
        include: {
          student: { select: { id: true, name: true } },
          teacher: { select: { id: true, user: { select: { name: true } } } },
        },
        orderBy: { paidAt: "desc" },
        take: 10,
      }),
      prisma.student.findMany({
        include: {
          subject: { select: { name: true } },
          teacher: { select: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      monthlyBreakdown(6),
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
    const collected = round2(
      s.students.reduce((a, st) => a + st.payments.reduce((b, p) => b + num(p.amount), 0), 0),
    );
    return { id: s.id, name: s.name, students: s.students.length, finalPrice, collected, remaining: round2(finalPrice - collected) };
  });

  const teacherRows = await Promise.all(
    teachers.map(async (t) => ({
      id: t.id,
      name: t.user.name,
      subjects: t.subjects.map((s) => s.name),
      defaultCommissionPercent: t.defaultCommissionPercent,
      totals: await teacherTotals(t.id),
    })),
  );

  return {
    finance,
    students,
    bySubject,
    teachers: teacherRows,
    recentPayments: recentPayments.map((p) => ({ ...p, teacherShare: share(p.amount, p.commissionPercent) })),
    recentStudents,
    monthly,
  };
}
