import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "puppeteer";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

puppeteer.use(StealthPlugin());

/** Navegador persistente para SRI — solo se usa para obtener/renovar cookies de sesión. */
class SriBrowser {
  private browser: Browser | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    logger.info("[sri] lanzando Chromium para bootstrap de sesión...");
    this.browser = await puppeteer.launch({
      headless: env.HEADLESS,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    return this.browser;
  }
}

export const sriBrowser = new SriBrowser();
