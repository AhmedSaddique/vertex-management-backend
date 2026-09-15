import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./subjects.controller";

export const subjectsRouter = Router();
subjectsRouter.use(requireAuth);

subjectsRouter.get("/", ctrl.list);
subjectsRouter.post("/", requireAdmin, ctrl.create);
subjectsRouter.put("/:id", requireAdmin, ctrl.update);
subjectsRouter.delete("/:id", requireAdmin, ctrl.remove);
