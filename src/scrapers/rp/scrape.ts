import type { Page } from "puppeteer";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { getAuthenticatedPage } from "./session";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PropertyRow {
  tipo_estado: string | null;
  numero1: string | null;
  numero2: string | null;
  fecha: string | null;
  ci: string | null;
  nombre: string | null;
  rol: string | null;
  detalle: string | null;
}

async function extractPropertyData(page: Page, ci: string): Promise<PropertyRow[]> {
  if (!page.url().includes("bienInmueble.xhtml")) {
    await page.goto(env.RP_CONSULTA_URL, { waitUntil: "networkidle2", timeout: 30000 });
  }

  await page.waitForSelector('input[id="mainForm:j_idt51"]', { timeout: 10000 });
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[id="mainForm:j_idt51"]');
    if (input) input.value = "";
  });
  await page.type('input[id="mainForm:j_idt51"]', ci);
  await page.click('button[id="mainForm:j_idt78"]');
  await delay(5000);

  try {
    await page.waitForSelector("#mainForm\\:j_idt80_data", { timeout: 10000 });
    return await page.evaluate(() => {
      const tableBody = document.querySelector("#mainForm\\:j_idt80_data");
      if (!tableBody) return [];
      const rows = Array.from(tableBody.querySelectorAll("tr"));
      return rows
        .map((tr) => {
          const cols = Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent || "").trim());
          return {
            tipo_estado: cols[0] || null,
            numero1: cols[1] || null,
            numero2: cols[2] || null,
            fecha: cols[3] || null,
            ci: cols[4] || null,
            nombre: cols[5] || null,
            rol: cols[6] || null,
            detalle: cols[7] || null,
          };
        })
        .filter((row) => row.tipo_estado && row.tipo_estado !== "");
    });
  } catch {
    logger.warn("[rp] tabla principal no encontrada, probando extracción alternativa");
    return page.evaluate(() => {
      const tables = document.querySelectorAll("table");
      for (const table of Array.from(tables)) {
        const rows = Array.from(table.querySelectorAll("tr"));
        if (rows.length > 1) {
          return rows
            .slice(1)
            .map((tr) => {
              const cols = Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent || "").trim());
              if (cols.length < 8) return null;
              return {
                tipo_estado: cols[0] || null,
                numero1: cols[1] || null,
                numero2: cols[2] || null,
                fecha: cols[3] || null,
                ci: cols[4] || null,
                nombre: cols[5] || null,
                rol: cols[6] || null,
                detalle: cols[7] || null,
              };
            })
            .filter((row): row is PropertyRow => !!row && !!row.tipo_estado);
        }
      }
      return [];
    });
  }
}

export async function scrapeProperty(ci: string): Promise<PropertyRow[]> {
  const page = await getAuthenticatedPage();
  const registros = await extractPropertyData(page, ci);
  logger.info("[rp] consulta completada", { ci, registros: registros.length });
  return registros;
}
