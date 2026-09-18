import { api, ApiError, getToken } from "./client";

export type SriInvoiceJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface DocumentTypeOption {
  value: number;
  label: string;
}

export interface SriInvoiceJobSummary {
  id: string;
  ruc: string;
  documentType: number;
  periodFromYear: number;
  periodFromMonth: number;
  periodToYear: number;
  periodToMonth: number;
  status: SriInvoiceJobStatus;
  totalFound: number | null;
  totalDownloaded: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function listDocumentTypes() {
  return api.get<DocumentTypeOption[]>("/admin/sri-invoices/tipos-comprobante");
}

export function listSriInvoiceJobs() {
  return api.get<SriInvoiceJobSummary[]>("/admin/sri-invoices");
}

export function getSriInvoiceJob(jobId: string) {
  return api.get<SriInvoiceJobSummary>(`/admin/sri-invoices/${jobId}`);
}

export function createSriInvoiceJob(params: {
  ruc: string;
  password: string;
  documentType: number;
  from: { year: number; month: number };
  to: { year: number; month: number };
}) {
  return api.post<{ jobId: string }>("/admin/sri-invoices", params);
}

/**
 * Descarga binaria — mismo motivo que api/export.ts: no puede pasar por el
 * helper `api.*` (espera JSON), así que arma su propia request con el token.
 */
export async function downloadSriInvoiceZip(job: SriInvoiceJobSummary): Promise<void> {
  const token = getToken();
  const res = await fetch(`${import.meta.env.BASE_URL}api/admin/sri-invoices/${job.id}/descargar`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // sin cuerpo JSON
    }
    throw new ApiError(res.status, message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comprobantes-${job.ruc}-${job.id}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
