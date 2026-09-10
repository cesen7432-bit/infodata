import { Home } from "lucide-react";
import { PropertyRecord } from "../../api/types";
import { SectionCard } from "./SectionCard";
import { StatusPill, Status } from "./SourcePill";

function emptyLabelFor(status: Status): string {
  if (status === "blocked") return "La consulta fue bloqueada — reintentar más tarde.";
  if (status === "error") return "No se pudo completar la consulta — reintenta la búsqueda.";
  return "No hay bienes registrados.";
}

export function PropertySection({ records, status }: { records: PropertyRecord[]; status: Status }) {
  return (
    <SectionCard
      title="Propiedades"
      icon={Home}
      tint="var(--accent-2)"
      statusPill={<StatusPill status={status} />}
      isEmpty={records.length === 0}
      emptyLabel={emptyLabelFor(status)}
    >
      <ul className="fact-list">
        {records.map((r) => (
          <li key={r.id} className="fact-item">
            <div className="fact-main">
              <span>{r.recordType || "Registro sin tipo"}</span>
              <span className="fact-meta">
                {[r.number1, r.number2, r.role, r.recordDate].filter(Boolean).join(" · ") || "Sin detalle adicional"}
              </span>
              {r.detail && <span className="fact-meta">{r.detail}</span>}
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
