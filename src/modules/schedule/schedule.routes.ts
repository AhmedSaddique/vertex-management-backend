import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./schedule.controller";

export const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

scheduleRouter.get("/", ctrl.list);
scheduleRouter.post("/", requireAdmin, ctrl.create);
scheduleRouter.get("/:id", ctrl.getOne);
scheduleRouter.put("/:id", requireAdmin, ctrl.update);
scheduleRouter.put("/:id/students", requireAdmin, ctrl.setStudents);
scheduleRouter.delete("/:id", requireAdmin, ctrl.remove);
