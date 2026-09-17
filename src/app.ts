import type { IncomingMessage, ServerResponse } from "node:http";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./common/middleware/error.middleware";
import { isAllowedOrigin } from "./common/utils/origin";
import { prisma } from "./database/prisma";
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

  const info = (_req: express.Request, res: express.Response) => {
    res.json({
      ok: true,
      service: "vertex-management-api",
      health: "/api/health",
      endpoints: ["/api/auth/login", "/api/students", "/api/payments", "/api/partners", "/api/expenses", "/api/installments/due", "/api/schedule", "/api/dashboard"],
    });
  };
  app.get("/", info);
  app.get("/api", info);

  // Reports configuration and whether the database is reachable and seeded, so a broken
  // deployment can be diagnosed without reading server logs.
  app.get("/api/health", async (_req, res) => {
    let database = env.databaseConfigured ? "configured" : "MISSING - set DATABASE_URL";
    let seeded: boolean | null = null;
    if (env.databaseConfigured) {
      try {
        seeded = (await prisma.user.count()) > 0;
        database = "connected";
      } catch (err) {
        // Only the Prisma error code, never the message: it can contain the database host.
        const code = (err as { code?: string }).code;
        database = code ? `unreachable (${code})` : "unreachable";
      }
    }
    res.json({
      ok: true,
      service: "vertex-management-api",
      time: new Date().toISOString(),
      env: env.nodeEnv,
      database,
      databaseFrom: env.databaseUrlFrom ?? "none",
      accounts: seeded === null ? "unknown" : seeded ? "present" : "NONE - run the seed",
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

/**
 * Default export for serverless hosting (Vercel).
 *
 * Vercel bundles api/index.ts together with the modules it imports, and can resolve this
 * file as the function entry point. Without a default export that request fails with
 * "Invalid export found in module src/app.js", so export the app as a request handler here
 * too. The app is created once per warm instance.
 */
let cachedApp: ReturnType<typeof createApp> | undefined;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  cachedApp ??= createApp();
  const callable = cachedApp as unknown as (a: IncomingMessage, b: ServerResponse) => void;
  return callable(req, res);
}
