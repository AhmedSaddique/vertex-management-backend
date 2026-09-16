import type { Request, Response } from "express";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { expenseSchema, updateExpenseSchema } from "./expenses.schema";
import * as service from "./expenses.service";

const qs = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export async function list(req: Request, res: Response) {
  res.json(serialize(await service.listExpenses({ from: qs(req.query.from), to: qs(req.query.to), category: qs(req.query.category), search: qs(req.query.search) })));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(serialize(await service.createExpense(expenseSchema.parse(req.body))));
}

export async function update(req: Request, res: Response) {
  res.json(serialize(await service.updateExpense(param(req), updateExpenseSchema.parse(req.body))));
}

export async function remove(req: Request, res: Response) {
  await service.deleteExpense(param(req));
  res.json({ ok: true });
}
