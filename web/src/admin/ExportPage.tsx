import { useState } from "react";
import { Check, Download, Sheet } from "lucide-react";
import { AppHeader } from "../dashboard/components/AppHeader";
import { SectionCard } from "../dashboard/components/SectionCard";
import { ApiError } from "../api/client";
import { downloadPersonsExport } from "../api/export";

const SHEETS = [
  { key: "persons", label: "Personas" },
  { key: "addresses", label: "Direcciones" },
  { key: "phones", label: "Telefonos" },
  { key: "emails", label: "Correos" },
  { key: "familyLinks", label: "Familiares" },
  { key: "vehicles", label: "Vehiculos" },
  { key: "laborRecords", label: "HistorialLaboral" },
  { key: "judicialCases", label: "CausasJudiciales" },
  { key: "taxRecords", label: "DatosTributarios" },
  { key: "taxEstablishments", label: "Establecimientos" },
  { key: "trafficFines", label: "MultasTransito" },
  { key: "propertyRecords", label: "Propiedades" },
];

export function ExportPage() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(SHEETS.map((s) => s.key)));
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSheet(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleDownload() {
    if (selected.size === 0) return;
    setError(null);
    setDownloading(true);
    try {
      const allSelected = selected.size === SHEETS.length;
      await downloadPersonsExport(allSelected ? undefined : Array.from(selected));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo generar el archivo.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <h1 className="page-title">Exportar</h1>

        <SectionCard
          title="Exportar base a Excel"
          subtitle="Un archivo .xlsx, una hoja por tipo de dato"
          icon={Sheet}
          tint="var(--accent-2)"
        >
          <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", marginBottom: 16 }}>
            Genera un archivo con las personas registradas y sus datos asociados. Cada hoja incluye la columna{" "}
            <strong>Identificación</strong> para poder relacionarlas entre sí en Excel (por ejemplo con BUSCARV o
            tablas dinámicas). Elige qué secciones incluir.
          </p>

          <div className="sheet-toggle-head">
            <span className="sheet-toggle-count">{selected.size} de {SHEETS.length} secciones</span>
            <div className="sheet-toggle-actions">
              <button type="button" className="btn-link" onClick={() => setSelected(new Set(SHEETS.map((s) => s.key)))}>
                Seleccionar todo
              </button>
              <button type="button" className="btn-link" onClick={() => setSelected(new Set())}>
                Ninguno
              </button>
            </div>
          </div>

          <div className="fact-labels" style={{ marginBottom: 20 }}>
            {SHEETS.map((sheet) => {
              const isActive = selected.has(sheet.key);
              return (
                <button
                  key={sheet.key}
                  type="button"
                  className={`pill tag-pill pill-button sheet-toggle${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => toggleSheet(sheet.key)}
                >
                  {isActive && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                  {sheet.label}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {selected.size === 0 && !error && (
            <p className="form-error" role="alert">
              Selecciona al menos una sección para exportar.
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={downloading || selected.size === 0}
          >
            <Download size={16} /> {downloading ? "Generando…" : "Descargar Excel"}
          </button>
        </SectionCard>
      </main>
    </div>
  );
}
