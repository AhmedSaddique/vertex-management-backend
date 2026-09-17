import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./database/prisma";

async function main() {
  await prisma.$connect();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Vertex Management API listening on http://localhost:${env.port}`);
    console.log(`Allowed frontend origins: ${env.corsOrigins.join(", ")}`);
    if (!env.databaseConfigured) console.warn("DATABASE_URL is not set");
    if (env.isProd && env.jwtSecretIsDefault) console.warn("JWT_SECRET is not set - using an insecure default");
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
