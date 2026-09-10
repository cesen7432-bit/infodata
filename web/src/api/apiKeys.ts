import { api } from "./client";

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  allowedDomains: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  allowedDomains: string[];
  createdAt: string;
  key: string;
}

export function listApiKeys() {
  return api.get<ApiKeySummary[]>("/admin/api-keys");
}

export function createApiKey(data: { name: string; domains: string[] }) {
  return api.post<CreatedApiKey>("/admin/api-keys", data);
}

export function revokeApiKey(id: string) {
  return api.del<void>(`/admin/api-keys/${id}`);
}
