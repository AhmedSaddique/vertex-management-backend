import { z } from "zod";

export const createInstallmentSchema = z.object({
  studentId: z.string().min(1),
  dueDate: z.coerce.date(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  note: z.string().trim().max(300).optional().nullable(),
});

export const updateInstallmentSchema = z.object({
  dueDate: z.coerce.date().optional(),
  amount: z.coerce.number().positive().optional(),
  note: z.string().trim().max(300).optional().nullable(),
});

export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;
export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;
