import path from "path";
import fs from "fs/promises";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { loginToSriEnLinea } from "./login";
import { searchInvoicesByMonth } from "./search";
import { downloadComprobante } from "./download";
import { zipDirectory } from "./archive";
import { Period, SriInvoiceJobParams } from "./types";

function monthsInRange(from: Period, to: Period): Period[] {
  const out: Period[] = [];
  let y = from.year;
  let m = from.month;
  while (y < to.year || (y === to.year && m <= to.month)) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** "17/09/2026" -> "17" (día de emisión, para la carpeta YYYY/MM/DD). */
function dayFromFecha(fecha: string): string {
  const day = fecha.split("/")[0]?.trim();
  return day ? day.padStart(2, "0") : "00";
}

export interface SriInvoiceJobResult {
  resultFilePath: string;
  totalFound: number;
  totalDownloaded: number;
}

/**
 * Orquesta todo el flujo: login → por cada mes del rango, buscar y descargar
 * página por página → empaquetar todo en un .zip. No toca la base de datos —
 * eso lo hace el worker que llama a esto, así esta función se puede probar
 * o reusar sin acoplarse a SriInvoiceJob.
 */
export async function runSriInvoiceJob(
  params: SriInvoiceJobParams,
  onProgress?: (progress: { totalFound: number; totalDownloaded: number }) => void | Promise<void>
): Promise<SriInvoiceJobResult> {
  const workDir = path.join(env.SRI_INVOICES_STORAGE_DIR, "_work", params.jobId);
  await fs.mkdir(workDir, { recursive: true });

  let totalFound = 0;
  let totalDownloaded = 0;

  const { browser, page } = await loginToSriEnLinea(params.ruc, params.password);
  try {
    for (const period of monthsInRange(params.from, params.to)) {
      totalFound += await searchInvoicesByMonth(page, period, params.documentType, async (rows) => {
        for (const row of rows) {
          const destDir = path.join(
            workDir,
            String(period.year),
            String(period.month).padStart(2, "0"),
            dayFromFecha(row.fechaEmision)
          );
          try {
            await downloadComprobante(page, row, destDir, workDir);
            totalDownloaded++;
          } catch (err) {
            logger.warn("[sri-invoices] no se pudo descargar un comprobante", {
              claveAcceso: row.claveAcceso,
              error: (err as Error).message,
            });
          }
          await onProgress?.({ totalFound, totalDownloaded });
        }
      });
      await onProgress?.({ totalFound, totalDownloaded });
    }
  } finally {
    await browser.close().catch(() => {});
  }

  await fs.mkdir(env.SRI_INVOICES_STORAGE_DIR, { recursive: true });
  const zipPath = path.join(env.SRI_INVOICES_STORAGE_DIR, `${params.jobId}.zip`);
  await zipDirectory(workDir, zipPath);
  await fs.rm(workDir, { recursive: true, force: true });

  return { resultFilePath: zipPath, totalFound, totalDownloaded };
}
