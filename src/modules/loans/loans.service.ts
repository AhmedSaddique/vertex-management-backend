import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest, notFound } from "../../common/utils/errors";
import { num, round2 } from "../../common/utils/money";
import type { CreateLoanInput, LoanFilters, RepaymentInput, UpdateLoanInput } from "./loans.schema";

export const loanInclude = {
  partner: { select: { id: true, name: true, kind: true } },
  repayments: { orderBy: { paidAt: "desc" } },
} as const satisfies Prisma.CompanyLoanInclude;

type Loaded = Prisma.CompanyLoanGetPayload<{ include: typeof loanInclude }>;

/** Adds repaid, outstanding and a status derived from them. */
export function shapeLoan(loan: Loaded) {
  const amount = num(loan.amount);
  const repaid = round2(loan.repayments.reduce((a, r) => a + num(r.amount), 0));
  const outstanding = round2(amount - repaid);
  const status = outstanding <= 0 ? "CLEARED" : repaid > 0 ? "PARTIAL" : "OPEN";
  return { ...loan, amount, repaid, outstanding: Math.max(0, outstanding), status };
}

export async function listLoans(f: LoanFilters) {
  const loans = await prisma.companyLoan.findMany({
    where: { ...(f.partnerId ? { partnerId: f.partnerId } : {}) },
    include: loanInclude,
    orderBy: { takenAt: "desc" },
  });
  const rows = loans.map(shapeLoan).filter((l) => !f.status || l.status === f.status);

  // One line per borrower so it is obvious who still owes the company.
  const byBorrower = new Map<string, { key: string; name: string; partnerId: string | null; taken: number; repaid: number; outstanding: number }>();
  for (const l of rows) {
    const key = l.partnerId ?? l.borrowerName.toLowerCase();
    const current = byBorrower.get(key) ?? {
      key,
      name: l.partner?.name ?? l.borrowerName,
      partnerId: l.partnerId,
      taken: 0,
      repaid: 0,
      outstanding: 0,
    };
    current.taken = round2(current.taken + l.amount);
    current.repaid = round2(current.repaid + l.repaid);
    current.outstanding = round2(current.outstanding + l.outstanding);
    byBorrower.set(key, current);
  }

  return {
    loans: rows,
    summary: {
      count: rows.length,
      taken: round2(rows.reduce((a, l) => a + l.amount, 0)),
      repaid: round2(rows.reduce((a, l) => a + l.repaid, 0)),
      outstanding: round2(rows.reduce((a, l) => a + l.outstanding, 0)),
      openCount: rows.filter((l) => l.status !== "CLEARED").length,
      byBorrower: [...byBorrower.values()].sort((a, b) => b.outstanding - a.outstanding),
    },
  };
}

export async function getLoan(id: string) {
  const loan = await prisma.companyLoan.findUnique({ where: { id }, include: loanInclude });
  if (!loan) throw notFound("Loan not found");
  return shapeLoan(loan);
}

export async function createLoan(input: CreateLoanInput) {
  let borrowerName = input.borrowerName?.trim() ?? "";
  if (input.partnerId) {
    const partner = await prisma.partner.findUnique({ where: { id: input.partnerId } });
    if (!partner) throw badRequest("Selected member does not exist");
    borrowerName = borrowerName || partner.name;
  }
  const loan = await prisma.companyLoan.create({
    data: {
      partnerId: input.partnerId || null,
      borrowerName,
      amount: input.amount,
      takenAt: input.takenAt ?? new Date(),
      reason: input.reason || null,
      note: input.note || null,
    },
    include: loanInclude,
  });
  return shapeLoan(loan);
}

export async function updateLoan(id: string, input: UpdateLoanInput) {
  const existing = await prisma.companyLoan.findUnique({ where: { id }, include: { repayments: true } });
  if (!existing) throw notFound("Loan not found");

  if (input.amount !== undefined) {
    const repaid = round2(existing.repayments.reduce((a, r) => a + num(r.amount), 0));
    if (input.amount < repaid) throw badRequest(`Amount cannot be less than the ${repaid} already paid back`);
  }
  let borrowerName = input.borrowerName;
  if (input.partnerId) {
    const partner = await prisma.partner.findUnique({ where: { id: input.partnerId } });
    if (!partner) throw badRequest("Selected member does not exist");
    borrowerName = borrowerName || partner.name;
  }

  const loan = await prisma.companyLoan.update({
    where: { id },
    data: {
      ...(input.partnerId !== undefined ? { partnerId: input.partnerId || null } : {}),
      ...(borrowerName !== undefined ? { borrowerName } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.takenAt !== undefined ? { takenAt: input.takenAt } : {}),
      ...(input.reason !== undefined ? { reason: input.reason || null } : {}),
      ...(input.note !== undefined ? { note: input.note || null } : {}),
    },
    include: loanInclude,
  });
  return shapeLoan(loan);
}

export async function deleteLoan(id: string) {
  await prisma.companyLoan.delete({ where: { id } });
}

/** Money paid back into the company. Cannot exceed what is still outstanding. */
export async function addRepayment(loanId: string, input: RepaymentInput) {
  const loan = await prisma.companyLoan.findUnique({ where: { id: loanId }, include: { repayments: true } });
  if (!loan) throw notFound("Loan not found");

  const repaid = round2(loan.repayments.reduce((a, r) => a + num(r.amount), 0));
  const outstanding = round2(num(loan.amount) - repaid);
  if (outstanding <= 0) throw badRequest("This loan is already cleared");
  if (input.amount > outstanding) throw badRequest(`That is more than the ${outstanding} still outstanding`);

  await prisma.loanRepayment.create({
    data: { loanId, amount: input.amount, paidAt: input.paidAt ?? new Date(), note: input.note || null },
  });
  return getLoan(loanId);
}

/** Clears the whole remaining balance in one go. */
export async function clearLoan(loanId: string, input: { paidAt?: Date; note?: string | null }) {
  const loan = await prisma.companyLoan.findUnique({ where: { id: loanId }, include: { repayments: true } });
  if (!loan) throw notFound("Loan not found");
  const repaid = round2(loan.repayments.reduce((a, r) => a + num(r.amount), 0));
  const outstanding = round2(num(loan.amount) - repaid);
  if (outstanding <= 0) throw badRequest("This loan is already cleared");
  return addRepayment(loanId, { amount: outstanding, paidAt: input.paidAt, note: input.note ?? "Cleared in full" });
}

export async function deleteRepayment(id: string) {
  const repayment = await prisma.loanRepayment.findUnique({ where: { id } });
  if (!repayment) throw notFound("Repayment not found");
  await prisma.loanRepayment.delete({ where: { id } });
  return getLoan(repayment.loanId);
}

/** Total still owed to the company, used by the company cash figure. */
export async function outstandingTotal(): Promise<number> {
  const [loanAgg, repaidAgg] = await Promise.all([
    prisma.companyLoan.aggregate({ _sum: { amount: true } }),
    prisma.loanRepayment.aggregate({ _sum: { amount: true } }),
  ]);
  return round2(num(loanAgg._sum.amount) - num(repaidAgg._sum.amount));
}
