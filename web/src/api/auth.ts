import { api } from "./client";
import { CurrentUser, Role } from "./types";

export function login(email: string, password: string) {
  return api.post<{ token: string; role: Role; email: string }>("/auth/login", { email, password });
}

export function logout() {
  return api.post<void>("/auth/logout");
}

export function me() {
  return api.get<CurrentUser>("/auth/me");
}
