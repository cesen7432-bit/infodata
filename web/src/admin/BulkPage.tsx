import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Layers, Send } from "lucide-react";
import { AppHeader } from "../dashboard/components/AppHeader";
import { ApiError } from "../api/client";
import { BulkItemStatus, BulkJobDetail, BulkJobSummary, createBulkJob, getBulkJob, listBulkJobs } from "../api/bulk";

const SOURCE_OPTIONS: { slug: string; label: string }[] = [
  { slug: "datadiverservice", label: "DataDiverService" },
  { slug: "satje", label: "SATJE" },
  { slug: "sri", label: "SRI" },
  { slug: "ant", label: "ANT" },
];

const JOB_STATUS_LABEL: Record<BulkJobSummary["status"], string> = {
  PENDING: "Pendiente",
  RUNNING: "En curso",
  COMPLETED: "Completado",
  COMPLETED_WITH_ERRORS: "Completado con errores",
};

const JOB_STATUS_CLASS: Record<BulkJobSummary["status"], string> = {
  PENDING: "status-unchecked",
  RUNNING: "status-blocked",
  COMPLETED: "status-found",
  COMPLETED_WITH_ERRORS: "status-error",
};

const ITEM_STATUS_LABEL: Record<BulkItemStatus, string> = {
  PENDING: "Pendiente",
  RUNNING: "En curso",
  OK: "Ok",
  FAILED: "Falló",
  BLOCKED_CAPTCHA: "Bloqueado",
};

/**
 * Al pegar una columna de Excel, cada cédula ya viene en su propia línea —
 * separar también por coma rompe valores que traen coma de por sí (p. ej. un
 * número que Excel mostró en notación científica en formato es-EC, como
 * "1,10283E+12": la coma ahí es el separador decimal, no un delimitador
 * entre cédulas). Por eso la coma solo se usa como separador cuando el
 * pegado es una sola línea (entrada manual tipo "0912345678, 0923456789").
 */
function parseIdentifications(raw: string): string[] {
  const parts = raw.includes("\n") ? raw.split(/[\n\t]/) : raw.split(/[\n,\t]/);
  return parts.map((c) => c.trim()).filter(Boolean);
}

const ITEM_STATUS_CLASS: Record<BulkItemStatus, string> = {
  PENDING: "status-unchecked",
  RUNNING: "status-blocked",
  OK: "status-found",
  FAILED: "status-error",
  BLOCKED_CAPTCHA: "status-blocked",
};

