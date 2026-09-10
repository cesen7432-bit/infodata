import type { HTTPResponse } from "puppeteer";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { dataDiverBrowser } from "./browser";

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Login vía Puppeteer: rellena el formulario (reCAPTCHA v3 incluido, se resuelve
 * solo con comportamiento humano) e intercepta el Bearer token JWT de la respuesta.
 * El token dura ~5h — no hace falta loguear en cada consulta.
 */
class DataDiverAuth {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private loginPromise: Promise<void> | null = null;

  async performLogin(maxRetries = 3): Promise<void> {
    if (this.loginPromise) return this.loginPromise;

    this.loginPromise = (async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await this.doLogin();
          return;
        } catch (err) {
          lastError = err;
          logger.warn(`[datadiverservice] login fallido (${attempt}/${maxRetries})`, {
            error: (err as Error).message,
          });
          if (attempt < maxRetries) await delay(3000 * attempt);
        }
      }
      throw lastError;
    })().finally(() => {
      this.loginPromise = null;
    });

    return this.loginPromise;
  }

  private async doLogin(): Promise<void> {
    const browser = await dataDiverBrowser.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setDefaultNavigationTimeout(25000);

      let tokenResolve!: (t: string) => void;
      let tokenReject!: (e: Error) => void;
      const tokenPromise = new Promise<string>((res, rej) => {
        tokenResolve = res;
        tokenReject = rej;
      });
      void tokenReject;

      page.on("response", async (response: HTTPResponse) => {
        if (response.url().includes("/login") && response.request().method() === "POST") {
          try {
            const data = await response.json();
            if (data.accessToken) tokenResolve(data.accessToken);
          } catch {
            // respuesta no JSON, ignorar
          }
        }
      });

      await page.goto(`${env.DATADIVERSERVICE_BASE_URL}/auth/login`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });

      await page.waitForSelector("input#mat-input-0", { timeout: 12000 });
      await delay(3000 + Math.random() * 1000);

      await page.click("input#mat-input-0");
      await delay(200 + Math.random() * 150);
      await page.type("input#mat-input-0", env.DATADIVERSERVICE_USER, { delay: 60 + Math.random() * 30 });

      await delay(300 + Math.random() * 200);
      await page.click("input#mat-input-1");
      await delay(150 + Math.random() * 100);
      await page.type("input#mat-input-1", env.DATADIVERSERVICE_PASS, { delay: 60 + Math.random() * 30 });

      await delay(400 + Math.random() * 200);
      await page.click("button#kt_login_signin_submit");

      const token = await Promise.race([
        tokenPromise,
        new Promise<string>((_, rej) => setTimeout(() => rej(new Error("Token no capturado en 30s")), 30000)),
      ]);

      this.accessToken = token;

      try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        this.tokenExpiry = payload.exp * 1000;
      } catch {
        this.tokenExpiry = Date.now() + 5 * 60 * 60 * 1000;
      }

      logger.info("[datadiverservice] login OK, token capturado");
    } finally {
      await page.close().catch(() => {});
    }
  }

  async ensureAuthenticated(): Promise<void> {
    const thirtyMinutes = 30 * 60 * 1000;
    if (!this.accessToken || !this.tokenExpiry || Date.now() > this.tokenExpiry - thirtyMinutes) {
      await this.performLogin();
    }
  }

  /** Fuerza un re-login en la próxima llamada a ensureAuthenticated (token 401/403). */
  invalidateToken(): void {
    this.accessToken = null;
  }

  getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
      "Accept-Language": "es-ES,es;q=0.9",
      "Content-Type": "application/json",
      Origin: env.DATADIVERSERVICE_BASE_URL,
      Referer: `${env.DATADIVERSERVICE_BASE_URL}/`,
      "User-Agent": CHROME_USER_AGENT,
    };
  }

  get isTokenValid(): boolean {
    return !!this.accessToken && !!this.tokenExpiry && Date.now() < this.tokenExpiry;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const dataDiverAuth = new DataDiverAuth();
