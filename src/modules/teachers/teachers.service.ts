import bcrypt from "bcryptjs";
import { prisma } from "../../database/prisma";
import { conflict, notFound } from "../../common/utils/errors";
import { share } from "../../common/utils/money";
import { monthlyBreakdown, studentMoney, teacherTotals } from "../finance/finance.service";
import type { CreateTeacherInput, UpdateTeacherInput } from "./teachers.schema";

export const teacherInclude = {
  user: { select: { id: true, name: true, email: true, isActive: true } },
  subjects: { select: { id: true, name: true } },
  _count: { select: { students: true } },
} as const;

async function withTotals<T extends { id: string }>(teacher: T) {
  return { ...teacher, totals: await teacherTotals(teacher.id) };
}

export async function listTeachers(onlyId?: string) {
  const teachers = await prisma.teacher.findMany({
    where: onlyId ? { id: onlyId } : undefined,
    include: teacherInclude,
    orderBy: { user: { name: "asc" } },
  });
  return Promise.all(teachers.map(withTotals));
}

export async function getTeacher(id: string) {
  const teacher = await prisma.teacher.findUnique({ where: { id }, include: teacherInclude });
  if (!teacher) throw notFound("Teacher not found");
  return withTotals(teacher);
}

export async function createTeacher(input: CreateTeacherInput) {
  const teacher = await prisma.teacher.create({
    data: {
      phone: input.phone ?? null,
      defaultCommissionPercent: input.defaultCommissionPercent,
      subjects: { connect: input.subjectIds.map((id) => ({ id })) },
      user: {
        create: {
          name: input.name,
          email: input.email.toLowerCase(),
          password: await bcrypt.hash(input.password, 10),
          role: "TEACHER",
        },
      },
    },
    include: teacherInclude,
  });
  return withTotals(teacher);
}

export async function updateTeacher(id: string, input: UpdateTeacherInput) {
  const existing = await prisma.teacher.findUnique({ where: { id } });
  if (!existing) throw notFound("Teacher not found");

  const teacher = await prisma.teacher.update({
    where: { id },
    data: {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.defaultCommissionPercent !== undefined
        ? { defaultCommissionPercent: input.defaultCommissionPercent }
        : {}),
      ...(input.subjectIds ? { subjects: { set: input.subjectIds.map((sid) => ({ id: sid })) } } : {}),
      user: {
        update: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.password ? { password: await bcrypt.hash(input.password, 10) } : {}),
        },
      },
    },
    include: teacherInclude,
  });
  return withTotals(teacher);
}

export async function deleteTeacher(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { _count: { select: { students: true, payments: true, payouts: true } } },
  });
  if (!teacher) throw notFound("Teacher not found");
  const c = teacher._count;
  if (c.students > 0 || c.payments > 0 || c.payouts > 0) {
    throw conflict("This teacher has students, payments or payouts linked. Deactivate the account instead.");
  }
  // Deleting the user cascades to the teacher row.
  await prisma.user.delete({ where: { id: teacher.userId } });
}

export async function getTeacherSummary(teacherId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: teacherInclude });
  if (!teacher) throw notFound("Teacher not found");

  const [totals, students, payouts, recentPayments, monthly] = await Promise.all([
    teacherTotals(teacherId),
    prisma.student.findMany({
      where: { teacherId },
      include: {
        subject: { select: { id: true, name: true } },
        payments: { select: { amount: true, commissionPercent: true, teacherId: true } },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.payout.findMany({ where: { teacherId }, orderBy: { paidAt: "desc" } }),
    prisma.payment.findMany({
      where: { teacherId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { paidAt: "desc" },
      take: 15,
    }),
    monthlyBreakdown(6, teacherId),
  ]);

  const studentRows = students.map(({ payments, ...s }) => {
    const own = payments.filter((p) => p.teacherId === teacherId);
    return {
      ...s,
      ...studentMoney(s, payments),
      teacherShareEarned: studentMoney(s, own).teacherShareEarned,
    };
  });

  const paymentRows = recentPayments.map((p) => ({
    ...p,
    teacherShare: share(p.amount, p.commissionPercent),
  }));

  return { teacher, totals, students: studentRows, payouts, recentPayments: paymentRows, monthly };
}
