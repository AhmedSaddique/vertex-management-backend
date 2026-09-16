import type { Request, Response } from "express";
import { resolvePartnerScope } from "../../common/middleware/auth.middleware";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { createPayoutSchema, updatePayoutSchema } from "./payouts.schema";
import * as service from "./payouts.service";

export async function list(req: Request, res: Response) {
  const requested = typeof req.query.partnerId === "string" && req.query.partnerId ? req.query.partnerId : undefined;
  const partnerId = resolvePartnerScope(req, requested);
  res.json(serialize(await service.listPayouts(partnerId)));
}

export async function create(req: Request, res: Response) {
  const input = createPayoutSchema.parse(req.body);
  res.status(201).json(serialize(await service.createPayout(input)));
}

export async function update(req: Request, res: Response) {
  const input = updatePayoutSchema.parse(req.body);
  res.json(serialize(await service.updatePayout(param(req), input)));
}

export async function remove(req: Request, res: Response) {
  res.json(serialize(await service.deletePayout(param(req))));
}
