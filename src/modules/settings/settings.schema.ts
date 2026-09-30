import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM (24h) format");

export const timeSlotSchema = z
  .object({ start: time, end: time })
  .refine((s) => s.end > s.start, { message: "End time must be after start time", path: ["end"] });

export const timeSlotsSchema = z.object({
  slots: z.array(timeSlotSchema).min(1, "Add at least one time slot").max(24),
});

export type TimeSlot = z.infer<typeof timeSlotSchema>;

// Lectures run 1.5 hours from 2:30 PM, with a final one hour class from 10 PM.
// Admin can change these from Settings.
export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { start: "14:30", end: "16:00" },
  { start: "16:00", end: "17:30" },
  { start: "17:30", end: "19:00" },
  { start: "19:00", end: "20:30" },
  { start: "20:30", end: "22:00" },
  { start: "22:00", end: "23:00" },
];
