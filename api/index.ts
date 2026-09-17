// Vercel serverless entry point.
// vercel.json rewrites every request to this function; Express handles the routing.
// Local development still uses src/index.ts (app.listen on PORT).
import { createApp } from "../src/app";

const app = createApp();

export default app;
