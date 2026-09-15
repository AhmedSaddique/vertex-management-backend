import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../database/prisma";
import { forbidden, unauthorized } from "../utils/errors";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER";
  teacherId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface JwtPayload {
  sub: string;
  role: "ADMIN" | "TEACHER";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw unauthorized("Missing authorization token");
  }
  const token = header.slice("Bearer ".length);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    throw unauthorized("Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { teacher: { select: { id: true } } },
  });
  if (!user || !user.isActive) {
    throw unauthorized("Account not found or disabled");
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teacherId: user.teacher?.id ?? null,
  };
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw unauthorized();
  if (req.user.role !== "ADMIN") throw forbidden("Admin access required");
  next();
}

/**
 * Teachers may only access their own teacher record. Admins may access any.
 * Returns the teacherId the request is allowed to read (undefined = all, admin only).
 */
export function resolveTeacherScope(
  req: Request,
  requestedTeacherId?: string | null,
): string | undefined {
  if (!req.user) throw unauthorized();
  if (req.user.role === "ADMIN") return requestedTeacherId ?? undefined;
  if (!req.user.teacherId) throw forbidden("No teacher profile linked to this account");
  if (requestedTeacherId && requestedTeacherId !== req.user.teacherId) {
    throw forbidden("You can only view your own records");
  }
  return req.user.teacherId;
}
