import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM (24h) format");

export const timeSlotSchema = z
  .object({ start: time, end: time })
  .refine((s) => s.end > s.start, { message: "End time must be after start time", path: ["end"] });

export const timeSlotsSchema = z.object({
  slots: z.array(timeSlotSchema).min(1, "Add at least one time slot").max(24),
});

export type TimeSlot = z.infer<typeof timeSlotSchema>;

// 1.5 hour slots from 3:00 PM onwards. Admin can change these from Settings.
export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { start: "15:00", end: "16:30" },
  { start: "16:30", end: "18:00" },
  { start: "18:00", end: "19:30" },
  { start: "19:30", end: "21:00" },
  { start: "21:00", end: "22:30" },
];
