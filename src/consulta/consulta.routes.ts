import { Router } from "express";
import { Source } from "@prisma/client";
import { requireAuth, requireAuthOrApiKey } from "../auth/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { resolveConsulta } from "./consulta.service";
import { toContactView } from "./contactView";
import { getSourceHandler, SOURCE_SLUGS, ALL_SOURCES } from "../scrapers/registry";
import { findIdentificationByPhone, findIdentificationByPlate, getConsolidatedPerson } from "../db/personRepository";
import { getRecentSearches, recordSearch } from "./searchHistory.service";
import { logger } from "../lib/logger";
import { looksLikePhone, looksLikePlate, normalizePhone, normalizePlate } from "../lib/phone";
import { findOwnerDniByPlate } from "../scrapers/datadiverservice/adapter";

export const consultaRouter = Router();

// Límite por fuente en la vista consolidada: si una fuente está caída o lenta,
// no debe retener la respuesta esperando sus 90s completos de `waitUntilFinished`
// — las demás fuentes ya habrán terminado.
// El job igual sigue corriendo en la cola y cachea su resultado para la
// próxima consulta; acá simplemente dejamos de esperarlo.
const CONSOLIDATED_SOURCE_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`tiempo de espera agotado (${ms}ms)`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Ruta literal — debe ir antes de "/:identificacion" y "/:fuente/:identificacion",
// si no Express la confunde con una identificación o una fuente.
consultaRouter.get(
  "/historial",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getRecentSearches(req.user!.id));
  })
);

/**
 * Vista consolidada: dispara la cascada caché → BD → cola en las 4 fuentes en
 * paralelo y devuelve la persona con todos los hechos vigentes, cada uno ya
 * atribuido a su fuente (plan, sección 05). Cada búsqueda queda registrada
 * en el historial del usuario que la hizo.
 *
 * Con API key la respuesta es distinta: solo se consulta DataDiverService (o
 * la base interna ya poblada por él) — ninguna otra fuente — y se devuelve un
 * objeto reducido de identidad y contacto (ver `toContactView`). Estas
 * consultas no registran historial (no hay usuario detrás).
 */
consultaRouter.get(
  "/:identificacion",
  requireAuthOrApiKey,
  asyncHandler(async (req, res) => {
    const apiKeyMode = !!req.apiKey;
    const rawInput = req.params.identificacion.trim();
    let identificacion = rawInput;
    let applicableSources = ALL_SOURCES.filter((source) => getSourceHandler(source).validateIdentification(identificacion));

    // No es cédula ni RUC de ninguna fuente — puede ser un teléfono o una
    // placa. Esto es una búsqueda inversa dentro de lo ya scrapeado, no
    // dispara ninguna consulta externa nueva.
    if (applicableSources.length === 0) {
      let foundBy: string | null = null;

      if (looksLikePhone(rawInput)) {
        foundBy = await findIdentificationByPhone(normalizePhone(rawInput));
      }
      if (!foundBy && looksLikePlate(rawInput)) {
        const plate = normalizePlate(rawInput);
        foundBy = await findIdentificationByPlate(plate);

        // Todavía no está en nuestra base — DataDiverService responde placa
        // → dueño directo, así que vale la pena un intento en vivo antes de
        // rendirse (no pasa por la cola: es una búsqueda puntual, no un scrape completo).
        if (!foundBy) {
          try {
            foundBy = await findOwnerDniByPlate(plate);
          } catch (err) {
            logger.warn("búsqueda en vivo por placa falló", { plate, error: (err as Error).message });
          }
        }
      }

      if (foundBy) {
        identificacion = foundBy;
        applicableSources = ALL_SOURCES.filter((source) => getSourceHandler(source).validateIdentification(identificacion));
      }
    }

    // Por API key solo DataDiverService: es la única fuente de los datos de
    // contacto y el único servicio externo permitido para este endpoint.
    if (apiKeyMode) {
      applicableSources = applicableSources.filter((source) => source === Source.DATADIVERSERVICE);
    }

    const perSource = await Promise.allSettled(
      applicableSources.map(async (source) => ({
        source,
        result: await withTimeout(resolveConsulta(source, identificacion), CONSOLIDATED_SOURCE_TIMEOUT_MS),
      }))
    );

    const sources: Record<string, unknown> = {};
    perSource.forEach((r, i) => {
      if (r.status === "fulfilled") {
        sources[r.value.source.toLowerCase()] = {
          found: r.value.result.found,
          resolvedFrom: r.value.result.resolvedFrom,
          blockedCaptcha: r.value.result.blockedCaptcha ?? false,
        };
      } else {
        // No lo escondemos: una fuente que falló es un estado distinto de
        // "no se consultó porque el formato no aplica" — el bug que motivó
        // esto (jobId con ":" reventando en BullMQ) quedaba invisible acá.
        // Si lo que pasó fue que se agotó CONSOLIDATED_SOURCE_TIMEOUT_MS, el
        // job sigue vivo en la cola: no lo esperamos más, pero terminará y
        // quedará cacheado para la próxima consulta.
        const source = applicableSources[i];
        const timedOut = r.reason?.message?.includes("tiempo de espera agotado");
        logger.error("fuente falló en la consulta consolidada", { source, identificacion, error: r.reason?.message });
        sources[source.toLowerCase()] = { found: false, resolvedFrom: timedOut ? "pending" : "error", blockedCaptcha: false };
      }
    });

    const person = await getConsolidatedPerson(identificacion);
    if (req.user) await recordSearch(req.user.id, identificacion, !!person);

    if (apiKeyMode) {
      if (!person) {
        res.status(404).json({ identification: identificacion, error: "No se encontró información para esa identificación" });
        return;
      }
      res.json(toContactView(identificacion, person));
      return;
    }

    res.status(person ? 200 : 404).json({ identification: identificacion, sources, person });
  })
);

consultaRouter.get(
  "/:fuente/:identificacion",
  requireAuth,
  asyncHandler(async (req, res) => {
    const source = SOURCE_SLUGS[req.params.fuente.toLowerCase()];
    if (!source) {
      res.status(404).json({ error: `Fuente "${req.params.fuente}" no reconocida`, disponibles: Object.keys(SOURCE_SLUGS) });
      return;
    }

    const identificacion = req.params.identificacion.trim();
    const handler = getSourceHandler(source);
    if (!handler.validateIdentification(identificacion)) {
      res.status(400).json({ error: "Identificación inválida para esta fuente" });
      return;
    }

    try {
      const result = await resolveConsulta(source, identificacion);
      if (result.blockedCaptcha) {
        res.status(423).json({
          ...result,
          message: "La fuente bloqueó la consulta con un CAPTCHA que no se pudo resolver automáticamente. Requiere intervención manual.",
        });
        return;
      }
      res.status(result.found ? 200 : 404).json(result);
    } catch (err) {
      res
        .status(504)
        .json({ error: "La consulta no pudo completarse a tiempo, intenta de nuevo", detail: (err as Error).message });
    }
  })
);
