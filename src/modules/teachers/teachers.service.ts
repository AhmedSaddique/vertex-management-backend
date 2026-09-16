import bcrypt from "bcryptjs";
import { prisma } from "../../database/prisma";
import { conflict, notFound } from "../../common/utils/errors";
import { partnerTotals } from "../finance/finance.service";
import { ensureTeacherPartner, getPartnerSummary } from "../partners/partners.service";
import type { CreateTeacherInput, UpdateTeacherInput } from "./teachers.schema";

export const teacherInclude = {
  user: { select: { id: true, name: true, email: true, isActive: true } },
  partner: { select: { id: true, name: true, isActive: true } },
  subjects: { select: { id: true, name: true } },
  _count: { select: { students: true, classSlots: true } },
} as const;

async function withTotals<T extends { partner: { id: string } | null }>(teacher: T) {
  return { ...teacher, totals: teacher.partner ? await partnerTotals(teacher.partner.id) : null };
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
  const created = await prisma.teacher.create({
    data: {
      phone: input.phone ?? null,
      subjects: { connect: input.subjectIds.map((id) => ({ id })) },
      user: {
        create: { name: input.name, email: input.email.toLowerCase(), password: await bcrypt.hash(input.password, 10), role: "TEACHER" },
      },
    },
  });
  // Every teacher also gets a partner account so they can receive a share of fees.
  await ensureTeacherPartner(created, input.name);
  return getTeacher(created.id);
}

export async function updateTeacher(id: string, input: UpdateTeacherInput) {
  const existing = await prisma.teacher.findUnique({ where: { id }, include: { user: true } });
  if (!existing) throw notFound("Teacher not found");

  await prisma.teacher.update({
    where: { id },
    data: {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
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
  });
  await ensureTeacherPartner(existing, input.name ?? existing.user.name, input.isActive ?? existing.user.isActive);
  return getTeacher(id);
}

export async function deleteTeacher(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      _count: { select: { students: true, payments: true, classSlots: true } },
      partner: { include: { _count: { select: { studentShares: true, paymentShares: true, payouts: true } } } },
    },
  });
  if (!teacher) throw notFound("Teacher not found");
  const c = teacher._count;
  const p = teacher.partner?._count;
  if (c.students > 0 || c.payments > 0 || c.classSlots > 0 || (p && (p.studentShares > 0 || p.paymentShares > 0 || p.payouts > 0))) {
    throw conflict("This teacher has students, classes, payments or shares linked. Deactivate the account instead.");
  }
  await prisma.$transaction([
    ...(teacher.partner ? [prisma.partner.delete({ where: { id: teacher.partner.id } })] : []),
    prisma.user.delete({ where: { id: teacher.userId } }),
  ]);
}

/** The teacher's money page is their partner account. */
export async function getTeacherSummary(teacherId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { partner: { select: { id: true } } } });
  if (!teacher) throw notFound("Teacher not found");
  if (!teacher.partner) throw notFound("This teacher has no partner account yet");
  return getPartnerSummary(teacher.partner.id);
}
