import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./loans.controller";

// Company money lent out temporarily. Management only.
export const loansRouter = Router();
loansRouter.use(requireAuth, requireAdmin);

loansRouter.get("/", ctrl.list);
loansRouter.post("/", ctrl.create);
loansRouter.get("/:id", ctrl.getOne);
loansRouter.put("/:id", ctrl.update);
loansRouter.delete("/:id", ctrl.remove);
loansRouter.post("/:id/repayments", ctrl.addRepayment);
loansRouter.post("/:id/clear", ctrl.clear);
loansRouter.delete("/repayments/:repaymentId", ctrl.removeRepayment);
