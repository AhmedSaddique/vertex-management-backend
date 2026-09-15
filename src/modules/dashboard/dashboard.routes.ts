import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./dashboard.controller";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireAdmin);

dashboardRouter.get("/", ctrl.overview);
