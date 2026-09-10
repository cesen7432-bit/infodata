import { Landmark } from "lucide-react";
import { TaxRecord } from "../../api/types";
import { SectionCard } from "./SectionCard";
import { StatusPill, Status } from "./SourcePill";

function emptyLabelFor(status: Status): string {
  if (status === "blocked") return "La consulta fue bloqueada — reintentar más tarde.";
  if (status === "error") return "No se pudo completar la consulta — reintenta la búsqueda.";
  return "No hay RUC asociado.";
}

export function TaxSection({ records, status }: { records: TaxRecord[]; status: Status }) {
  return (
    <SectionCard
      title="Datos tributarios"
      icon={Landmark}
      tint="var(--warn)"
      statusPill={<StatusPill status={status} />}
      isEmpty={records.length === 0}
      emptyLabel={emptyLabelFor(status)}
    >
      {records.map((r) => (
        <div key={r.id} className="tax-record">
          <div className="tax-record-head">
            <span className="fact-mono">{r.ruc}</span>
            <span className={`pill ${r.status === "ACTIVO" ? "status-found" : "status-not-found"}`}>{r.status || "Sin estado"}</span>
          </div>
          <div className="identity-grid">
            <div className="id-field">
              <span className="id-field-label">Razón social</span>
              <span className="id-field-value">{r.businessName || "—"}</span>
            </div>
            <div className="id-field">
              <span className="id-field-label">Tipo</span>
              <span className="id-field-value">{r.taxpayerType || "—"}</span>
            </div>
            <div className="id-field">
              <span className="id-field-label">Régimen</span>
              <span className="id-field-value">{r.regime || "—"}</span>
            </div>
            <div className="id-field">
              <span className="id-field-label">Actividad económica</span>
              <span className="id-field-value">{r.mainEconomicActivity || "—"}</span>
            </div>
            <div className="id-field">
              <span className="id-field-label">Obligado a contabilidad</span>
              <span className="id-field-value">{r.requiredToKeepAccounting || "—"}</span>
            </div>
            <div className="id-field">
              <span className="id-field-label">Inicio de actividades</span>
              <span className="id-field-value">{r.activitiesStartDate || "—"}</span>
            </div>
          </div>

          {r.establishments.length > 0 && (
            <div className="establishments">
              <h4>Establecimientos ({r.establishments.length})</h4>
              <ul className="fact-list">
                {r.establishments.map((e) => (
                  <li key={e.id} className="fact-item">
                    <div className="fact-main">
                      <span>
                        {e.name || "Sin nombre"} {e.isHeadquarters && <span className="pill status-found">Matriz</span>}
                      </span>
                      <span className="fact-meta">{e.location || "Sin dirección"}</span>
                    </div>
                    <div className="fact-tags">
                      <span className="fact-time">{e.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </SectionCard>
  );
}
