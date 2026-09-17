import dotenv from "dotenv";

dotenv.config();

// Local frontend + the production frontend on Vercel. Override with CORS_ORIGIN (comma separated,
// "*" wildcards allowed, e.g. https://vertex-management-frontend-*.vercel.app for preview builds).
const DEFAULT_CORS = "http://localhost:3000,https://vertexmanagement.vercel.app";

/**
 * Prisma reads process.env.DATABASE_URL (see prisma/schema.prisma). Hosting integrations and
 * custom setups often supply the connection string under a different name, so accept the
 * common aliases and copy the first match into DATABASE_URL before any client is created.
 * POSTGRES_PRISMA_URL comes first because Vercel Postgres marks it as the pooled, Prisma-ready one.
 */
const DATABASE_URL_ALIASES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "VERTEX_DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_POSTGRES_URL",
] as const;

function resolveDatabaseUrl(): string | undefined {
  for (const name of DATABASE_URL_ALIASES) {
    const value = process.env[name]?.trim();
    if (value) {
      if (name !== "DATABASE_URL") process.env.DATABASE_URL = value;
      return name;
    }
  }
  return undefined;
}

// Only the variable name is kept, never the connection string itself.
const databaseUrlFrom = resolveDatabaseUrl();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  databaseConfigured: Boolean(databaseUrlFrom),
  databaseUrlFrom,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtSecretIsDefault: !process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigins: (process.env.CORS_ORIGIN || DEFAULT_CORS)
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  isProd: process.env.NODE_ENV === "production",
};
