import type { Request, Response } from "express";
import { resolveTeacherScope } from "../../common/middleware/auth.middleware";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { createTeacherSchema, updateTeacherSchema } from "./teachers.schema";
import * as service from "./teachers.service";

// Admin sees every teacher; a teacher only sees themselves.
export async function list(req: Request, res: Response) {
  const scope = resolveTeacherScope(req);
  res.json(serialize(await service.listTeachers(scope)));
}

export async function getOne(req: Request, res: Response) {
  const id = resolveTeacherScope(req, param(req)) ?? param(req);
  res.json(serialize(await service.getTeacher(id)));
}

// The teacher account page: totals, students, payouts, payments and monthly view.
export async function summary(req: Request, res: Response) {
  const id = resolveTeacherScope(req, param(req)) ?? param(req);
  res.json(serialize(await service.getTeacherSummary(id)));
}

export async function create(req: Request, res: Response) {
  const input = createTeacherSchema.parse(req.body);
  res.status(201).json(serialize(await service.createTeacher(input)));
}

export async function update(req: Request, res: Response) {
  const input = updateTeacherSchema.parse(req.body);
  res.json(serialize(await service.updateTeacher(param(req), input)));
}

export async function remove(req: Request, res: Response) {
  await service.deleteTeacher(param(req));
  res.json({ ok: true });
}
