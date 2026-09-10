import type { Page } from "puppeteer";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { antBrowser } from "./browser";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MultaPendiente {
  placa: string;
  totalPagar: number;
  delito: string;
  fechaEmision: string;
  fechaNotificacion: string;
}

interface MultaPagada {
  placa: string;
  totalPagado: number;
  delito: string;
  fechaEmision: string;
  fechaNotificacion: string;
  sancion: number;
  multa: number;
  remision: number;
}

async function extractMultasPendientes(page: Page): Promise<MultaPendiente[]> {
  return page.evaluate(() => {
    const filas = Array.from(document.querySelectorAll('tr[role="row"]'));
    return filas
      .map((fila) => {
        const cells = fila.querySelectorAll('td[role="gridcell"]');
        let placa = "";
        let totalPagar = 0;
        let delito = "";
        let fechaEmision = "";
        let fechaNotificacion = "";

        cells.forEach((cell) => {
          const desc = cell.getAttribute("aria-describedby");
          if (desc === "list10_secuencia_4" || desc === "list10_placa") {
            const texto = (cell.textContent || "").trim();
            if (texto && texto !== "-") placa = texto;
          }
          if (desc === "list10_total") {
            totalPagar = parseFloat((cell.textContent || "").replace(/[$\s]/g, "").replace(",", ".")) || 0;
          }
          if (desc === "list10_rubro") delito = (cell.textContent || "").trim();
          if (desc === "list10_fecha_emision") fechaEmision = (cell.textContent || "").trim();
          if (desc === "list10_fecha_factura") fechaNotificacion = (cell.textContent || "").trim();
        });

        if (!placa || placa === "-") {
          cells.forEach((cell) => {
            const desc = cell.getAttribute("aria-describedby");
            if (desc && desc.includes("infraccion")) {
              const match = (cell.textContent || "").trim().match(/[A-Z]{3}\d{4}/);
              if (match) placa = match[0];
            }
          });
        }

        return { placa: placa || "Sin placa", totalPagar, delito, fechaEmision, fechaNotificacion };
      })
      .filter((row) => row.delito !== "");
  });
}

async function extractMultasPagadas(page: Page): Promise<MultaPagada[]> {
  const radioClicked = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("label"));
    const pagadasLabel = labels.find((l) => (l.textContent || "").includes("Pagadas"));
    const radio =
      pagadasLabel?.querySelector('input[type="radio"]') ||
      document.querySelector('input[type="radio"][value*="pagada"]') ||
      document.querySelector('input[type="radio"]#pagadas');
    if (radio) {
      (radio as HTMLElement).click();
      return true;
    }
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const fallback = radios.find((r) => {
      const parent = r.closest("td") || r.parentElement;
      return parent && (parent.textContent || "").includes("Pagadas");
    });
    if (fallback) {
      (fallback as HTMLElement).click();
      return true;
    }
    return false;
  });

  if (!radioClicked) return [];

  await delay(3000);

  return page.evaluate(() => {
    const filas = Array.from(document.querySelectorAll('tr[role="row"]'));
    return filas
      .map((fila) => {
        const cells = fila.querySelectorAll('td[role="gridcell"]');
        let placa = "";
        let totalPagado = 0;
        let delito = "";
        let fechaEmision = "";
        let fechaNotificacion = "";
        let sancion = 0;
        let multa = 0;
        let remision = 0;

        cells.forEach((cell) => {
          const desc = cell.getAttribute("aria-describedby");
          const num = () => parseFloat((cell.textContent || "").replace(/[$\s]/g, "").replace(",", ".")) || 0;

          if (desc === "list10_secuencia_4" || desc === "list10_placa") placa = (cell.textContent || "").trim();
          if (desc === "list10_total" || desc === "list10_total_pagar") totalPagado = num();
          if (desc === "list10_rubro" || desc === "list10_articulo") delito = (cell.textContent || "").trim();
          if (desc === "list10_fecha_emision") fechaEmision = (cell.textContent || "").trim();
          if (desc === "list10_fecha_factura") fechaNotificacion = (cell.textContent || "").trim();
          if (desc === "list10_capital_factura") sancion = num();
          if (desc === "list10_multa") multa = num();
          if (desc === "list10_remision") remision = num();
        });

        return { placa: placa || "Sin placa", totalPagado, delito, fechaEmision, fechaNotificacion, sancion, multa, remision };
      })
      .filter((row) => row.delito !== "");
  });
}

export interface AntScrapeResult {
  pendientes: MultaPendiente[];
  pagadas: MultaPagada[];
}

export async function scrapeSanciones(cedula: string): Promise<AntScrapeResult> {
  const page = await antBrowser.newPage();
  try {
    const url = `${env.ANT_URL}?ps_tipo_identificacion=CED&ps_identificacion=${cedula}&ps_placa=`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await delay(3000);

    const pendientes = await extractMultasPendientes(page);
    const pagadas = await extractMultasPagadas(page);

    logger.info("[ant] consulta completada", { cedula, pendientes: pendientes.length, pagadas: pagadas.length });
    return { pendientes, pagadas };
  } finally {
    await antBrowser.closePage(page);
  }
}
