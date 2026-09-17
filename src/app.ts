import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./common/middleware/error.middleware";
import { isAllowedOrigin } from "./common/utils/origin";
import { authRouter } from "./modules/auth/auth.routes";
import { subjectsRouter } from "./modules/subjects/subjects.routes";
import { teachersRouter } from "./modules/teachers/teachers.routes";
import { partnersRouter } from "./modules/partners/partners.routes";
import { studentsRouter } from "./modules/students/students.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { payoutsRouter } from "./modules/payouts/payouts.routes";
import { expensesRouter } from "./modules/expenses/expenses.routes";
import { installmentsRouter } from "./modules/installments/installments.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { scheduleRouter } from "./modules/schedule/schedule.routes";
import { settingsRouter } from "./modules/settings/settings.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin, env.corsOrigins)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  if (!env.isProd) app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "vertex-management-api",
      time: new Date().toISOString(),
      env: env.nodeEnv,
      database: env.databaseConfigured ? "configured" : "MISSING - set DATABASE_URL",
      jwt: env.jwtSecretIsDefault ? "default secret - set JWT_SECRET" : "configured",
      corsOrigins: env.corsOrigins,
    });
  });

  // Feature modules (src/modules/<name>/): routes -> controller -> service -> Prisma
  app.use("/api/auth", authRouter);
  app.use("/api/subjects", subjectsRouter);
  app.use("/api/teachers", teachersRouter);
  app.use("/api/partners", partnersRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/payouts", payoutsRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/installments", installmentsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/schedule", scheduleRouter);
  app.use("/api/settings", settingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
