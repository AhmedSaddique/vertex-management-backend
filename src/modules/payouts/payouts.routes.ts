import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./payouts.controller";

export const payoutsRouter = Router();
payoutsRouter.use(requireAuth);

payoutsRouter.get("/", ctrl.list);
payoutsRouter.post("/", requireAdmin, ctrl.create);
payoutsRouter.put("/:id", requireAdmin, ctrl.update);
payoutsRouter.delete("/:id", requireAdmin, ctrl.remove);
