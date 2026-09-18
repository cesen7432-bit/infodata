import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import crypto from "crypto";
import { env } from "../config/env";
import { logger } from "../lib/logger";

puppeteer.use(StealthPlugin());

export class SriInvoicesAuthError extends Error {}

/**
 * Login con las credenciales propias del contribuyente — a diferencia de
 * scrapers/sri/browser.ts (que solo bootstrapea cookies anónimas para la
 * consulta pública de RUC), acá se abre un navegador nuevo por job y se
 * cierra al terminar: nunca se comparte ni se reutiliza sesión entre RUCs.
 *
 * La URL de login que se captura en el navegador trae un `state`/`nonce`
 * propios de esa sesión puntual — Keycloak no los valida contra nada previo
 * (son para que el cliente verifique el callback), así que se generan de
 * nuevo en cada intento en vez de reusar valores capturados una sola vez.
 */
export async function loginToSriEnLinea(ruc: string, password: string): Promise<{ browser: Browser; page: Page }> {
  const browser = await puppeteer.launch({
    headless: env.HEADLESS,
    executablePath: env.PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(45000);

    const authUrl = new URL(env.SRI_INVOICES_KEYCLOAK_AUTH_URL);
    authUrl.searchParams.set("client_id", env.SRI_INVOICES_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", env.SRI_INVOICES_REDIRECT_URI);
    authUrl.searchParams.set("state", crypto.randomUUID());
    authUrl.searchParams.set("nonce", crypto.randomUUID());
    authUrl.searchParams.set("response_mode", "fragment");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid");

    logger.info("[sri-invoices] navegando a login...");
    await page.goto(authUrl.toString(), { waitUntil: "networkidle2" });

    await page.waitForSelector("#usuario", { timeout: 20000 });
    await page.type("#usuario", ruc, { delay: 30 });
    await page.type("#password", password, { delay: 30 });

    logger.info("[sri-invoices] enviando login...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
      page.keyboard.press("Enter"),
    ]);

    // Si el login falló, Keycloak vuelve a mostrar el mismo formulario (con
    // un mensaje de error) en vez de redirigir al portal — #usuario
    // seguiría presente. Es la señal más confiable sin depender del texto
    // exacto del mensaje de error (puede variar).
    const stillOnLoginForm = await page.$("#usuario");
    if (stillOnLoginForm) {
      throw new SriInvoicesAuthError("Usuario o contraseña incorrectos, o el SRI bloqueó el inicio de sesión");
    }

    logger.info("[sri-invoices] login OK", { url: page.url() });
    return { browser, page };
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}
