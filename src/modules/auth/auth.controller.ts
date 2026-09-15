import type { Request, Response } from "express";
import { changePasswordSchema, loginSchema } from "./auth.schema";
import * as authService from "./auth.service";

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  res.json(await authService.login(input));
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user });
}

export async function changePassword(req: Request, res: Response) {
  const input = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.user!.id, input);
  res.json({ ok: true });
}
