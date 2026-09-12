import { prisma } from "../db/prisma";
import { comparePassword, hashPassword } from "./password";
import { createSession, generateSessionToken, revokeAllSessionsForUser, revokeSession, sessionExpiry } from "./session";

export class InvalidCredentialsError extends Error {}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; role: string; email: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw new InvalidCredentialsError();

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  // Una sola sesión activa por usuario: un login nuevo tumba cualquier sesión
  // previa — no hay "dos dispositivos logueados a la vez".
  await revokeAllSessionsForUser(user.id);

  const token = generateSessionToken();
  await createSession(user.id, token, sessionExpiry());

  return { token, role: user.role, email: user.email };
}

export async function logout(token: string): Promise<void> {
  await revokeSession(token);
}

/**
 * Cambio de contraseña por el propio usuario (no requiere rol admin). Exige la
 * contraseña actual y, al igual que el reseteo admin en users.service.ts,
 * revoca todas las sesiones — incluida la que hizo el cambio — para forzar
 * un login limpio con la clave nueva.
 */
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new InvalidCredentialsError();

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllSessionsForUser(userId);
}
