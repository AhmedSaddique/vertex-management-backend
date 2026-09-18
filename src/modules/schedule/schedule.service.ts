import { Prisma, type Weekday } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest, conflict, notFound } from "../../common/utils/errors";
import type { CreateSlotInput, SlotFilters, UpdateSlotInput } from "./schedule.schema";

export const slotInclude = {
  teacher: { select: { id: true, phone: true, user: { select: { name: true, email: true } } } },
  subject: { select: { id: true, name: true } },
  students: {
    select: { id: true, admissionNo: true, name: true, fatherName: true, phone: true, fatherPhone: true, email: true, status: true, teacherId: true, availableSlots: true },
    orderBy: { name: "asc" },
  },
} as const satisfies Prisma.ClassSlotInclude;

const DAY_LABEL: Record<Weekday, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
};

export async function listSlots(f: SlotFilters) {
  return prisma.classSlot.findMany({
    where: {
      ...(f.teacherId ? { teacherId: f.teacherId } : {}),
      ...(f.subjectId ? { subjectId: f.subjectId } : {}),
      ...(f.day ? { days: { has: f.day } } : {}),
      ...(f.activeOnly ? { isActive: true } : {}),
    },
    include: slotInclude,
    orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
  });
}

export async function getSlot(id: string, scopeTeacherId?: string) {
  const slot = await prisma.classSlot.findUnique({ where: { id }, include: slotInclude });
  if (!slot || (scopeTeacherId && slot.teacherId !== scopeTeacherId)) throw notFound("Class not found");
  return slot;
}

/** A teacher cannot have two active classes that overlap on the same day. */
async function assertNoOverlap(teacherId: string, days: Weekday[], startTime: string, endTime: string, excludeId?: string) {
  const others = await prisma.classSlot.findMany({
    where: {
      teacherId,
      isActive: true,
      days: { hasSome: days },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, title: true, days: true, startTime: true, endTime: true, subject: { select: { name: true } } },
  });
  const clash = others.find((o) => startTime < o.endTime && endTime > o.startTime);
  if (clash) {
    const commonDays = clash.days.filter((d) => days.includes(d)).map((d) => DAY_LABEL[d]).join(", ");
    throw conflict(
      `This teacher already has "${clash.title ?? clash.subject.name}" on ${commonDays} from ${clash.startTime} to ${clash.endTime}.`,
    );
  }
}

export async function createSlot(input: CreateSlotInput) {
  const [teacher, subject] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: input.teacherId } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
  ]);
  if (!teacher) throw badRequest("Selected teacher does not exist");
  if (!subject) throw badRequest("Selected subject does not exist");
  if (input.isActive !== false) await assertNoOverlap(input.teacherId, input.days, input.startTime, input.endTime);

  return prisma.classSlot.create({
    data: {
      title: input.title || null,
      teacherId: input.teacherId,
      subjectId: input.subjectId,
      days: input.days,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location || null,
      notes: input.notes || null,
      isActive: input.isActive ?? true,
      ...(input.studentIds ? { students: { connect: input.studentIds.map((id) => ({ id })) } } : {}),
    },
    include: slotInclude,
  });
}

export async function updateSlot(id: string, input: UpdateSlotInput) {
  const existing = await prisma.classSlot.findUnique({ where: { id } });
  if (!existing) throw notFound("Class not found");

  const teacherId = input.teacherId ?? existing.teacherId;
  const days = input.days ?? existing.days;
  const startTime = input.startTime ?? existing.startTime;
  const endTime = input.endTime ?? existing.endTime;
  const isActive = input.isActive ?? existing.isActive;
  if (endTime <= startTime) throw badRequest("End time must be after start time");
  if (isActive) await assertNoOverlap(teacherId, days, startTime, endTime, id);

  return prisma.classSlot.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title || null } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
      ...(input.location !== undefined ? { location: input.location || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.studentIds ? { students: { set: input.studentIds.map((sid) => ({ id: sid })) } } : {}),
      teacherId,
      days,
      startTime,
      endTime,
      isActive,
    },
    include: slotInclude,
  });
}

export async function setSlotStudents(id: string, studentIds: string[]) {
  const existing = await prisma.classSlot.findUnique({ where: { id } });
  if (!existing) throw notFound("Class not found");
  return prisma.classSlot.update({
    where: { id },
    data: { students: { set: studentIds.map((sid) => ({ id: sid })) } },
    include: slotInclude,
  });
}

export async function deleteSlot(id: string) {
  await prisma.classSlot.delete({ where: { id } });
}
