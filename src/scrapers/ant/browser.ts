import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

puppeteer.use(StealthPlugin());

/**
 * Navegador persistente y compartido — una página nueva por consulta, nunca un
 * proceso Chromium nuevo (plan, sección 09: el original lanzaba/cerraba
 * navegador completo en cada llamada, ~1-3s de sobrecarga evitable).
 */
class AntBrowser {
  private browser: Browser | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    logger.info("[ant] lanzando Chromium persistente...");
    this.browser = await puppeteer.launch({
      headless: env.HEADLESS,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    this.browser.on("disconnected", () => {
      logger.warn("[ant] navegador desconectado, se relanzará en la próxima consulta");
      this.browser = null;
    });
    return this.browser;
  }

  async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    );
    return page;
  }

  async closePage(page: Page): Promise<void> {
    await page.close().catch(() => {});
  }
}

export const antBrowser = new AntBrowser();
