import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "../dashboard/components/AppHeader";
import { ApiError } from "../api/client";
import { ApiKeySummary, CreatedApiKey, createApiKey, listApiKeys, revokeApiKey } from "../api/apiKeys";

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedApiKey | null>(null);

  const reload = useCallback(() => {
    listApiKeys()
      .then(setKeys)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar la lista de API keys."));
  }, []);

  useEffect(reload, [reload]);

  async function handleRevoke(k: ApiKeySummary) {
    if (!confirm(`¿Revocar la API key "${k.name}"? Deja de funcionar de inmediato y no se puede reactivar.`)) return;
    try {
      await revokeApiKey(k.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo revocar la API key.");
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <div className="page-title-row">
          <h1 className="page-title">API keys</h1>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Nueva API key
          </button>
        </div>

        <p className="apikeys-intro">
          Una API key permite que otro sistema consulte el expediente consolidado
          (<code>GET /api/consulta/:cédula_o_ruc</code>) sin iniciar sesión. No habilita ningún otro endpoint. Si le asignás
          dominios, solo se aceptan requests cuyo origen sea alguno de esos dominios o un subdominio.
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {justCreated && <CreatedKeyBanner created={justCreated} onDismiss={() => setJustCreated(null)} />}

        {showForm && (
          <CreateApiKeyForm
            onCreated={(created) => {
              setShowForm(false);
              setJustCreated(created);
              reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Clave</th>
                <th>Dominios</th>
                <th>Último uso</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {keys?.map((k) => (
                <tr key={k.id} className={k.revokedAt ? "row-muted" : undefined}>
                  <td>{k.name}</td>
                  <td className="fact-mono">{k.keyPrefix}…</td>
                  <td>
                    {k.allowedDomains.length === 0 ? (
                      <span className="fact-meta">Sin restricción</span>
                    ) : (
                      <span className="apikey-domains">
                        {k.allowedDomains.map((d) => (
                          <span key={d} className="pill tag-pill">
                            {d}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="fact-time">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("es-EC") : "Nunca"}
                  </td>
                  <td>
                    <span className={`pill ${k.revokedAt ? "status-not-found" : "status-found"}`}>
                      {k.revokedAt ? "Revocada" : "Activa"}
                    </span>
                  </td>
                  <td>
                    {!k.revokedAt && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        title="Revocar API key"
                        onClick={() => handleRevoke(k)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {keys?.length === 0 && <p className="section-empty">Todavía no hay API keys.</p>}
        </div>
      </main>
    </div>
  );
}

function CreatedKeyBanner({ created, onDismiss }: { created: CreatedApiKey; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(created.key).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined
    );
  }

  return (
    <div className="apikey-created">
      <div className="apikey-created-head">
        <KeyRound size={18} strokeWidth={2} aria-hidden="true" />
        <div>
          <strong>API key "{created.name}" creada</strong>
          <p>Copiala ahora — no se vuelve a mostrar. Si la perdés, revocala y creá otra.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-tiny" onClick={onDismiss}>
          Entendido
        </button>
      </div>
      <div className="apikey-created-value">
        <code>{created.key}</code>
        <button type="button" className="btn btn-primary btn-tiny" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiada" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function CreateApiKeyForm({
  onCreated,
  onCancel,
}: {
  onCreated: (created: CreatedApiKey) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const domainList = domains
        .split(/[\n,]/)
        .map((d) => d.trim())
        .filter(Boolean);
      const created = await createApiKey({ name: name.trim(), domains: domainList });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la API key.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="bulk-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Nombre / referencia</span>
        <input
          type="text"
          required
          autoFocus
          placeholder="Sistema de facturación"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Dominios autorizados (uno por línea — vacío = sin restricción)</span>
        <textarea
          className="bulk-textarea"
          rows={3}
          placeholder={"miapp.com\napp.miapp.com"}
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="inline-form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Creando…" : "Crear API key"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
