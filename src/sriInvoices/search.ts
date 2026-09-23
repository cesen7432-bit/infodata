import type { Page } from "puppeteer";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { submitCredentials } from "./login";
import { ComprobanteRow, DocumentTypeCode, Period } from "./types";

const TABLE_DATA_SELECTOR = '[id="frmPrincipal:tablaCompRecibidos_data"]';
const PAGE_SIZE = "75"; // el máximo que ofrece el propio selector del paginador

/**
 * `page.$` justo después de un `goto` puede reventar con "Protocol error
 * (DOM.describeNode): Cannot find context with specified id" — el sitio
 * encadena su propia redirección apenas dispara "domcontentloaded" (ver
 * comentario del ERR_ABORTED más abajo) y eso destruye el contexto de
 * ejecución a mitad de la consulta. Un reintento con un margen corto le da
 * tiempo a que el frame termine de asentarse.
 */
async function isOnLoginForm(page: Page): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return !!(await page.$("#usuario"));
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return false;
}

/**
 * Intenta llegar a la página de comprobantes recibidos. La sesión SSO que
 * deja `loginToSriEnLinea` a veces no alcanza para esta app JSF
 * (comprobantes-electronicos-internet vive aparte de la SPA sri-en-linea) y
 * el portal manda de vuelta al mismo formulario de Keycloak — cuyo
 * `redirect_uri` apunta siempre a la página de perfil de la SPA, nunca de
 * vuelta a comprobantes, así que tras reautenticar ahí hay que repetir la
 * navegación a esta URL (no alcanza con solo volver a loguearse in situ).
 */
async function navigateToComprobantes(page: Page, credentials: { ruc: string; password: string }): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    // "networkidle2" cuelga acá — esta app (JSF/PrimeFaces) tiene tráfico de
    // fondo (polling de sesión, keepalive) que nunca deja la red "quieta" el
    // tiempo que pide esa condición. domcontentloaded + el waitForSelector de
    // más abajo (que sí confirma contenido real) es más confiable.
    try {
      await page.goto(env.SRI_INVOICES_COMPROBANTES_URL, { waitUntil: "domcontentloaded" });
    } catch (err) {
      // ERR_ABORTED es normal acá: la página dispara una redirección propia
      // casi de inmediato (por los parámetros de contexto/breadcrumb de la
      // URL) y Chrome reporta la navegación original como abortada aunque en
      // la práctica sí termina en el destino correcto.
      if (!(err as Error).message.includes("ERR_ABORTED")) throw err;
    }

    const onLoginForm = await isOnLoginForm(page);
    if (!onLoginForm) return; // llegamos a comprobantes (o a donde sea que no sea el login)
    if (attempt === 2) return; // se deja que el waitForSelector de abajo falle y loguee el diagnóstico

    logger.warn("[sri-invoices] la navegación a comprobantes recibidos volvió al login — reautenticando", { attempt });
    await submitCredentials(page, credentials.ruc, credentials.password);
    // Igual que en el login inicial: el redirect_uri es la SPA de perfil, que
    // recién intercambia el code por sesión real de forma asíncrona — hay
    // que dar el mismo margen antes de reintentar la navegación a comprobantes.
    await new Promise((r) => setTimeout(r, 4000));
  }
}

/**
 * Navega a "Comprobantes recibidos" y arma la consulta para un mes puntual
 * (el SRI no permite un rango de fechas libre, solo año+mes+día — "día=0" es
 * "Todos", así se trae el mes completo en una sola búsqueda).
 */
async function setSearchFilters(
  page: Page,
  period: Period,
  documentType: DocumentTypeCode,
  credentials: { ruc: string; password: string }
): Promise<void> {
  await navigateToComprobantes(page, credentials);

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

const CONSULTAR_BUTTON_SELECTOR = '[id="frmPrincipal:btnConsultarSinRe"]';

function isDialogVisible(): boolean {
  const el = document.getElementById("dlgpopStatusPrime");
  return !!el && getComputedStyle(el).visibility !== "hidden";
}

/**
 * "btnConsultarSinRe" ("sin reCAPTCHA") es el botón real de Consultar — no
 * hace falta resolver ningún captcha para usarlo. La tabla de resultados ya
 * existe en el DOM desde que carga la página (con datos de la consulta
 * anterior, o vacía), así que esperar a que "aparezca" no sirve para saber
 * si el AJAX terminó — la señal real es el diálogo "Espere por favor"
 * (dlgpopStatusPrime) que el propio botón muestra al iniciar y oculta al
 * terminar (ver su onstart/onsuccess en el HTML).
 */
async function clickConsultar(page: Page): Promise<void> {
  const button = await page.$(CONSULTAR_BUTTON_SELECTOR);
  if (!button) {
    throw new Error('No se encontró el botón "Consultar" (frmPrincipal:btnConsultarSinRe) en el formulario de comprobantes recibidos');
  }

  await button.click();

  // Puede que el diálogo nunca llegue a mostrarse si el AJAX es instantáneo
  // — no es un error, solo se sigue de largo al chequeo de "ya se ocultó".
  await page.waitForFunction(isDialogVisible, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(`!(${isDialogVisible.toString()})()`, { timeout: 30000 }).catch(() => {
    logger.warn("[sri-invoices] el diálogo de espera no se ocultó a tiempo tras Consultar — se sigue igual");
  });

  await new Promise((r) => setTimeout(r, 800));
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
  credentials: { ruc: string; password: string },
  onPage: (rows: ComprobanteRow[]) => Promise<void>
): Promise<number> {
  logger.info("[sri-invoices] buscando período", { year: period.year, month: period.month, documentType });

  await setSearchFilters(page, period, documentType, credentials);
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
