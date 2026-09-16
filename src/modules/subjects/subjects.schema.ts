import { z } from "zod";

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).optional().nullable(),
});

export const updateSubjectSchema = subjectSchema.partial();

export const shareDefaultsSchema = z.object({
  shares: z.array(z.object({ partnerId: z.string().min(1), percent: z.coerce.number().min(0).max(100) })).max(20),
});

export type SubjectInput = z.infer<typeof subjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type ShareDefaultsInput = z.infer<typeof shareDefaultsSchema>;
