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
    // El viewport (800x600) y el user-agent por defecto de Chromium delatan
    // headless — algunos filtros del SRI parecen distinguir esa sesión de
    // una real y le niegan el SSO a la app JSF de comprobantes recibidos
    // (aunque el login inicial contra Keycloak sí funcione). Mismo user-agent
    // que ya usa scrapers/ant/browser.ts.
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });

    logger.info("[sri-invoices] navegando a login...");
    await page.goto(buildAuthUrl(), { waitUntil: "networkidle2" });
    await submitCredentials(page, ruc, password);

    const title = await page.title().catch(() => "?");
    logger.info("[sri-invoices] login OK", { url: page.url(), title });
    // El redirect_uri es una ruta Angular (sri-en-linea/contribuyente/perfil)
    // que recién intercambia el code por una sesión real de forma asíncrona
    // al bootstrapear — si el job navega de inmediato a la app de comprobantes
    // (JSF, otro dominio de rutas) antes de que eso termine, la sesión todavía
    // no existe ahí. Se le da un margen fijo antes de seguir.
    await new Promise((r) => setTimeout(r, 4000));
    return { browser, page };
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

function buildAuthUrl(): string {
  const authUrl = new URL(env.SRI_INVOICES_KEYCLOAK_AUTH_URL);
  authUrl.searchParams.set("client_id", env.SRI_INVOICES_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", env.SRI_INVOICES_REDIRECT_URI);
  authUrl.searchParams.set("state", crypto.randomUUID());
  authUrl.searchParams.set("nonce", crypto.randomUUID());
  authUrl.searchParams.set("response_mode", "fragment");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid");
  return authUrl.toString();
}

/**
 * Llena y envía el formulario de Keycloak (#usuario/#password) en la página
 * actual. Se usa tanto para el login inicial como para cuando la app JSF de
 * comprobantes recibidos manda de vuelta a este mismo formulario (ver
 * search.ts) — la sesión SSO de la SPA no siempre alcanza para esa app y hay
 * que volver a autenticar ahí mismo.
 */
export async function submitCredentials(page: Page, ruc: string, password: string): Promise<void> {
  await page.waitForSelector("#usuario", { timeout: 20000 });
  await page.type("#usuario", ruc, { delay: 30 });
  await page.type("#password", password, { delay: 30 });

  logger.info("[sri-invoices] enviando login...");
  // "networkidle2" cuelga en este portal (polling/keepalive de fondo que
  // nunca deja la red quieta) — domcontentloaded alcanza para saber que
  // hubo una navegación; el chequeo de #usuario de abajo es lo que
  // realmente confirma si el login funcionó.
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
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
}
