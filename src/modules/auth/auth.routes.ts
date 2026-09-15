import { Router } from "express";
import { requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", ctrl.login);
authRouter.get("/me", requireAuth, ctrl.me);
authRouter.post("/change-password", requireAuth, ctrl.changePassword);
