import { ApiError, getToken } from "./client";

/**
 * Descarga binaria (.xlsx) — no puede pasar por el helper `api.*`, que
 * siempre espera un cuerpo JSON. Arma su propia request con el token y
 * dispara la descarga vía un link temporal.
 *
 * `sheets` vacío o ausente = todas las hojas.
 */
export async function downloadPersonsExport(sheets?: string[]): Promise<void> {
  const token = getToken();
  const query = sheets && sheets.length > 0 ? `?sheets=${sheets.join(",")}` : "";
  const res = await fetch(`${import.meta.env.BASE_URL}api/admin/export/excel${query}`, {
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

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "infodata-export.xlsx";

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
