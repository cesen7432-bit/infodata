import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { dataDiverAuth } from "./auth";

const BASE_URL = `${env.DATADIVERSERVICE_API_URL}/ds/crn/client/info`;
const CLIENT_ROOT = `${env.DATADIVERSERVICE_API_URL}/ds/crn/client`;
const COMPANY_ROOT = `${env.DATADIVERSERVICE_API_URL}/ds/crm/company`;

interface RawFetchAll {
  general: Record<string, any> | null;
  contact: Record<string, any> | null;
  family: Record<string, any> | null;
  vehicle: Record<string, any> | null;
  labour: Record<string, any> | null;
  property: Record<string, any> | null;
}

async function getUrl(url: string, params: Record<string, string>): Promise<{ data: any; status: number }> {
  await dataDiverAuth.ensureAuthenticated();

  try {
    const response = await axios.get(url, {
      params,
      headers: dataDiverAuth.getAuthHeaders(),
      timeout: 15000,
    });
    return { data: fixEncoding(response.data), status: response.status };
  } catch (err: any) {
    if (err.response) {
      const status = err.response.status;
      if (status === 404) return { data: null, status: 404 };

      if (status === 401 || status === 403) {
        logger.warn("[datadiverservice] token expirado, renovando...", { url });
        dataDiverAuth.invalidateToken();
        await dataDiverAuth.ensureAuthenticated();

        const retry = await axios.get(url, {
          params,
          headers: dataDiverAuth.getAuthHeaders(),
          timeout: 15000,
        });
        return { data: fixEncoding(retry.data), status: retry.status };
      }
    }
    throw err;
  }
}

function get(path: string, params: Record<string, string>): Promise<{ data: any; status: number }> {
  return getUrl(`${BASE_URL}/${path}`, params);
}

/** Corrige doble codificación UTF-8 (ej. "PIÃ'AS" → "PIÑAS") recursivamente. */
function fixEncoding(obj: any): any {
  if (typeof obj === "string") {
    try {
      const decoded = Buffer.from(obj, "latin1").toString("utf8");
      if (decoded !== obj && !decoded.includes("�")) return decoded;
    } catch {
      // no-op
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(fixEncoding);
  if (obj && typeof obj === "object") {
    const fixed: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) fixed[k] = fixEncoding(v);
    return fixed;
  }
  return obj;
}

function value(r: PromiseSettledResult<{ data: any; status: number }>, name: string): any {
  if (r.status === "rejected") {
    logger.warn(`[datadiverservice] endpoint falló: ${name}`, { error: (r.reason as Error)?.message });
    return null;
  }
  if (r.value.status === 404) return null;
  return r.value.data;
}

/**
 * DataDiverService no solo trae identidad+contacto+familia — también vehículos,
 * historial laboral y propiedades bajo esa misma cédula. El puerto original de
 * este servicio dejaba esos tres endpoints afuera; se restituyen acá.
 */
export async function fetchAll(dni: string): Promise<RawFetchAll> {
  const [general, contact, familyNew, family, vehicle, labour, property] = await Promise.allSettled([
    get("general/new", { dni }),
    get("contact", { dni }),
    get("family/new", { dni }),
    get("family", { dni }),
    get("vehicle", { dni }),
    get("labournew", { dni }),
    get("property", { dni }),
  ]);

  const familyData = value(familyNew, "family/new") ?? value(family, "family");

  return {
    general: value(general, "general/new"),
    contact: value(contact, "contact"),
    family: familyData,
    vehicle: value(vehicle, "vehicle"),
    labour: value(labour, "labournew"),
    property: value(property, "property"),
  };
}

/**
 * Búsqueda inversa real: dada una placa, DataDiverService devuelve el/los
 * vehículo(s) junto con la identidad de su dueño (dni, fullname...) en el
 * mismo objeto — a diferencia de fetchAll, este endpoint vive fuera de
 * /info/ (es /ds/crn/client/findByCarRegistration, no /ds/crn/client/info/*).
 */
export async function findByCarRegistration(plate: string): Promise<Record<string, any>[]> {
  const { data, status } = await getUrl(`${CLIENT_ROOT}/findByCarRegistration`, { carRegistration: plate });
  if (status !== 200 || !Array.isArray(data)) return [];
  return data;
}

export interface RawCompanyContact {
  contacto: string;
  tipo: string;
}

/**
 * Contacto de RUCs de sociedad (los que no derivan de una cédula de persona
 * natural, ej. "...9..." o "...6..." en la tercera posición) — vive fuera de
 * /info/ y de /crn/client/*, es /ds/crm/company/info/contact. Solo trae
 * teléfonos y correos mezclados en una lista plana (sin distinguir tipo de
 * forma confiable ni deduplicar — eso lo hace `transformCompanyContact`).
 */
export async function fetchCompanyContact(ruc: string): Promise<RawCompanyContact[]> {
  const { data, status } = await getUrl(`${COMPANY_ROOT}/info/contact`, { ruc });
  if (status !== 200 || !Array.isArray(data)) return [];
  return data;
}
