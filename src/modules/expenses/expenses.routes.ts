import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./expenses.controller";

// Company expenses are management-only.
export const expensesRouter = Router();
expensesRouter.use(requireAuth, requireAdmin);

expensesRouter.get("/", ctrl.list);
expensesRouter.post("/", ctrl.create);
expensesRouter.put("/:id", ctrl.update);
expensesRouter.delete("/:id", ctrl.remove);
