import { z } from "zod";

export const expenseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  category: z.string().trim().max(60).optional().nullable(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  spentAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const updateExpenseSchema = expenseSchema.partial();

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export interface ExpenseFilters {
  from?: string;
  to?: string;
  category?: string;
  search?: string;
}
