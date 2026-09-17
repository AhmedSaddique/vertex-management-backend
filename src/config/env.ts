import dotenv from "dotenv";

dotenv.config();

// Local frontend + the production frontend on Vercel. Override with CORS_ORIGIN (comma separated,
// "*" wildcards allowed, e.g. https://vertex-management-frontend-*.vercel.app for preview builds).
const DEFAULT_CORS = "http://localhost:3000,https://vertexmanagement.vercel.app";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  // Prisma reads DATABASE_URL itself; we only report whether it is configured (see /api/health).
  databaseConfigured: Boolean(process.env.DATABASE_URL),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtSecretIsDefault: !process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigins: (process.env.CORS_ORIGIN || DEFAULT_CORS)
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  isProd: process.env.NODE_ENV === "production",
};
