import { z } from "zod";

export const createPayoutSchema = z.object({
  teacherId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  note: z.string().trim().max(500).optional().nullable(),
  paidAt: z.coerce.date().optional(),
});

export const updatePayoutSchema = createPayoutSchema.omit({ teacherId: true }).partial();

export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;
export type UpdatePayoutInput = z.infer<typeof updatePayoutSchema>;
