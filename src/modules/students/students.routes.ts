import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./students.controller";

export const studentsRouter = Router();
studentsRouter.use(requireAuth);

studentsRouter.get("/", ctrl.list);
studentsRouter.post("/", requireAdmin, ctrl.create);
studentsRouter.get("/:id", ctrl.getOne);
studentsRouter.put("/:id", requireAdmin, ctrl.update);
studentsRouter.delete("/:id", requireAdmin, ctrl.remove);
