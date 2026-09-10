import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "puppeteer";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

puppeteer.use(StealthPlugin());

class RpBrowser {
  private browser: Browser | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    logger.info("[rp] lanzando Chromium persistente...");
    this.browser = await puppeteer.launch({
      headless: env.HEADLESS,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    this.browser.on("disconnected", () => {
      logger.warn("[rp] navegador desconectado, se relanzará en la próxima consulta");
      this.browser = null;
    });
    return this.browser;
  }
}

export const rpBrowser = new RpBrowser();
