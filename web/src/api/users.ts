import { api } from "./client";
import { Role } from "./types";

export interface ManagedUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function listUsers() {
  return api.get<ManagedUser[]>("/admin/users");
}

export function createUser(data: { email: string; password: string; role: Role }) {
  return api.post<ManagedUser>("/admin/users", data);
}

export function updateUser(id: string, data: Partial<{ email: string; password: string; role: Role; isActive: boolean }>) {
  return api.patch<ManagedUser>(`/admin/users/${id}`, data);
}

export function deleteUser(id: string) {
  return api.del<void>(`/admin/users/${id}`);
}
