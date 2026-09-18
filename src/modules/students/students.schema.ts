import { z } from "zod";

export const STUDENT_STATUSES = ["ACTIVE", "COMPLETED", "DROPPED"] as const;
export const CLASS_MODES = ["PHYSICAL", "ONLINE", "HYBRID"] as const;

// "HH:MM-HH:MM" availability key, matching the fixed time slots in Settings.
const slotKeyPattern = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

export const shareInputSchema = z.object({
  partnerId: z.string().min(1),
  percent: z.coerce.number().min(0).max(100),
});

export const installmentInputSchema = z.object({
  dueDate: z.coerce.date(),
  amount: z.coerce.number().positive("Installment amount must be greater than 0"),
  note: z.string().trim().max(300).optional().nullable(),
});

export const studentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  fatherName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().min(3, "Phone is required").max(30),
  fatherPhone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  address: z.string().trim().max(300).optional().nullable(),
  subjectId: z.string().min(1, "Subject is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  fee: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  status: z.enum(STUDENT_STATUSES).default("ACTIVE"),
  classMode: z.enum(CLASS_MODES).default("PHYSICAL"),
  enrolledAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  availableSlots: z
    .array(z.string().regex(slotKeyPattern, "Slot must look like 15:00-16:30"))
    .max(24)
    .optional(),
  // Fee split between partners; omitted on create = subject defaults. Company keeps the rest.
  shares: z.array(shareInputSchema).max(20).optional(),
  // Promised payment dates (only used on create; manage later via /installments).
  installments: z.array(installmentInputSchema).max(24).optional(),
});

export const updateStudentSchema = studentSchema.partial();

export type StudentInput = z.infer<typeof studentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentStatusValue = (typeof STUDENT_STATUSES)[number];
export type ClassModeValue = (typeof CLASS_MODES)[number];

export interface StudentFilters {
  teacherId?: string;
  subjectId?: string;
  status?: StudentStatusValue;
  classMode?: ClassModeValue;
  search?: string;
}
