import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./settings.controller";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/time-slots", ctrl.getTimeSlots);
settingsRouter.put("/time-slots", requireAdmin, ctrl.setTimeSlots);
