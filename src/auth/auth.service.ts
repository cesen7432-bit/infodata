import { prisma } from "../db/prisma";
import { comparePassword } from "./password";
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
