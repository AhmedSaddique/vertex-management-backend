import type { Request, Response } from "express";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { createTradingPayoutSchema, tradingDefaultsSchema, updateTradingPayoutSchema } from "./trading.schema";
import * as service from "./trading.service";

const qs = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export async function list(req: Request, res: Response) {
  res.json(serialize(await service.listTradingPayouts({ from: qs(req.query.from), to: qs(req.query.to) })));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(serialize(await service.createTradingPayout(createTradingPayoutSchema.parse(req.body))));
}

export async function update(req: Request, res: Response) {
  res.json(serialize(await service.updateTradingPayout(param(req), updateTradingPayoutSchema.parse(req.body))));
}

export async function remove(req: Request, res: Response) {
  await service.deleteTradingPayout(param(req));
  res.json({ ok: true });
}

export async function getDefaults(_req: Request, res: Response) {
  res.json(serialize(await service.getDefaults()));
}

export async function setDefaults(req: Request, res: Response) {
  res.json(serialize(await service.setDefaults(tradingDefaultsSchema.parse(req.body))));
}
