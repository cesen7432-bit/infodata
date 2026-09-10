import { api } from "./client";

export type BulkJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "COMPLETED_WITH_ERRORS";
export type BulkItemStatus = "PENDING" | "RUNNING" | "OK" | "FAILED" | "BLOCKED_CAPTCHA";

export interface BulkJobSummary {
  id: string;
  totalItems: number;
  status: BulkJobStatus;
  createdAt: string;
  completedAt: string | null;
  requestedById: string;
}

export interface BulkJobItem {
  identification: string;
  source: string;
  status: BulkItemStatus;
  errorMessage: string | null;
  completedAt: string | null;
}

export interface BulkJobDetail {
  id: string;
  totalItems: number;
  status: BulkJobStatus;
  counts: { pendientes: number; completados: number; fallidos: number; bloqueadosCaptcha: number };
  createdAt: string;
  items: BulkJobItem[];
}

export function listBulkJobs() {
  return api.get<BulkJobSummary[]>("/admin/consulta-masiva");
}

export function getBulkJob(jobId: string) {
  return api.get<BulkJobDetail>(`/admin/consulta-masiva/${jobId}`);
}

export function createBulkJob(data: { cedulas: string[]; fuentes?: string[] }) {
  return api.post<{ jobId: string; totalItems: number }>("/admin/consulta-masiva", data);
}
