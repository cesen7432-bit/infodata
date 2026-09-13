import { useMemo, useState } from "react";
import { Cake, ChevronDown, ChevronUp, Users } from "lucide-react";
import { FamilyLink } from "../../api/types";
import { calculateAge, formatDate, isBirthdayToday } from "../format";

interface FamilySectionProps {
  links: FamilyLink[];
  onSearch: (identificacion: string) => void;
}

type FamilyTier = "nucleo" | "cercana" | "extendida";

// Cercanía de parentesco (plan de UI: familiares agrupados por círculo, no en
// una lista plana) — todo lo que no matchee núcleo/cercana cae en extendida,
// así cualquier relación que la fuente devuelva con una etiqueta rara sigue
// teniendo un lugar donde aparecer.
const NUCLEO_KEYWORDS = ["CONYUGE", "ESPOSO", "ESPOSA", "PAREJA", "UNION LIBRE", "HIJO", "HIJA"];
const CERCANA_KEYWORDS = ["PADRE", "MADRE", "HERMANO", "HERMANA"];

const TIER_ORDER: FamilyTier[] = ["nucleo", "cercana", "extendida"];

const TIER_CONFIG: Record<FamilyTier, { label: string; sub: string; tint: string }> = {
  nucleo: { label: "Núcleo familiar", sub: "Relaciones más cercanas y prioritarias", tint: "var(--good)" },
  cercana: { label: "Familia cercana", sub: "Padres, hermanos y descendientes", tint: "var(--accent)" },
  extendida: { label: "Familia extendida", sub: "Abuelos, tíos y otros vínculos", tint: "var(--ink-soft)" },
};

const FILTERS: { key: "todos" | FamilyTier; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "nucleo", label: "Núcleo" },
  { key: "cercana", label: "Cercana" },
  { key: "extendida", label: "Extendida" },
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

function tierFor(relationshipType: string | null): FamilyTier {
  if (!relationshipType) return "extendida";
  const r = normalize(relationshipType);
  if (NUCLEO_KEYWORDS.some((k) => r.includes(k))) return "nucleo";
  if (CERCANA_KEYWORDS.some((k) => r.includes(k))) return "cercana";
  return "extendida";
}

export function FamilySection({ links, onSearch }: FamilySectionProps) {
  const [filter, setFilter] = useState<"todos" | FamilyTier>("todos");
  const [collapsed, setCollapsed] = useState<Record<FamilyTier, boolean>>({
    nucleo: false,
    cercana: false,
    extendida: false,
  });

  const groups = useMemo(() => {
    const byTier: Record<FamilyTier, FamilyLink[]> = { nucleo: [], cercana: [], extendida: [] };
    for (const link of links) byTier[tierFor(link.relationshipType)].push(link);
    return byTier;
  }, [links]);

  if (links.length === 0) {
    return (
      <div className="family-panel">
        <p className="section-empty">No hay familiares registrados.</p>
      </div>
    );
  }

  const visibleTiers = filter === "todos" ? TIER_ORDER : [filter];

  return (
    <div className="family-panel">
      <div className="family-panel-head">
        <div>
          <h3>
            {links.length} familiar{links.length === 1 ? "" : "es"} identificado{links.length === 1 ? "" : "s"}
          </h3>
          <p className="family-panel-sub">Ordenados por cercanía de parentesco</p>
        </div>
        <div className="family-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`family-tab${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visibleTiers.map((tier) => {
        const items = groups[tier];
        if (items.length === 0) return null;
        const config = TIER_CONFIG[tier];
        const isCollapsed = collapsed[tier];

        return (
          <div className="family-group" key={tier}>
            <button
              type="button"
              className="family-group-head"
              onClick={() => setCollapsed((c) => ({ ...c, [tier]: !c[tier] }))}
              aria-expanded={!isCollapsed}
            >
              <span className="family-group-icon" style={{ background: `${config.tint}22`, color: config.tint }}>
                <Users size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="family-group-title">
                <strong>{config.label}</strong>
                <span className="family-group-sub">{config.sub}</span>
              </span>
              <span className="family-group-badge">{items.length}</span>
              {isCollapsed ? (
                <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <ChevronUp size={16} strokeWidth={2} aria-hidden="true" />
              )}
            </button>

            {!isCollapsed && (
              <ul className="fact-list family-group-body">
                {items.map((f) => {
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
            )}
          </div>
        );
      })}
    </div>
  );
}
