import { Role } from "@prisma/client";
import { prisma } from "../db/prisma";
import { hashPassword } from "../auth/password";
import { revokeAllSessionsForUser } from "../auth/session";

export class EmailInUseError extends Error {}

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(params: { email: string; password: string; role: Role; createdById: string }) {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) throw new EmailInUseError();

  const passwordHash = await hashPassword(params.password);
  return prisma.user.create({
    data: { email: params.email, passwordHash, role: params.role, createdById: params.createdById },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
  });
}

export async function updateUser(
  id: string,
  params: Partial<{ email: string; password: string; role: Role; isActive: boolean }>
) {
  const data: Record<string, unknown> = {};
  if (params.email !== undefined) data.email = params.email;
  if (params.role !== undefined) data.role = params.role;
  if (params.isActive !== undefined) data.isActive = params.isActive;
  if (params.password) data.passwordHash = await hashPassword(params.password);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, role: true, isActive: true, updatedAt: true },
  });

  // Cambiar rol, contraseña o desactivar invalida las sesiones ya abiertas —
  // si no, alguien seguiría entrando con permisos/clave viejos hasta que su
  // token expire solo.
  if (params.isActive === false || params.role !== undefined || params.password) {
    await revokeAllSessionsForUser(id);
  }

  return user;
}

export async function deleteUser(id: string) {
  // onDelete: Cascade en Session se encarga de cerrar sus sesiones.
  await prisma.user.delete({ where: { id } });
}
