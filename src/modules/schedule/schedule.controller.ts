import type { Request, Response } from "express";
import { resolveTeacherScope } from "../../common/middleware/auth.middleware";
import { param } from "../../common/utils/params";
import { serialize } from "../../common/utils/money";
import { WEEKDAYS, createSlotSchema, setStudentsSchema, updateSlotSchema, type WeekdayValue } from "./schedule.schema";
import * as service from "./schedule.service";

const qs = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// GET /api/schedule?teacherId=&subjectId=&day=MON&active=true
export async function list(req: Request, res: Response) {
  const dayRaw = qs(req.query.day)?.toUpperCase();
  const slots = await service.listSlots({
    teacherId: resolveTeacherScope(req, qs(req.query.teacherId)),
    subjectId: qs(req.query.subjectId),
    day: WEEKDAYS.includes(dayRaw as WeekdayValue) ? (dayRaw as WeekdayValue) : undefined,
    activeOnly: qs(req.query.active) === "true",
  });
  res.json(serialize(slots));
}

export async function getOne(req: Request, res: Response) {
  const scope = resolveTeacherScope(req);
  res.json(serialize(await service.getSlot(param(req), scope)));
}

export async function create(req: Request, res: Response) {
  const input = createSlotSchema.parse(req.body);
  res.status(201).json(serialize(await service.createSlot(input)));
}

export async function update(req: Request, res: Response) {
  const input = updateSlotSchema.parse(req.body);
  res.json(serialize(await service.updateSlot(param(req), input)));
}

export async function setStudents(req: Request, res: Response) {
  const { studentIds } = setStudentsSchema.parse(req.body);
  res.json(serialize(await service.setSlotStudents(param(req), studentIds)));
}

export async function remove(req: Request, res: Response) {
  await service.deleteSlot(param(req));
  res.json({ ok: true });
}
