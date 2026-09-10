import { Scale } from "lucide-react";
import { JudicialCase } from "../../api/types";
import { SectionCard } from "./SectionCard";
import { StatusPill, Status } from "./SourcePill";

function emptyLabelFor(status: Status): string {
  if (status === "blocked") return "La consulta fue bloqueada — reintentar más tarde.";
  if (status === "error") return "No se pudo completar la consulta — reintenta la búsqueda.";
  return "No se encontraron causas judiciales.";
}

export function JudicialSection({ cases, status }: { cases: JudicialCase[]; status: Status }) {
  return (
    <SectionCard
      title="Causas judiciales"
      icon={Scale}
      tint="var(--accent)"
      statusPill={<StatusPill status={status} />}
      isEmpty={cases.length === 0}
      emptyLabel={emptyLabelFor(status)}
    >
      <ul className="fact-list">
        {cases.map((c) => (
          <li key={c.id} className="fact-item">
            <div className="fact-main">
              <span>{c.caseNumber || c.caseId || "Causa sin número"}</span>
              <span className="fact-meta">
                {[c.court, c.province, c.role].filter(Boolean).join(" · ") || "Sin detalle adicional"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
