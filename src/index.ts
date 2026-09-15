import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./database/prisma";

async function main() {
  await prisma.$connect();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Vertex Management API listening on http://localhost:${env.port}`);
    console.log(`Allowed frontend origins: ${env.corsOrigins.join(", ")}`);
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
