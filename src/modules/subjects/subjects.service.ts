import { prisma } from "../../database/prisma";
import { conflict, notFound } from "../../common/utils/errors";
import type { SubjectInput, UpdateSubjectInput } from "./subjects.schema";

export const subjectInclude = {
  teachers: { select: { id: true, user: { select: { name: true } } } },
  _count: { select: { students: true } },
} as const;

export function listSubjects() {
  return prisma.subject.findMany({ include: subjectInclude, orderBy: { name: "asc" } });
}

export function createSubject(input: SubjectInput) {
  return prisma.subject.create({
    data: { name: input.name, description: input.description ?? null },
    include: subjectInclude,
  });
}

export function updateSubject(id: string, input: UpdateSubjectInput) {
  return prisma.subject.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    include: subjectInclude,
  });
}

export async function deleteSubject(id: string) {
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { _count: { select: { students: true } } },
  });
  if (!subject) throw notFound("Subject not found");
  if (subject._count.students > 0) {
    throw conflict("Cannot delete a subject that has students enrolled. Move them first.");
  }
  await prisma.subject.delete({ where: { id } });
}
