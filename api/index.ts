// Vercel serverless entry point: vercel.json rewrites every request here and Express
// does the routing. Local development uses src/index.ts instead (app.listen on PORT).
// src/app.ts also exports this same handler as its default, because Vercel may resolve
// either module as the function entry.
export { default } from "../src/app";
