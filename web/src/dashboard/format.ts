import { Source } from "../api/types";

export const SOURCE_SLUGS: Record<Source, string> = {
  DATADIVERSERVICE: "datadiverservice",
  SATJE: "satje",
  SRI: "sri",
  ANT: "ant",
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Las fechas de nacimiento/defunción llegan como calendario puro (medianoche
  // UTC) — sin timeZone:"UTC" acá, toLocaleDateString las corre a la zona
  // horaria local del navegador y en cualquier huso negativo (Ecuador, UTC-5)
  // el 6 de abril se muestra como 5 de abril.
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" });
}

/**
 * Edad calculada en el navegador a partir del nacimiento (y de la defunción,
 * si la hay — la edad de alguien fallecido es la que tenía al morir, no la
 * que tendría hoy). Usa los componentes UTC de la fecha por la misma razón
 * que formatDate: son fechas calendario, no momentos con hora real.
 */
export function calculateAge(birthDate: string | null | undefined, deathDate?: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const end = deathDate ? new Date(deathDate) : new Date();
  if (Number.isNaN(end.getTime())) return null;

  let age = end.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = end.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && end.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

/**
 * Compara el día/mes de nacimiento (calendario puro, por eso getUTC*) contra
 * el día de hoy en la zona local del navegador (por eso get* sin UTC) — así
 * "hoy" es el día que ve la persona que está mirando la pantalla, no UTC.
 */
export function isBirthdayToday(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  return birth.getUTCMonth() === today.getMonth() && birth.getUTCDate() === today.getDate();
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const diffMs = Date.now() - then;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return "recién";
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `hace ${diffDay} d`;
  return formatDate(iso);
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}
