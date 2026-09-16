import { z } from "zod";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "ONLINE", "OTHER"] as const;

export const createPaymentSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(PAYMENT_METHODS).default("CASH"),
  note: z.string().trim().max(500).optional().nullable(),
  paidAt: z.coerce.date().optional(),
  // Apply the payment to a promised installment. If it does not cover it fully and
  // nextDueDate is given, the remainder is moved to a new installment on that date.
  installmentId: z.string().optional().nullable(),
  nextDueDate: z.coerce.date().optional().nullable(),
});

export const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  note: z.string().trim().max(500).optional().nullable(),
  paidAt: z.coerce.date().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export interface PaymentFilters {
  teacherId?: string;
  studentId?: string;
  method?: PaymentMethodValue;
  from?: string;
  to?: string;
}
