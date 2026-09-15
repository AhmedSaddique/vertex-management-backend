import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./teachers.controller";

export const teachersRouter = Router();
teachersRouter.use(requireAuth);

teachersRouter.get("/", ctrl.list);
teachersRouter.post("/", requireAdmin, ctrl.create);
teachersRouter.get("/:id", ctrl.getOne);
teachersRouter.get("/:id/summary", ctrl.summary);
teachersRouter.put("/:id", requireAdmin, ctrl.update);
teachersRouter.delete("/:id", requireAdmin, ctrl.remove);
