import { z } from "zod";

export const createPartnerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  // Teacher partners are created automatically with the teacher; extra partners are management.
  kind: z.enum(["MANAGEMENT"]).default("MANAGEMENT"),
  userId: z.string().optional().nullable(),
});

export const updatePartnerSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
