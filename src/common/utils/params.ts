import type { Request } from "express";

/** Read a single route param as a string (Express 5 types allow string[]). */
export function param(req: Request, name = "id"): string {
  const v = (req.params as Record<string, string | string[] | undefined>)[name];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}
