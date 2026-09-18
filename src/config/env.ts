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

const trimTrailingSlashes = (value: string) => {
  let out = value;
  while (out.endsWith("/")) out = out.slice(0, -1);
  return out;
};

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const smtpHost = process.env.SMTP_HOST?.trim() ?? "";
const smtpUser = process.env.SMTP_USER?.trim() ?? "";
const smtpPass = process.env.SMTP_PASS ?? "";
// "json" builds the messages without sending them, for local checks.
const mailDriver = (process.env.MAIL_DRIVER?.trim() || "smtp") as "smtp" | "json";

const mail = {
  driver: mailDriver,
  host: smtpHost,
  port: Number(process.env.SMTP_PORT ?? 587),
  // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : Number(process.env.SMTP_PORT ?? 587) === 465,
  user: smtpUser,
  pass: smtpPass,
  from: process.env.MAIL_FROM?.trim() || (smtpUser ? `Vertex Management <${smtpUser}>` : ""),
  replyTo: process.env.MAIL_REPLY_TO?.trim() || undefined,
  // Everyone on the team who should get a copy of enrollments and payments.
  notify: list(process.env.NOTIFY_EMAILS || "ahmed.saddique12@gmail.com"),
  currency: process.env.CURRENCY?.trim() || "Rs",
  // Where a receipt can be viewed, used for a link in the team copy.
  appUrl: trimTrailingSlashes(process.env.APP_URL?.trim() || "https://vertexmanagement.vercel.app"),
  configured: mailDriver === "json" || Boolean(smtpHost && smtpUser && smtpPass),
};

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
  mail,
  isProd: process.env.NODE_ENV === "production",
};
