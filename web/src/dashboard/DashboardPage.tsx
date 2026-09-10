import { useCallback, useState } from "react";
import { buscarExpediente } from "../api/consulta";
import { ApiError } from "../api/client";
import { ExpedienteResponse } from "../api/types";
import { AppHeader } from "./components/AppHeader";
import { SearchBar } from "./components/SearchBar";
import { RecentSearches } from "./components/RecentSearches";
import { ExpedienteView } from "./components/ExpedienteView";

export function DashboardPage() {
  const [identification, setIdentification] = useState<string | null>(null);
  const [data, setData] = useState<ExpedienteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const runSearch = useCallback(async (id: string) => {
    setIdentification(id);
    setLoading(true);
    setError(null);
    try {
      const result = await buscarExpediente(id);
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "No se pudo completar la búsqueda. Intenta de nuevo.");
    } finally {
      setLoading(false);
      setHistoryRefreshKey((k) => k + 1);
    }
  }, []);

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <h1 className="page-title">Consulta consolidada</h1>

        <div className="search-row">
          <SearchBar onSearch={runSearch} loading={loading} value={identification ?? ""} />
        </div>

        <div className="app-grid">
          <div className="app-grid-main">
            <ExpedienteView loading={loading} error={error} data={data} onSearch={runSearch} />
          </div>
          <RecentSearches onSelect={runSearch} refreshKey={historyRefreshKey} activeIdentification={identification} />
        </div>
      </main>
    </div>
  );
}
