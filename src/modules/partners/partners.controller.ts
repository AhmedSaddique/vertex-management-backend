import type { Request, Response } from "express";
import { resolvePartnerScope } from "../../common/middleware/auth.middleware";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { createPartnerSchema, updatePartnerSchema } from "./partners.schema";
import * as service from "./partners.service";

// Admin sees every partner; a teacher login only sees their own partner account.
export async function list(req: Request, res: Response) {
  const scope = resolvePartnerScope(req);
  res.json(serialize(await service.listPartners(scope)));
}

export async function getOne(req: Request, res: Response) {
  const id = resolvePartnerScope(req, param(req)) ?? param(req);
  res.json(serialize(await service.getPartner(id)));
}

// The partner account page: totals, students with their share, payouts, recent shares, monthly.
export async function summary(req: Request, res: Response) {
  const id = resolvePartnerScope(req, param(req)) ?? param(req);
  res.json(serialize(await service.getPartnerSummary(id)));
}

export async function create(req: Request, res: Response) {
  const input = createPartnerSchema.parse(req.body);
  res.status(201).json(serialize(await service.createPartner(input)));
}

export async function update(req: Request, res: Response) {
  const input = updatePartnerSchema.parse(req.body);
  res.json(serialize(await service.updatePartner(param(req), input)));
}

export async function remove(req: Request, res: Response) {
  await service.deletePartner(param(req));
  res.json({ ok: true });
}
