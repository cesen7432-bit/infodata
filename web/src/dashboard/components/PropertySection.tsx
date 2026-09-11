import { Home } from "lucide-react";
import { PropertyRecord } from "../../api/types";
import { SectionCard } from "./SectionCard";

export function PropertySection({ records }: { records: PropertyRecord[] }) {
  return (
    <SectionCard
      title="Propiedades"
      icon={Home}
      tint="var(--accent-2)"
      isEmpty={records.length === 0}
      emptyLabel="No hay bienes registrados."
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
