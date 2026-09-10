import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { redis } from "../../cache/redis";
import { dataDiverAuth } from "./auth";

const FAMILY_TTL_SECONDS = 10 * 60;
const FAMILY_KEYS = ["family", "data", "results", "relatives", "parentesco"] as const;

export interface RawFamilyData {
  family: any[];
  data: any[];
  results: any[];
  relatives: any[];
  parentesco: any[];
}

function emptyFamily(): RawFamilyData {
  return { family: [], data: [], results: [], relatives: [], parentesco: [] };
}

function totalMembers(d: RawFamilyData): number {
  return FAMILY_KEYS.reduce((sum, k) => sum + (d[k]?.length ?? 0), 0);
}

function combine(target: RawFamilyData, data: any): void {
  for (const key of FAMILY_KEYS) {
    if (Array.isArray(data?.[key])) target[key].push(...data[key]);
  }
}

function removeDuplicates(d: RawFamilyData): void {
  const seen = new Set<string>();
  for (const key of FAMILY_KEYS) {
    d[key] = d[key].filter((member) => {
      const dni = member.dni || member.identification || member.cedula;
      const name = member.fullname || member.name || member.nombre;
      const birth = member.dateOfBirth || member.birthDate || member.fechaNacimiento || "";
      const id = `${dni || ""}-${name || ""}-${birth}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureAttempt(dni: string, includeAlternative: boolean): Promise<RawFamilyData> {
  const primary = [
    `${env.DATADIVERSERVICE_API_URL}/ds/crn/client/info/family/new?dni=${dni}`,
    `${env.DATADIVERSERVICE_API_URL}/ds/crn/client/info/family?dni=${dni}`,
    `${env.DATADIVERSERVICE_API_URL}/ds/crm/client/family?dni=${dni}`,
    `${env.DATADIVERSERVICE_API_URL}/ds/crn/client/genoma?dni=${dni}`,
    `${env.DATADIVERSERVICE_API_URL}/ds/crn/client/info/relatives?dni=${dni}`,
  ];
  const alternative = [
    `${env.DATADIVERSERVICE_API_URL}/ds/crn/client/family?dni=${dni}`,
    `${env.DATADIVERSERVICE_API_URL}/ds/crm/client/info/family?dni=${dni}`,
    `${env.DATADIVERSERVICE_API_URL}/ds/crn/client/info/parentesco?dni=${dni}`,
  ];
  const endpoints = includeAlternative ? [...primary, ...alternative] : primary;

  const combined = emptyFamily();

  for (const endpoint of endpoints) {
    try {
      await dataDiverAuth.ensureAuthenticated();
      const res = await axios.get(endpoint, {
        headers: { ...dataDiverAuth.getAuthHeaders(), "Cache-Control": "no-cache" },
        timeout: 10000,
        validateStatus: () => true,
      });

      if (res.status === 401 || res.status === 403) {
        logger.warn("[datadiverservice] token expirado en endpoint de familia");
        break;
      }
      if (res.status >= 200 && res.status < 300) {
        combine(combined, res.data);
      }
      await delay(includeAlternative ? 300 : 150);
    } catch (err) {
      logger.debug("[datadiverservice] error en endpoint de familia", {
        endpoint,
        error: (err as Error).message,
      });
    }
  }

  return combined;
}

/**
 * Estrategia de doble consulta: la primera activa la carga de datos del lado
 * del proveedor; si trae pocos resultados, una segunda pasada (con más
 * endpoints, tras una breve espera) suele completar el árbol familiar.
 */
export async function getFamily(dni: string): Promise<RawFamilyData> {
  const cacheKey = `cache:datadiverservice:family:${dni}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as RawFamilyData;

  let result = await captureAttempt(dni, false);
  let members = totalMembers(result);

  if (members < 2) {
    await delay(2000);
    const second = await captureAttempt(dni, true);
    const secondMembers = totalMembers(second);
    if (secondMembers > members) {
      result = second;
      members = secondMembers;
    } else {
      for (const key of FAMILY_KEYS) result[key].push(...second[key]);
      removeDuplicates(result);
      members = totalMembers(result);
    }
  }

  removeDuplicates(result);

  if (totalMembers(result) > 0) {
    await redis.set(cacheKey, JSON.stringify(result), "EX", FAMILY_TTL_SECONDS);
  }

  return result;
}
