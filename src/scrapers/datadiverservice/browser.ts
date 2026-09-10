import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "puppeteer";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

puppeteer.use(StealthPlugin());

/**
 * Un único navegador persistente para todo el proceso worker — se usa solo para el
 * login (cada ~5h, cuando expira el token), nunca para las consultas en sí.
 * Plan de arquitectura, sección 09: "sesión obtenida una vez, después HTTP directo".
 */
class DataDiverBrowser {
  private browser: Browser | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    logger.info("[datadiverservice] lanzando Chromium para login...");
    this.browser = await puppeteer.launch({
      headless: env.HEADLESS,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const dataDiverBrowser = new DataDiverBrowser();
