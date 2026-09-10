import type { Page } from "puppeteer";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { rpBrowser } from "./browser";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let sessionPage: Page | null = null;
let loginPromise: Promise<Page> | null = null;

async function checkSession(page: Page): Promise<boolean> {
  try {
    await page.goto(env.RP_CONSULTA_URL, { waitUntil: "networkidle2", timeout: 15000 });
    const isLoginPage = (await page.$('input[id="mainForm:username"]')) !== null;
    return !isLoginPage;
  } catch (err) {
    logger.warn("[rp] error verificando sesión", { error: (err as Error).message });
    return false;
  }
}

async function performLogin(page: Page): Promise<void> {
  if (!env.RP_USERNAME || !env.RP_PASSWORD) {
    throw new Error("RP_USERNAME/RP_PASSWORD no configurados");
  }

  await page.goto(env.RP_LOGIN_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('input[id="mainForm:username"]', { timeout: 10000 });

  await page.type('input[id="mainForm:username"]', env.RP_USERNAME);
  await page.type('input[id="mainForm:password"]', env.RP_PASSWORD);
  await page.click('button[id="mainForm:j_idt16"]');

  await delay(5000);
  logger.info("[rp] login completado");
}

/**
 * Reutiliza una única página autenticada entre consultas (concurrencia 1 —
 * plan, sección 09) en vez de verificar/reloguear en cada llamada como hacía
 * el original.
 */
export async function getAuthenticatedPage(): Promise<Page> {
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    if (sessionPage && !sessionPage.isClosed()) {
      if (await checkSession(sessionPage)) return sessionPage;
    }

    const browser = await rpBrowser.getBrowser();
    sessionPage = await browser.newPage();
    await sessionPage.setExtraHTTPHeaders({ "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" });

    const valid = await checkSession(sessionPage);
    if (!valid) {
      await performLogin(sessionPage);
      const revalidated = await checkSession(sessionPage);
      if (!revalidated) throw new Error("No se pudo establecer una sesión válida en RP (credenciales o CAPTCHA)");
    }

    return sessionPage;
  })().finally(() => {
    loginPromise = null;
  });

  return loginPromise;
}
