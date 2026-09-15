import { z } from "zod";

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type WeekdayValue = (typeof WEEKDAYS)[number];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM (24h) format");

const slotBase = z.object({
  title: z.string().trim().max(100).optional().nullable(),
  teacherId: z.string().min(1, "Teacher is required"),
  subjectId: z.string().min(1, "Subject is required"),
  days: z.array(z.enum(WEEKDAYS)).min(1, "Pick at least one day"),
  startTime: time,
  endTime: time,
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  studentIds: z.array(z.string()).optional(),
});

const endAfterStart = (d: { startTime?: string; endTime?: string }, ctx: z.RefinementCtx) => {
  if (d.startTime && d.endTime && d.endTime <= d.startTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "End time must be after start time" });
  }
};

export const createSlotSchema = slotBase.superRefine(endAfterStart);
export const updateSlotSchema = slotBase.partial().superRefine(endAfterStart);
export const setStudentsSchema = z.object({ studentIds: z.array(z.string()) });

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;

export interface SlotFilters {
  teacherId?: string;
  subjectId?: string;
  day?: WeekdayValue;
  activeOnly?: boolean;
}
