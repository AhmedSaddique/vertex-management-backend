import { Router } from "express";
import { requireAdmin, requireAuth } from "../../common/middleware/auth.middleware";
import * as ctrl from "./trading.controller";

// Trading income is management information, so the whole module is admin only.
// Each partner still sees their own trading earnings on their account page.
export const tradingRouter = Router();
tradingRouter.use(requireAuth, requireAdmin);

tradingRouter.get("/defaults", ctrl.getDefaults);
tradingRouter.put("/defaults", ctrl.setDefaults);
tradingRouter.get("/", ctrl.list);
tradingRouter.post("/", ctrl.create);
tradingRouter.put("/:id", ctrl.update);
tradingRouter.delete("/:id", ctrl.remove);
