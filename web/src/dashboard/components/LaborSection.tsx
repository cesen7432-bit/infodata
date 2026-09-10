import { Briefcase } from "lucide-react";
import { LaborRecord } from "../../api/types";
import { SectionCard } from "./SectionCard";

export function LaborSection({ records }: { records: LaborRecord[] }) {
  return (
    <SectionCard
      title="Historial laboral"
      icon={Briefcase}
      tint="var(--warn)"
      isEmpty={records.length === 0}
      emptyLabel="No hay registros laborales."
    >
      <ul className="fact-list">
        {records.map((r) => (
          <li key={r.id} className="fact-item fact-item-row">
            <div className="fact-main">
              <span>{r.employerName || "Empleador no disponible"}</span>
              <span className="fact-meta">{[r.position, r.status, r.startDate].filter(Boolean).join(" · ") || "Sin detalle adicional"}</span>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
