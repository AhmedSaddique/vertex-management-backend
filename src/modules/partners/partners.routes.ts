import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./partners.controller";

export const partnersRouter = Router();
partnersRouter.use(requireAuth);

partnersRouter.get("/", ctrl.list);
partnersRouter.post("/", requireAdmin, ctrl.create);
partnersRouter.get("/:id", ctrl.getOne);
partnersRouter.get("/:id/summary", ctrl.summary);
partnersRouter.put("/:id", requireAdmin, ctrl.update);
partnersRouter.delete("/:id", requireAdmin, ctrl.remove);
