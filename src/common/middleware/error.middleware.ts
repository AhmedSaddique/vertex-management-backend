import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { HttpError } from "../utils/errors";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(", ")
        : "field";
      res.status(409).json({ error: `A record with this ${target} already exists.` });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Record not found." });
      return;
    }
    if (err.code === "P2003") {
      res
        .status(409)
        .json({ error: "This record is linked to other records and cannot be changed this way." });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
