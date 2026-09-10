/**
 * Normaliza a formato local ecuatoriano (con el 0 inicial): "593978950498" y
 * "0978950498" son el mismo número pero llegan como strings distintos según
 * la fuente — sin esto se guardan duplicados y una búsqueda por teléfono no
 * encuentra nada si el formato no coincide letra por letra.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("593") && digits.length >= 11) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("0")) {
    return digits;
  }
  // 9 dígitos sin 0 inicial ni 593 (ej. "978950498") — falta el 0 local.
  if (digits.length === 9) {
    return `0${digits}`;
  }
  return digits;
}

/** true si el texto tiene forma de teléfono ecuatoriano (no de cédula/RUC/placa). */
export function looksLikePhone(raw: string): boolean {
  const normalized = normalizePhone(raw);
  return /^0\d{8,9}$/.test(normalized);
}

/**
 * Placas ecuatorianas no son un solo patrón: autos/camionetas son 3 letras +
 * 3-4 dígitos ("ABC1234"), pero motos y otras categorías mezclan letras y
 * números en otros órdenes ("IV188M"). En vez de fijar un formato exacto,
 * acepta cualquier combinación corta de letras y dígitos con ambos presentes.
 */
export function looksLikePlate(raw: string): boolean {
  const cleaned = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{5,8}$/.test(cleaned)) return false;
  return /[A-Z]/.test(cleaned) && /[0-9]/.test(cleaned);
}

export function normalizePlate(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}
