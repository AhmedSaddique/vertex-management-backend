import { z } from "zod";

const percentSchema = z.coerce.number().min(0).max(100);

export const createTeacherSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().trim().max(30).optional().nullable(),
  defaultCommissionPercent: percentSchema.default(30),
  subjectIds: z.array(z.string()).default([]),
});

export const updateTeacherSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().nullable(),
  defaultCommissionPercent: percentSchema.optional(),
  subjectIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
