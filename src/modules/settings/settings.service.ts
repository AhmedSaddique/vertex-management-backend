import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest } from "../../common/utils/errors";
import { DEFAULT_TIME_SLOTS, timeSlotSchema, type TimeSlot } from "./settings.schema";

const TIME_SLOTS_KEY = "timeSlots";

const sortSlots = (slots: TimeSlot[]) => [...slots].sort((a, b) => a.start.localeCompare(b.start));

export async function getTimeSlots(): Promise<TimeSlot[]> {
  const row = await prisma.setting.findUnique({ where: { key: TIME_SLOTS_KEY } });
  const parsed = z.array(timeSlotSchema).safeParse(row?.value);
  return parsed.success && parsed.data.length ? sortSlots(parsed.data) : DEFAULT_TIME_SLOTS;
}

export async function setTimeSlots(slots: TimeSlot[]): Promise<TimeSlot[]> {
  const sorted = sortSlots(slots);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      throw badRequest(`Time slots overlap: ${sorted[i - 1].start}-${sorted[i - 1].end} and ${sorted[i].start}-${sorted[i].end}`);
    }
  }
  await prisma.setting.upsert({
    where: { key: TIME_SLOTS_KEY },
    update: { value: sorted as unknown as Prisma.InputJsonValue },
    create: { key: TIME_SLOTS_KEY, value: sorted as unknown as Prisma.InputJsonValue },
  });
  return sorted;
}
