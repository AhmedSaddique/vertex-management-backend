import type { Request, Response } from "express";
import { serialize } from "../../common/utils/money";
import * as service from "./dashboard.service";

export async function overview(_req: Request, res: Response) {
  res.json(serialize(await service.getOverview()));
}
