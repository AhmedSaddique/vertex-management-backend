import type { Request, Response } from "express";
import { resolveTeacherScope } from "../../common/middleware/auth.middleware";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { STUDENT_STATUSES, studentSchema, updateStudentSchema, type StudentStatusValue } from "./students.schema";
import * as service from "./students.service";

const qs = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// GET /api/students?search=&subjectId=&teacherId=&status=
export async function list(req: Request, res: Response) {
  const statusRaw = qs(req.query.status);
  const result = await service.listStudents({
    teacherId: resolveTeacherScope(req, qs(req.query.teacherId)),
    subjectId: qs(req.query.subjectId),
    search: qs(req.query.search),
    status: STUDENT_STATUSES.includes(statusRaw as StudentStatusValue)
      ? (statusRaw as StudentStatusValue)
      : undefined,
  });
  res.json(serialize(result));
}

export async function getOne(req: Request, res: Response) {
  const scope = resolveTeacherScope(req);
  res.json(serialize(await service.getStudent(param(req), scope)));
}

export async function create(req: Request, res: Response) {
  const input = studentSchema.parse(req.body);
  res.status(201).json(serialize(await service.createStudent(input)));
}

export async function update(req: Request, res: Response) {
  const input = updateStudentSchema.parse(req.body);
  res.json(serialize(await service.updateStudent(param(req), input)));
}

export async function remove(req: Request, res: Response) {
  await service.deleteStudent(param(req));
  res.json({ ok: true });
}
