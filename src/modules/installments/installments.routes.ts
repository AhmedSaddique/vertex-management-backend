import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./installments.controller";

export const installmentsRouter = Router();
installmentsRouter.use(requireAuth);

installmentsRouter.get("/due", ctrl.due);
installmentsRouter.get("/", ctrl.list);
installmentsRouter.post("/", requireAdmin, ctrl.create);
installmentsRouter.put("/:id", requireAdmin, ctrl.update);
installmentsRouter.delete("/:id", requireAdmin, ctrl.remove);
