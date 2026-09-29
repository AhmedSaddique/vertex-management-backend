import { z } from "zod";

const shareInput = z.object({
  partnerId: z.string().min(1),
  percent: z.coerce.number().min(0).max(100),
});

export const createTradingPayoutSchema = z.object({
  title: z.string().trim().max(120).optional().nullable(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  occurredAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().nullable(),
  // Omitted means: use the saved default split.
  shares: z.array(shareInput).max(20).optional(),
});

export const updateTradingPayoutSchema = createTradingPayoutSchema.partial();

export const tradingDefaultsSchema = z.object({ shares: z.array(shareInput).max(20) });

export type CreateTradingPayoutInput = z.infer<typeof createTradingPayoutSchema>;
export type UpdateTradingPayoutInput = z.infer<typeof updateTradingPayoutSchema>;
export type TradingDefaultsInput = z.infer<typeof tradingDefaultsSchema>;

export interface TradingFilters {
  from?: string;
  to?: string;
}
