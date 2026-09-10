/** Convierte dd/mm/yyyy → yyyy-mm-dd (o pasa yyyy-mm-dd tal cual). Null si no reconoce el formato. */
export function convertDateFormat(dateStr?: string | null): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const s = dateStr.trim();

  const slashParts = s.split("/");
  if (slashParts.length === 3) {
    const day = slashParts[0].padStart(2, "0");
    const month = slashParts[1].padStart(2, "0");
    const year = slashParts[2];
    return `${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return null;
}
