import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { sriBrowser } from "./browser";

const SESSION_TTL_MS = 10 * 60 * 1000;

let cookieHeader: string | null = null;
let cookieFetchedAt = 0;
let bootstrapPromise: Promise<string> | null = null;

/**
 * Navega una sola vez al formulario del SRI para conseguir cookies de sesión,
 * y de ahí en más las reutiliza vía HTTP directo (plan, sección 09) — igual
 * patrón que SATJE/DataDiverService, en vez de abrir un navegador por consulta.
 */
async function bootstrap(): Promise<string> {
  const browser = await sriBrowser.getBrowser();
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    });
    await page.goto(env.SRI_BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });

    const cookies = await page.cookies();
    cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    cookieFetchedAt = Date.now();
    logger.info("[sri] sesión bootstrapeada", { cookies: cookies.length });
    return cookieHeader;
  } finally {
    await page.close().catch(() => {});
  }
}

export async function getSessionCookies(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cookieHeader && Date.now() - cookieFetchedAt < SESSION_TTL_MS) {
    return cookieHeader;
  }
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = bootstrap().finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}
