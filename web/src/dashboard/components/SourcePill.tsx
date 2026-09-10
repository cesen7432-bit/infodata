export type Status = "found" | "not-found" | "blocked" | "unchecked" | "error";

export function StatusPill({ status }: { status: Status }) {
  const copy: Record<Status, string> = {
    found: "Con datos",
    "not-found": "Sin datos",
    blocked: "Bloqueado por CAPTCHA",
    unchecked: "No consultado",
    error: "Error al consultar",
  };
  return <span className={`pill status-pill status-${status}`}>{copy[status]}</span>;
}
