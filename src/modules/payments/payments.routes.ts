import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./payments.controller";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.get("/", ctrl.list);
paymentsRouter.post("/", requireAdmin, ctrl.create);
paymentsRouter.put("/:id", requireAdmin, ctrl.update);
paymentsRouter.delete("/:id", requireAdmin, ctrl.remove);
