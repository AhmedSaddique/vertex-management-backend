import type { Request, Response } from "express";
import { resolveTeacherScope } from "../../common/middleware/auth.middleware";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { PAYMENT_METHODS, createPaymentSchema, updatePaymentSchema, type PaymentMethodValue } from "./payments.schema";
import * as service from "./payments.service";

const qs = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// GET /api/payments?teacherId=&studentId=&from=&to=&method=
export async function list(req: Request, res: Response) {
  const methodRaw = qs(req.query.method);
  const result = await service.listPayments({
    teacherId: resolveTeacherScope(req, qs(req.query.teacherId)),
    studentId: qs(req.query.studentId),
    from: qs(req.query.from),
    to: qs(req.query.to),
    method: PAYMENT_METHODS.includes(methodRaw as PaymentMethodValue)
      ? (methodRaw as PaymentMethodValue)
      : undefined,
  });
  res.json(serialize(result));
}

export async function create(req: Request, res: Response) {
  const input = createPaymentSchema.parse(req.body);
  res.status(201).json(serialize(await service.createPayment(input)));
}

export async function update(req: Request, res: Response) {
  const input = updatePaymentSchema.parse(req.body);
  res.json(serialize(await service.updatePayment(param(req), input)));
}

export async function remove(req: Request, res: Response) {
  await service.deletePayment(param(req));
  res.json({ ok: true });
}