export function BulkPage() {
  const [jobs, setJobs] = useState<BulkJobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const reloadJobs = useCallback(() => {
    listBulkJobs()
      .then(setJobs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el historial de lotes."));
  }, []);

  useEffect(reloadJobs, [reloadJobs]);

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <h1 className="page-title">Consulta masiva</h1>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <NewBulkJobForm
          onCreated={(jobId) => {
            setSelectedJobId(jobId);
            reloadJobs();
          }}
        />

        <div className="bulk-layout">
          <div className="bulk-jobs-list">
            <h3 className="bulk-subheading">Lotes anteriores</h3>
            {jobs?.length === 0 && <p className="section-empty">Todavía no se ha corrido ningún lote.</p>}
            <ul className="bulk-job-items">
              {jobs?.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    className={`bulk-job-item${selectedJobId === job.id ? " is-active" : ""}`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <span className="bulk-job-item-id">{job.id.slice(0, 8)}</span>
                    <span className={`pill ${JOB_STATUS_CLASS[job.status]}`}>{JOB_STATUS_LABEL[job.status]}</span>
                    <span className="fact-time">{new Date(job.createdAt).toLocaleString("es-EC")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="bulk-job-detail-wrap">
            {selectedJobId ? (
              <BulkJobDetailPanel jobId={selectedJobId} onSettled={reloadJobs} />
            ) : (
              <p className="section-empty">Elegí un lote de la lista, o creá uno nuevo, para ver su progreso acá.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function NewBulkJobForm({ onCreated }: { onCreated: (jobId: string) => void }) {
  const [cedulas, setCedulas] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(SOURCE_OPTIONS.map((s) => s.slug)));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleSource(slug: string) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const list = parseIdentifications(cedulas);

    if (list.length === 0) {
      setError("Ingresá al menos una cédula.");
      return;
    }
    if (selectedSources.size === 0) {
      setError("Elegí al menos una fuente.");
      return;
    }

    setSubmitting(true);
    try {
      const fuentes = selectedSources.size === SOURCE_OPTIONS.length ? undefined : Array.from(selectedSources);
      const { jobId } = await createBulkJob({ cedulas: list, fuentes });
      setCedulas("");
      onCreated(jobId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar el lote.");
    } finally {
      setSubmitting(false);
    }
  }

  const count = parseIdentifications(cedulas).length;

  return (
    <form className="bulk-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Cédulas (una por línea, o separadas por coma)</span>
        <textarea
          className="bulk-textarea"
          rows={6}
          placeholder={"0912345678\n0923456789\n0934567890"}
          value={cedulas}
          onChange={(e) => setCedulas(e.target.value)}
        />
      </label>

      <div className="bulk-sources">
        <span className="bulk-sources-label">Fuentes a consultar</span>
        <div className="bulk-sources-options">
          {SOURCE_OPTIONS.map((s) => (
            <label key={s.slug} className="bulk-source-check">
              <input type="checkbox" checked={selectedSources.has(s.slug)} onChange={() => toggleSource(s.slug)} />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="inline-form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Send size={15} strokeWidth={2} aria-hidden="true" />
          {submitting ? "Iniciando…" : count > 0 ? `Iniciar lote (${count} cédula${count === 1 ? "" : "s"})` : "Iniciar lote"}
        </button>
      </div>
    </form>
  );
}

function BulkJobDetailPanel({ jobId, onSettled }: { jobId: string; onSettled: () => void }) {
  const [detail, setDetail] = useState<BulkJobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const settledNotified = useRef(false);

  useEffect(() => {
    setDetail(null);
    settledNotified.current = false;
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const data = await getBulkJob(jobId);
        if (cancelled) return;
        setDetail(data);
        if (data.status === "RUNNING" || data.status === "PENDING") {
          timer = setTimeout(poll, 3000);
        } else if (!settledNotified.current) {
          settledNotified.current = true;
          onSettled();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudo cargar el lote.");
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (error) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  }

  if (!detail) {
    return (
      <div className="expediente-loading">
        <div className="spinner" aria-hidden="true" />
        <p>Cargando lote…</p>
      </div>
    );
  }

  const itemsToShow = showAllItems ? detail.items : detail.items.filter((i) => i.status !== "OK");
  const visibleItems = itemsToShow.slice(0, 500);

  return (
    <div>
      <div className="bulk-detail-head">
        <span className={`pill ${JOB_STATUS_CLASS[detail.status]}`}>{JOB_STATUS_LABEL[detail.status]}</span>
        {(detail.status === "RUNNING" || detail.status === "PENDING") && (
          <span className="fact-time">Actualizando automáticamente…</span>
        )}
      </div>

      <div className="bulk-counts">
        <div className="bulk-count-stat">
          <span className="bulk-count-value">{detail.totalItems}</span>
          <span className="bulk-count-label">Total</span>
        </div>
        <div className="bulk-count-stat">
          <span className="bulk-count-value" style={{ color: "var(--good)" }}>
            {detail.counts.completados}
          </span>
          <span className="bulk-count-label">Completados</span>
        </div>
        <div className="bulk-count-stat">
          <span className="bulk-count-value" style={{ color: "var(--ink-soft)" }}>
            {detail.counts.pendientes}
          </span>
          <span className="bulk-count-label">Pendientes</span>
        </div>
        <div className="bulk-count-stat">
          <span className="bulk-count-value" style={{ color: "var(--danger)" }}>
            {detail.counts.fallidos}
          </span>
          <span className="bulk-count-label">Fallidos</span>
        </div>
        <div className="bulk-count-stat">
          <span className="bulk-count-value" style={{ color: "var(--warn)" }}>
            {detail.counts.bloqueadosCaptcha}
          </span>
          <span className="bulk-count-label">Bloqueados</span>
        </div>
      </div>

      <div className="bulk-items-head">
        <h4>{showAllItems ? "Todos los items" : "Items que necesitan atención"}</h4>
        <button type="button" className="btn btn-ghost btn-tiny" onClick={() => setShowAllItems((v) => !v)}>
          {showAllItems ? "Ver solo pendientes/fallidos" : "Ver todos"}
        </button>
      </div>

      {visibleItems.length === 0 ? (
        <p className="section-empty">{showAllItems ? "Sin items." : "No hay items pendientes ni fallidos."}</p>
      ) : (
        <div className="bulk-items-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Fuente</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, idx) => (
                <tr key={`${item.identification}-${item.source}-${idx}`}>
                  <td className="fact-mono">{item.identification}</td>
                  <td>{item.source}</td>
                  <td>
                    <span className={`pill ${ITEM_STATUS_CLASS[item.status]}`}>{ITEM_STATUS_LABEL[item.status]}</span>
                  </td>
                  <td className="fact-meta">{item.errorMessage || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {itemsToShow.length > visibleItems.length && (
            <p className="section-empty">Mostrando los primeros {visibleItems.length} de {itemsToShow.length}.</p>
          )}
        </div>
      )}
    </div>
  );
}
