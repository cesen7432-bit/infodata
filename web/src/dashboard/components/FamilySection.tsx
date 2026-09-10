import { Cake, Users } from "lucide-react";
import { FamilyLink } from "../../api/types";
import { SectionCard } from "./SectionCard";
import { calculateAge, formatDate, isBirthdayToday } from "../format";

interface FamilySectionProps {
  links: FamilyLink[];
  onSearch: (identificacion: string) => void;
}

export function FamilySection({ links, onSearch }: FamilySectionProps) {
  return (
    <SectionCard
      title="Familiares"
      icon={Users}
      tint="var(--accent)"
      isEmpty={links.length === 0}
      emptyLabel="No hay familiares registrados."
    >
      <ul className="fact-list">
        {links.map((f) => {
          const age = calculateAge(f.relatedBirthDate, f.relatedDeathDate);
          return (
            <li key={f.id} className="fact-item fact-item-row">
              <div className="fact-main">
                <span>{f.relatedName || "Nombre no disponible"}</span>
                <div className="fact-labels">
                  {f.relationshipType && <span className="pill relationship-pill">{f.relationshipType}</span>}
                  {age !== null && <span className="pill age-pill">{age} años</span>}
                  {!f.relatedDeathDate && isBirthdayToday(f.relatedBirthDate) && (
                    <span className="pill birthday-pill">
                      <Cake size={13} strokeWidth={2} aria-hidden="true" /> Cumple hoy
                    </span>
                  )}
                </div>
                <span className="fact-meta">
                  {[f.relatedIdentification, f.relatedBirthDate ? formatDate(f.relatedBirthDate) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className="fact-tags">
                {f.relatedIdentification && (
                  <button type="button" className="btn btn-tiny" onClick={() => onSearch(f.relatedIdentification!)}>
                    Consultar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
