import type { Request, Response } from "express";
import { resolveTeacherScope } from "../../common/middleware/auth.middleware";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { createInstallmentSchema, updateInstallmentSchema } from "./installments.schema";
import * as service from "./installments.service";

// GET /api/installments/due?days=7
export async function due(req: Request, res: Response) {
  const days = Math.min(60, Math.max(0, Number(req.query.days ?? 7) || 7));
  const teacherId = resolveTeacherScope(req);
  res.json(serialize(await service.listDue(days, teacherId)));
}

// GET /api/installments?studentId=
export async function list(req: Request, res: Response) {
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : "";
  if (!studentId) {
    res.status(400).json({ error: "studentId is required" });
    return;
  }
  res.json(serialize(await service.listForStudent(studentId)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(serialize(await service.createInstallment(createInstallmentSchema.parse(req.body))));
}

export async function update(req: Request, res: Response) {
  res.json(serialize(await service.updateInstallment(param(req), updateInstallmentSchema.parse(req.body))));
}

export async function remove(req: Request, res: Response) {
  await service.deleteInstallment(param(req));
  res.json({ ok: true });
}
