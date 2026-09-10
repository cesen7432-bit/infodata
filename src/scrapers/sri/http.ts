import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { getSessionCookies } from "./session";

const HEADERS_BASE = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  Referer: "https://srienlinea.sri.gob.ec/",
  Origin: "https://srienlinea.sri.gob.ec/",
};

function hasRecaptcha(text: string): boolean {
  return text.includes("recaptcha") || text.includes("g-recaptcha") || text.includes("The requested URL was rejected");
}

async function getWithCookies(url: string, cookies: string): Promise<{ status: number; text: string }> {
  const res = await axios.get(url, {
    headers: { ...HEADERS_BASE, Cookie: cookies },
    timeout: 15000,
    validateStatus: () => true,
    transformResponse: (data) => data, // mantener como texto crudo para detectar CAPTCHA antes de parsear
  });
  return { status: res.status, text: typeof res.data === "string" ? res.data : JSON.stringify(res.data) };
}

export interface SriFetchResult {
  blockedCaptcha: boolean;
  contribuyente?: any[];
  establecimientos?: any[];
}

/**
 * Trae contribuyente + establecimientos reutilizando la sesión bootstrapeada.
 * Si el SRI responde con CAPTCHA, refresca la sesión una vez y reintenta — si
 * sigue bloqueado, no sigue insistiendo: se marca para intervención manual
 * (plan, sección 09 — presupuesto $0 para solvers).
 */
export async function fetchSri(ruc: string): Promise<SriFetchResult> {
  for (const attempt of [1, 2]) {
    const cookies = await getSessionCookies(attempt === 2);
    const contribuyenteUrl = `${env.SRI_CONTRIBUYENTE_URL}?&ruc=${ruc}`;
    const establecimientosUrl = `${env.SRI_ESTABLECIMIENTOS_URL}?numeroRuc=${ruc}`;

    const [contribuyenteRes, establecimientosRes] = await Promise.all([
      getWithCookies(contribuyenteUrl, cookies),
      getWithCookies(establecimientosUrl, cookies),
    ]);

    if (hasRecaptcha(contribuyenteRes.text) || hasRecaptcha(establecimientosRes.text)) {
      logger.warn(`[sri] CAPTCHA detectado (intento ${attempt}/2) para RUC ${ruc}`);
      continue;
    }

    const contribuyente = contribuyenteRes.status === 200 && contribuyenteRes.text.trim() ? JSON.parse(contribuyenteRes.text) : [];
    const establecimientos =
      establecimientosRes.status === 200 && establecimientosRes.text.trim() ? JSON.parse(establecimientosRes.text) : [];

    return { blockedCaptcha: false, contribuyente, establecimientos };
  }

  return { blockedCaptcha: true };
}
