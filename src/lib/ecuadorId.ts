/** Valida cédula ecuatoriana: 10 dígitos, provincia 01-24, dígito verificador Módulo 10. */
export function isValidCedula(id: string): boolean {
  if (!/^\d{10}$/.test(id)) return false;

  const province = parseInt(id.substring(0, 2), 10);
  if (province < 1 || province > 24) return false;

  const thirdDigit = parseInt(id[2], 10);
  if (thirdDigit <= 5) {
    const coeff = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let val = parseInt(id[i], 10) * coeff[i];
      if (val >= 10) val -= 9;
      sum += val;
    }
    const check = (10 - (sum % 10)) % 10;
    return check === parseInt(id[9], 10);
  }
  return thirdDigit === 6 || thirdDigit === 9;
}

/** Valida RUC ecuatoriano: 13 dígitos, los primeros 10 siguen la regla de cédula (persona natural) o el patrón de entidad pública/privada. */
export function isValidRuc(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  const base = id.substring(0, 10);
  const thirdDigit = parseInt(id[2], 10);
  if (thirdDigit <= 5) return isValidCedula(base);
  return thirdDigit === 6 || thirdDigit === 9;
}

/**
 * El RUC de una persona natural en Ecuador es su cédula + "001" (el
 * establecimiento matriz) — nunca un número aparte. Valida la cédula primero
 * (checksum incluido) antes de derivar nada; null si no es una cédula válida.
 */
export function deriveNaturalPersonRuc(cedula: string): string | null {
  if (!isValidCedula(cedula)) return null;
  const ruc = `${cedula}001`;
  return isValidRuc(ruc) ? ruc : null;
}

/**
 * La cara inversa de deriveNaturalPersonRuc: si buscás con la cédula, o con
 * el RUC de persona natural derivado de esa cédula, esto devuelve la cédula
 * en ambos casos — así SATJE/ANT/DataDiverService (que solo hablan en
 * cédula) igual se consultan sin importar cuál de las dos escribiste.
 */
export function resolveCedulaFromIdentification(identification: string): string | null {
  if (isValidCedula(identification)) return identification;
  if (isValidRuc(identification)) {
    const base = identification.substring(0, 10);
    if (isValidCedula(base)) return base;
  }
  return null;
}

/**
 * true si el RUC (13 dígitos) es de una sociedad privada (tercer dígito 9) o
 * una entidad del sector público (tercer dígito 6) — nunca hay una cédula de
 * persona natural detrás, aunque `isValidCedula`/`resolveCedulaFromIdentification`
 * "validen" esos mismos 10 dígitos base como si lo fuera (esas funciones
 * verifican el formato numérico, no si en verdad es la cédula de alguien —
 * el tercer dígito 6/9 pasa sin checksum ahí a propósito, para que
 * `isValidRuc` pueda reusar la misma verificación de rango/provincia).
 * Este helper es el que sí distingue las dos cosas cuando importa (ej. elegir
 * qué endpoint de DataDiverService consultar).
 */
export function isCompanyRuc(identification: string): boolean {
  if (identification.length !== 13 || !isValidRuc(identification)) return false;
  const thirdDigit = parseInt(identification[2], 10);
  return thirdDigit === 6 || thirdDigit === 9;
}
