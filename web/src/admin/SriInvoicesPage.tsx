import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { FileArchive, Send } from "lucide-react";
import { AppHeader } from "../dashboard/components/AppHeader";
import { ApiError } from "../api/client";
import {
  createSriInvoiceJob,
  downloadSriInvoiceZip,
  DocumentTypeOption,
  getSriInvoiceJob,
  listDocumentTypes,
  listSriInvoiceJobs,
  SriInvoiceJobStatus,
  SriInvoiceJobSummary,
} from "../api/sriInvoices";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const STATUS_LABEL: Record<SriInvoiceJobStatus, string> = {
  PENDING: "Pendiente",
  RUNNING: "En curso",
  COMPLETED: "Completado",
  FAILED: "Falló",
};

const STATUS_CLASS: Record<SriInvoiceJobStatus, string> = {
  PENDING: "status-unchecked",
  RUNNING: "status-blocked",
  COMPLETED: "status-found",
  FAILED: "status-error",
};

function periodLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function SriInvoicesPage() {
  const [jobs, setJobs] = useState<SriInvoiceJobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const reloadJobs = useCallback(() => {
    listSriInvoiceJobs()
      .then(setJobs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el historial."));
  }, []);

  useEffect(reloadJobs, [reloadJobs]);

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <h1 className="page-title">Comprobantes del SRI</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", marginBottom: 20 }}>
          Descarga los comprobantes electrónicos recibidos por un RUC (XML + RIDE), organizados en un .zip por
          fecha de emisión. Requiere las credenciales de <strong>SRI en línea</strong> de ese RUC — no se guardan,
          se usan una sola vez para esta descarga.
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <NewJobForm onCreated={(jobId) => { setSelectedJobId(jobId); reloadJobs(); }} />

        <div className="bulk-layout">
          <div className="bulk-jobs-list">
            <h3 className="bulk-subheading">Descargas anteriores</h3>
            {jobs?.length === 0 && <p className="section-empty">Todavía no se ha pedido ninguna descarga.</p>}
            <ul className="bulk-job-items">
              {jobs?.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    className={`bulk-job-item${selectedJobId === job.id ? " is-active" : ""}`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <span className="bulk-job-item-id">{job.ruc}</span>
                    <span className={`pill ${STATUS_CLASS[job.status]}`}>{STATUS_LABEL[job.status]}</span>
                    <span className="fact-time">{new Date(job.createdAt).toLocaleString("es-EC")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="bulk-job-detail-wrap">
            {selectedJobId ? (
              <JobDetailPanel jobId={selectedJobId} onSettled={reloadJobs} />
            ) : (
              <p className="section-empty">Elegí una descarga de la lista, o pedí una nueva, para ver su progreso acá.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function NewJobForm({ onCreated }: { onCreated: (jobId: string) => void }) {
  const [docTypes, setDocTypes] = useState<DocumentTypeOption[] | null>(null);
  const [ruc, setRuc] = useState("");
  const [password, setPassword] = useState("");
  const [documentType, setDocumentType] = useState<number | null>(null);
  const [fromYear, setFromYear] = useState(CURRENT_YEAR);
  const [fromMonth, setFromMonth] = useState(new Date().getMonth() + 1);
  const [toYear, setToYear] = useState(CURRENT_YEAR);
  const [toMonth, setToMonth] = useState(new Date().getMonth() + 1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listDocumentTypes()
      .then((types) => {
        setDocTypes(types);
        if (types.length > 0) setDocumentType(types[0].value);
      })
      .catch(() => setError("No se pudo cargar los tipos de comprobante."));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!ruc.trim() || !password) {
      setError("Ingresá el RUC y la contraseña de SRI en línea.");
      return;
    }
    if (documentType === null) {
      setError("Elegí un tipo de comprobante.");
      return;
    }
    if (fromYear > toYear || (fromYear === toYear && fromMonth > toMonth)) {
      setError("El período 'desde' no puede ser posterior a 'hasta'.");
      return;
    }

    setSubmitting(true);
    try {
      const { jobId } = await createSriInvoiceJob({
        ruc: ruc.trim(),
        password,
        documentType,
        from: { year: fromYear, month: fromMonth },
        to: { year: toYear, month: toMonth },
      });
      setPassword("");
      onCreated(jobId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar la descarga.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="bulk-form" onSubmit={handleSubmit}>
      <div className="inline-form-actions" style={{ flexWrap: "wrap", gap: 14 }}>
        <label className="field">
          <span>RUC</span>
          <input type="text" value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="1790012345001" />
        </label>
        <label className="field">
          <span>Contraseña de SRI en línea</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>Tipo de comprobante</span>
          <select value={documentType ?? ""} onChange={(e) => setDocumentType(Number(e.target.value))}>
            {docTypes?.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="inline-form-actions" style={{ flexWrap: "wrap", gap: 14 }}>
        <label className="field">
          <span>Desde</span>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="field">
          <span>Hasta</span>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="inline-form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Send size={15} strokeWidth={2} aria-hidden="true" />
          {submitting ? "Iniciando…" : "Generar descarga"}
        </button>
      </div>
    </form>
  );
}

function JobDetailPanel({ jobId, onSettled }: { jobId: string; onSettled: () => void }) {
  const [job, setJob] = useState<SriInvoiceJobSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const settledNotified = useRef(false);

  useEffect(() => {
    setJob(null);
    settledNotified.current = false;
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const data = await getSriInvoiceJob(jobId);
        if (cancelled) return;
        setJob(data);
        if (data.status === "RUNNING" || data.status === "PENDING") {
          timer = setTimeout(poll, 3000);
        } else if (!settledNotified.current) {
          settledNotified.current = true;
          onSettled();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudo cargar la descarga.");
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleDownload() {
    if (!job) return;
    setDownloading(true);
    try {
      await downloadSriInvoiceZip(job);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo descargar el archivo.");
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  }

  if (!job) {
    return (
      <div className="expediente-loading">
        <div className="spinner" aria-hidden="true" />
        <p>Cargando…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bulk-detail-head">
        <span className={`pill ${STATUS_CLASS[job.status]}`}>{STATUS_LABEL[job.status]}</span>
        {(job.status === "RUNNING" || job.status === "PENDING") && <span className="fact-time">Actualizando automáticamente…</span>}
        {job.status === "COMPLETED" && (
          <button type="button" className="btn btn-primary btn-tiny" onClick={handleDownload} disabled={downloading}>
            <FileArchive size={14} strokeWidth={2} aria-hidden="true" /> {downloading ? "Descargando…" : "Descargar .zip"}
          </button>
        )}
      </div>

      <div className="bulk-counts">
        <div className="bulk-count-stat">
          <span className="bulk-count-value">{job.ruc}</span>
          <span className="bulk-count-label">RUC</span>
        </div>
        <div className="bulk-count-stat">
          <span className="bulk-count-value" style={{ color: "var(--good)" }}>
            {job.totalDownloaded ?? 0}
          </span>
          <span className="bulk-count-label">Descargados</span>
        </div>
        <div className="bulk-count-stat">
          <span className="bulk-count-value" style={{ color: "var(--ink-soft)" }}>
            {job.totalFound ?? 0}
          </span>
          <span className="bulk-count-label">Encontrados</span>
        </div>
      </div>

      <p className="fact-meta">
        Período: {periodLabel(job.periodFromYear, job.periodFromMonth)} — {periodLabel(job.periodToYear, job.periodToMonth)}
      </p>

      {job.status === "FAILED" && job.errorMessage && (
        <p className="form-error" role="alert">
          {job.errorMessage}
        </p>
      )}
    </div>
  );
}
