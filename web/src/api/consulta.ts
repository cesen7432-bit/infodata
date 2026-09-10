import { api, apiFetch, ApiError } from "./client";
import { ExpedienteResponse, HistoryItem } from "./types";

/**
 * 200 y 404 son las dos respuestas "normales" de este endpoint (404 = nadie
 * encontró nada en ninguna fuente, pero el body igual trae qué fuentes se
 * consultaron) — solo lo que no sea eso es un error de verdad.
 */
export async function buscarExpediente(identificacion: string): Promise<ExpedienteResponse> {
  const { status, body } = await apiFetch<ExpedienteResponse>(`/consulta/${encodeURIComponent(identificacion)}`);
  if (status === 200 || status === 404) return body as ExpedienteResponse;

  const b = body as Record<string, unknown> | null;
  const msg = b?.error ?? b?.detail;
  throw new ApiError(status, typeof msg === "string" ? msg : `Error ${status}`);
}

export function obtenerHistorial() {
  return api.get<HistoryItem[]>("/consulta/historial");
}
