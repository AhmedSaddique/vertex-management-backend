import type { Request, Response } from "express";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { LOAN_STATUSES, clearSchema, createLoanSchema, repaymentSchema, updateLoanSchema, type LoanStatusValue } from "./loans.schema";
import * as service from "./loans.service";

const qs = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export async function list(req: Request, res: Response) {
  const statusRaw = qs(req.query.status)?.toUpperCase();
  res.json(
    serialize(
      await service.listLoans({
        partnerId: qs(req.query.partnerId),
        status: LOAN_STATUSES.includes(statusRaw as LoanStatusValue) ? (statusRaw as LoanStatusValue) : undefined,
      }),
    ),
  );
}

export async function getOne(req: Request, res: Response) {
  res.json(serialize(await service.getLoan(param(req))));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(serialize(await service.createLoan(createLoanSchema.parse(req.body))));
}

export async function update(req: Request, res: Response) {
  res.json(serialize(await service.updateLoan(param(req), updateLoanSchema.parse(req.body))));
}

export async function remove(req: Request, res: Response) {
  await service.deleteLoan(param(req));
  res.json({ ok: true });
}

export async function addRepayment(req: Request, res: Response) {
  res.status(201).json(serialize(await service.addRepayment(param(req), repaymentSchema.parse(req.body))));
}

export async function clear(req: Request, res: Response) {
  res.json(serialize(await service.clearLoan(param(req), clearSchema.parse(req.body ?? {}))));
}

export async function removeRepayment(req: Request, res: Response) {
  res.json(serialize(await service.deleteRepayment(param(req, "repaymentId"))));
}
