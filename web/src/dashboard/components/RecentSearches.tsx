import { useEffect, useState } from "react";
import { obtenerHistorial } from "../../api/consulta";
import { HistoryItem } from "../../api/types";
import { formatRelativeTime } from "../format";

interface RecentSearchesProps {
  onSelect: (identificacion: string) => void;
  refreshKey: number;
  activeIdentification?: string | null;
}

export function RecentSearches({ onSelect, refreshKey, activeIdentification }: RecentSearchesProps) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    obtenerHistorial()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <aside className="recent-panel">
      <h2>Últimas búsquedas</h2>

      {error && <p className="section-empty">No se pudo cargar el historial.</p>}

      {!error && items === null && <p className="section-empty">Cargando…</p>}

      {!error && items !== null && items.length === 0 && (
        <p className="section-empty">Todavía no buscaste nada — tus consultas van a aparecer acá.</p>
      )}

      {items && items.length > 0 && (
        <ul className="recent-list">
          {items.map((item) => (
            <li key={item.identification}>
              <button
                type="button"
                className={`recent-item ${item.identification === activeIdentification ? "is-active" : ""}`}
                onClick={() => onSelect(item.identification)}
              >
                <span className="recent-id">{item.identification}</span>
                <span className={`recent-dot ${item.personFound ? "dot-found" : "dot-empty"}`} aria-hidden="true" />
                <span className="recent-time">{formatRelativeTime(item.lastSearchedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
