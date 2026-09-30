import { z } from "zod";

export const createLoanSchema = z
  .object({
    // Either pick a member, or type any other borrower name.
    partnerId: z.string().optional().nullable(),
    borrowerName: z.string().trim().max(100).optional().nullable(),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    takenAt: z.coerce.date().optional(),
    reason: z.string().trim().max(200).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => Boolean(v.partnerId) || Boolean(v.borrowerName), {
    message: "Choose a member or type who is taking the money",
    path: ["borrowerName"],
  });

export const updateLoanSchema = z.object({
  partnerId: z.string().optional().nullable(),
  borrowerName: z.string().trim().min(1).max(100).optional(),
  amount: z.coerce.number().positive().optional(),
  takenAt: z.coerce.date().optional(),
  reason: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const repaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paidAt: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional().nullable(),
});

export const clearSchema = z.object({
  paidAt: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional().nullable(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type RepaymentInput = z.infer<typeof repaymentSchema>;

export const LOAN_STATUSES = ["OPEN", "PARTIAL", "CLEARED"] as const;
export type LoanStatusValue = (typeof LOAN_STATUSES)[number];

export interface LoanFilters {
  partnerId?: string;
  status?: LoanStatusValue;
}
