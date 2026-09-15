import type { Request, Response } from "express";
import { timeSlotsSchema } from "./settings.schema";
import * as service from "./settings.service";

export async function getTimeSlots(_req: Request, res: Response) {
  res.json({ slots: await service.getTimeSlots() });
}

export async function setTimeSlots(req: Request, res: Response) {
  const { slots } = timeSlotsSchema.parse(req.body);
  res.json({ slots: await service.setTimeSlots(slots) });
}
