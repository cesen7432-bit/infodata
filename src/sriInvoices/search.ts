import type { Page } from "puppeteer";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { ComprobanteRow, DocumentTypeCode, Period } from "./types";

const TABLE_DATA_SELECTOR = '[id="frmPrincipal:tablaCompRecibidos_data"]';
const PAGE_SIZE = "75"; // el máximo que ofrece el propio selector del paginador

/**
 * Navega a "Comprobantes recibidos" y arma la consulta para un mes puntual
 * (el SRI no permite un rango de fechas libre, solo año+mes+día — "día=0" es
 * "Todos", así se trae el mes completo en una sola búsqueda).
 */
async function setSearchFilters(page: Page, period: Period, documentType: DocumentTypeCode): Promise<void> {
  // "networkidle2" cuelga acá — esta app (JSF/PrimeFaces) tiene tráfico de
  // fondo (polling de sesión, keepalive) que nunca deja la red "quieta" el
  // tiempo que pide esa condición. domcontentloaded + el waitForSelector de
  // abajo (que sí confirma contenido real) es más confiable.
  await page.goto(env.SRI_INVOICES_COMPROBANTES_URL, { waitUntil: "domcontentloaded" });

  try {
    await page.waitForSelector('[id="frmPrincipal:ano"]', { timeout: 30000 });
  } catch (err) {
    // Diagnóstico: si esto falla, lo más probable es que la navegación haya
    // terminado en otro lado (sesión no establecida a tiempo, login que
    // volvió a pedirse, una pantalla de error del portal, etc.) — sin esto
    // el timeout de Puppeteer no dice nada sobre POR QUÉ no apareció el form.
    const url = page.url();
    const title = await page.title().catch(() => "?");
    const bodySnippet = await page
      .evaluate(() => document.body?.innerText?.slice(0, 400) ?? "(sin body)")
      .catch((e) => `(evaluate falló: ${(e as Error).message})`);
    logger.error("[sri-invoices] no apareció el formulario de comprobantes recibidos", { url, title, bodySnippet });
    throw err;
  }

  await page.select('[id="frmPrincipal:ano"]', String(period.year));
  await page.select('[id="frmPrincipal:mes"]', String(period.month));
  await page.select('[id="frmPrincipal:dia"]', "0"); // Todos
  await page.select('[id="frmPrincipal:cmbTipoComprobante"]', String(documentType));
}

/** El botón "Consultar" no tiene un id documentado — se ubica por su texto visible dentro del form. */
async function clickConsultar(page: Page): Promise<void> {
  const clicked = await page.evaluate(() => {
    const form = document.getElementById("frmPrincipal");
    if (!form) return false;
    const candidates = Array.from(form.querySelectorAll<HTMLElement>('button, input[type="submit"], input[type="button"], a'));
    const target = candidates.find((el) => {
      const text = (el.innerText || (el as HTMLInputElement).value || "").trim().toLowerCase();
      return text === "consultar";
    });
    if (!target) return false;
    target.click();
    return true;
  });

  if (!clicked) {
    throw new Error('No se encontró el botón "Consultar" en el formulario de comprobantes recibidos');
  }

  // Es un postback AJAX de PrimeFaces (igual que el radio de arriba) — no
  // navega, solo actualiza el panel de la tabla.
  await page
    .waitForSelector(TABLE_DATA_SELECTOR, { timeout: 20000 })
    .catch(() => logger.warn("[sri-invoices] tabla de comprobantes no apareció tras Consultar (¿0 resultados?)"));
  await new Promise((r) => setTimeout(r, 1000));
}

async function setPageSize(page: Page): Promise<void> {
  const selector = '[id="frmPrincipal:tablaCompRecibidos_paginator_bottom"] select.ui-paginator-rpp-options';
  const hasSelector = await page.$(selector);
  if (!hasSelector) return; // sin paginador visible (todo cabe en una sola página, o 0 resultados)
  await page.select(selector, PAGE_SIZE).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
}

function parseRows(rowsRaw: Array<Record<string, string>>): ComprobanteRow[] {
  return rowsRaw.map((r) => ({
    rowIndex: Number(r.rowIndex),
    claveAcceso: r.claveAcceso,
    emisorRuc: r.emisorRuc,
    emisorNombre: r.emisorNombre,
    fechaEmision: r.fechaEmision,
    tipoYSerie: r.tipoYSerie,
  }));
}

async function readCurrentPageRows(page: Page): Promise<ComprobanteRow[]> {
  const raw = await page.evaluate((tableSelector) => {
    const body = document.querySelector(tableSelector);
    if (!body) return [];
    const rows = Array.from(body.querySelectorAll(":scope > tr"));
    return rows.map((tr) => {
      const cells = tr.querySelectorAll(":scope > td");
      const emisorText = (cells[1]?.textContent || "").trim();
      const [emisorRuc, ...rest] = emisorText.split("\n").map((s) => s.trim()).filter(Boolean);
      return {
        rowIndex: tr.getAttribute("data-ri") || "-1",
        emisorRuc: emisorRuc || "",
        emisorNombre: rest.join(" ") || "",
        tipoYSerie: (cells[2]?.textContent || "").trim(),
        claveAcceso: (cells[3]?.textContent || "").trim(),
        fechaEmision: (cells[5]?.textContent || "").trim(),
      };
    });
  }, TABLE_DATA_SELECTOR);

  return parseRows(raw as Array<Record<string, string>>);
}

function isNextDisabled(html: string): boolean {
  return /ui-paginator-next[^>]*ui-state-disabled/.test(html) || !/ui-paginator-next/.test(html);
}

async function goToNextPage(page: Page): Promise<boolean> {
  const paginatorSelector = '[id="frmPrincipal:tablaCompRecibidos_paginator_bottom"]';
  const html = await page.$eval(paginatorSelector, (el) => el.outerHTML).catch(() => "");
  if (!html || isNextDisabled(html)) return false;

  const clicked = await page.evaluate((sel) => {
    const nextBtn = document.querySelector(`${sel} .ui-paginator-next`);
    if (!nextBtn || nextBtn.classList.contains("ui-state-disabled")) return false;
    (nextBtn as HTMLElement).click();
    return true;
  }, paginatorSelector);

  if (!clicked) return false;
  await new Promise((r) => setTimeout(r, 1500));
  return true;
}

/**
 * Busca un mes completo y va entregando los resultados página por página
 * (no los junta todos antes de devolver) porque el índice de fila de cada
 * link de descarga (frmPrincipal:tablaCompRecibidos:N:lnkXml) es relativo a
 * la página actual — hay que descargar los archivos de una página ANTES de
 * pasar a la siguiente, o el índice ya no apunta a la fila correcta.
 */
export async function searchInvoicesByMonth(
  page: Page,
  period: Period,
  documentType: DocumentTypeCode,
  onPage: (rows: ComprobanteRow[]) => Promise<void>
): Promise<number> {
  logger.info("[sri-invoices] buscando período", { year: period.year, month: period.month, documentType });

  await setSearchFilters(page, period, documentType);
  await clickConsultar(page);
  await setPageSize(page);

  let total = 0;
  let pageNum = 1;
  for (;;) {
    const rows = await readCurrentPageRows(page);
    if (rows.length === 0 && pageNum === 1) break; // sin resultados este mes

    logger.info("[sri-invoices] página de resultados", { pageNum, rows: rows.length });
    await onPage(rows);
    total += rows.length;

    const advanced = await goToNextPage(page);
    if (!advanced) break;
    pageNum++;
  }

  return total;
}
