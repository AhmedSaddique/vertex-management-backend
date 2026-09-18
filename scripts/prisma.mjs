// Runs the Prisma CLI with DATABASE_URL resolved from .env, including alias variable names
// (the CLI itself only reads DATABASE_URL, which breaks when the value is stored elsewhere).
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

const ALIASES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "VERTEX_DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_POSTGRES_URL",
];

const found = ALIASES.find((name) => process.env[name]?.trim());
if (!found) {
  console.error(`No database URL found. Set DATABASE_URL (or one of: ${ALIASES.slice(1).join(", ")}).`);
  process.exit(1);
}
if (found !== "DATABASE_URL") {
  process.env.DATABASE_URL = process.env[found].trim();
  console.log(`prisma: using ${found} as DATABASE_URL`);
}

const result = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(result.status ?? 1);
