import type { Request, Response } from "express";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { shareDefaultsSchema, subjectSchema, updateSubjectSchema } from "./subjects.schema";
import * as service from "./subjects.service";

export async function list(_req: Request, res: Response) {
  res.json(serialize(await service.listSubjects()));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(serialize(await service.createSubject(subjectSchema.parse(req.body))));
}

export async function update(req: Request, res: Response) {
  res.json(serialize(await service.updateSubject(param(req), updateSubjectSchema.parse(req.body))));
}

export async function setShareDefaults(req: Request, res: Response) {
  res.json(serialize(await service.setShareDefaults(param(req), shareDefaultsSchema.parse(req.body))));
}

export async function remove(req: Request, res: Response) {
  await service.deleteSubject(param(req));
  res.json({ ok: true });
}
