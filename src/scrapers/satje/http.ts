import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

const BASE = env.SATJE_API_BASE;

const PATHS = {
  buscarCausas: "/EXPEL-CONSULTA-CAUSAS-SERVICE/api/consulta-causas/informacion/buscarCausas",
  contarCausas: "/EXPEL-CONSULTA-CAUSAS-SERVICE/api/consulta-causas/informacion/contarCausas",
  getInformacionJuicio: "/EXPEL-CONSULTA-CAUSAS-SERVICE/api/consulta-causas/informacion/getInformacionJuicio",
  actuacionesJudiciales: "/EXPEL-CONSULTA-CAUSAS-SERVICE/api/consulta-causas/informacion/actuacionesJudiciales",
  getIncidenteJudicatura: "/EXPEL-CONSULTA-CAUSAS-CLEX-SERVICE/api/consulta-causas-clex/informacion/getIncidenteJudicatura",
};

const COMMON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/plain, */*",
  Origin: "https://procesosjudiciales.funcionjudicial.gob.ec",
  Referer: "https://procesosjudiciales.funcionjudicial.gob.ec/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

const http = axios.create({ baseURL: BASE, headers: COMMON_HEADERS, timeout: 20000 });

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const status = err.response?.status || "SIN_RESPUESTA";
    logger.error(`[satje] HTTP ${status} en ${url}: ${err.message}`);
    return Promise.reject(err);
  }
);

/**
 * El endpoint de búsqueda del SATJE acepta el literal "verdad" como valor de
 * `recaptcha` — el backend no lo valida server-side para este flujo. No hace
 * falta Puppeteer para buscar causas: es HTTP directo de punta a punta.
 */
function buildPayload(cedula: string, page = 1, pageSize = 10) {
  return {
    numeroCausa: "",
    actor: { cedulaActor: "", nombreActor: "" },
    demandado: { cedulaDemandado: cedula, nombreDemandado: "" },
    first: page,
    numeroFiscalia: "",
    pageSize,
    provincia: "",
    recaptcha: "verdad",
  };
}

export async function buscarCausas(cedula: string, page = 1, pageSize = 10): Promise<any> {
  const { data } = await http.post(`${PATHS.buscarCausas}?page=${page}&size=${pageSize}`, buildPayload(cedula, page, pageSize));
  return data;
}

export async function contarCausas(cedula: string): Promise<number> {
  const { data } = await http.post(PATHS.contarCausas, buildPayload(cedula));
  return data;
}

export async function getInformacionJuicio(idJuicio: string): Promise<any> {
  const { data } = await http.get(`${PATHS.getInformacionJuicio}/${idJuicio}`);
  return data;
}

async function getIncidenteJudicatura(idJuicio: string): Promise<any[]> {
  const { data } = await http.get(`${PATHS.getIncidenteJudicatura}/${idJuicio}`);
  return data;
}

async function actuacionesJudiciales(params: {
  idMovimientoJuicioIncidente: unknown;
  idJuicio: string;
  idJudicatura: unknown;
  idIncidenteJudicatura: unknown;
  nombreJudicatura: unknown;
  incidente: unknown;
}): Promise<any> {
  const { data } = await http.post(PATHS.actuacionesJudiciales, { ...params, aplicativo: "web" });
  return data;
}

/** Recorre todos los incidentes/judicaturas de un juicio y trae sus actuaciones. */
export async function getAllActuacionesForJuicio(idJuicio: string): Promise<any[]> {
  const incidentes = await getIncidenteJudicatura(idJuicio);
  const results: any[] = [];

  for (const judicatura of incidentes) {
    for (const inc of judicatura.lstIncidenteJudicatura || []) {
      const actuaciones = await actuacionesJudiciales({
        idMovimientoJuicioIncidente: inc.idMovimientoJuicioIncidente,
        idJuicio,
        idJudicatura: judicatura.idJudicatura,
        idIncidenteJudicatura: inc.idIncidenteJudicatura,
        nombreJudicatura: judicatura.nombreJudicatura,
        incidente: inc.incidente,
      });
      results.push({
        idJudicatura: judicatura.idJudicatura,
        nombreJudicatura: judicatura.nombreJudicatura,
        incidente: inc.incidente,
        litigantesActor: inc.lstLitiganteActor,
        litigantesDemandado: inc.lstLitiganteDemandado,
        actuaciones,
      });
    }
  }

  return results;
}
