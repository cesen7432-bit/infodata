import { useState } from "react";
import { Download, Sheet } from "lucide-react";
import { AppHeader } from "../dashboard/components/AppHeader";
import { SectionCard } from "../dashboard/components/SectionCard";
import { ApiError } from "../api/client";
import { downloadPersonsExport } from "../api/export";

const SHEETS = [
  "Personas",
  "Direcciones",
  "Telefonos",
  "Correos",
  "Familiares",
  "Vehiculos",
  "HistorialLaboral",
  "CausasJudiciales",
  "DatosTributarios",
  "Establecimientos",
  "MultasTransito",
  "Propiedades",
];

export function ExportPage() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    setDownloading(true);
    try {
      await downloadPersonsExport();
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
          title="Exportar toda la base a Excel"
          subtitle="Un archivo .xlsx, una hoja por tipo de dato"
          icon={Sheet}
          tint="var(--accent-2)"
        >
          <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", marginBottom: 16 }}>
            Genera un archivo con todas las personas registradas y sus datos asociados (direcciones, teléfonos,
            vehículos, historial laboral, familiares, causas judiciales, datos tributarios, multas y propiedades).
            Cada hoja incluye la columna <strong>Identificación</strong> para poder relacionarlas entre sí en Excel
            (por ejemplo con BUSCARV o tablas dinámicas).
          </p>

          <div className="fact-labels" style={{ marginBottom: 20 }}>
            {SHEETS.map((sheet) => (
              <span key={sheet} className="pill tag-pill">
                {sheet}
              </span>
            ))}
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
            <Download size={16} /> {downloading ? "Generando…" : "Descargar Excel"}
          </button>
        </SectionCard>
      </main>
    </div>
  );
}
