import { Ticket } from "lucide-react";
import { TrafficFine } from "../../api/types";
import { SectionCard } from "./SectionCard";
import { StatusPill, Status } from "./SourcePill";
import { formatMoney } from "../format";

function emptyLabelFor(status: Status): string {
  if (status === "blocked") return "La consulta fue bloqueada — reintentar más tarde.";
  if (status === "error") return "No se pudo completar la consulta — reintenta la búsqueda.";
  return "No hay multas registradas.";
}

export function TrafficFinesSection({ fines, status }: { fines: TrafficFine[]; status: Status }) {
  const pendientes = fines.filter((f) => f.status === "pendiente");
  const pagadas = fines.filter((f) => f.status === "pagada");

  return (
    <SectionCard
      title="Multas de tránsito"
      icon={Ticket}
      tint="var(--danger)"
      statusPill={<StatusPill status={status} />}
      isEmpty={fines.length === 0}
      emptyLabel={emptyLabelFor(status)}
    >
      {pendientes.length > 0 && (
        <div className="fines-group">
          <h4>
            Pendientes ({pendientes.length}) · {formatMoney(pendientes.reduce((sum, f) => sum + (f.amountDue || 0), 0))}
          </h4>
          <ul className="fact-list">
            {pendientes.map((f) => (
              <li key={f.id} className="fact-item">
                <div className="fact-main">
                  <span>
                    {f.plate} — {f.offenseDescription}
                  </span>
                  <span className="fact-meta">Emitida {f.issueDate}</span>
                </div>
                <div className="fact-tags">
                  <span className="pill status-not-found">{formatMoney(f.amountDue)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pagadas.length > 0 && (
        <div className="fines-group">
          <h4>Pagadas ({pagadas.length})</h4>
          <ul className="fact-list">
            {pagadas.map((f) => (
              <li key={f.id} className="fact-item">
                <div className="fact-main">
                  <span>
                    {f.plate} — {f.offenseDescription}
                  </span>
                  <span className="fact-meta">Emitida {f.issueDate}</span>
                </div>
                <div className="fact-tags">
                  <span className="pill status-found">{formatMoney(f.amountPaid)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
