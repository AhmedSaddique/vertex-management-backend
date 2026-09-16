import bcrypt from "bcryptjs";
import { prisma } from "../../database/prisma";
import { signToken } from "../../common/middleware/auth.middleware";
import { badRequest, unauthorized } from "../../common/utils/errors";
import type { ChangePasswordInput, LoginInput } from "./auth.schema";

export async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { teacher: { select: { id: true } }, partner: { select: { id: true } } },
  });
  if (!user || !user.isActive) throw unauthorized("Invalid email or password");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw unauthorized("Invalid email or password");

  return {
    token: signToken({ sub: user.id, role: user.role }),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teacherId: user.teacher?.id ?? null,
      partnerId: user.partner?.id ?? null,
    },
  };
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  const ok = await bcrypt.compare(input.currentPassword, user.password);
  if (!ok) throw badRequest("Current password is incorrect");
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(input.newPassword, 10) },
  });
}
