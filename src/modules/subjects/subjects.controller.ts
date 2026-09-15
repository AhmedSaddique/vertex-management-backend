import type { Request, Response } from "express";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { subjectSchema, updateSubjectSchema } from "./subjects.schema";
import * as service from "./subjects.service";

export async function list(_req: Request, res: Response) {
  res.json(serialize(await service.listSubjects()));
}

export async function create(req: Request, res: Response) {
  const input = subjectSchema.parse(req.body);
  res.status(201).json(serialize(await service.createSubject(input)));
}

export async function update(req: Request, res: Response) {
  const input = updateSubjectSchema.parse(req.body);
  res.json(serialize(await service.updateSubject(param(req), input)));
}

export async function remove(req: Request, res: Response) {
  await service.deleteSubject(param(req));
  res.json({ ok: true });
}
