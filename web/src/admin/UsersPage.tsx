import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppHeader } from "../dashboard/components/AppHeader";
import { ApiError } from "../api/client";
import { Role } from "../api/types";
import { createUser, deleteUser, ManagedUser, listUsers, updateUser } from "../api/users";
import { useAuth } from "../auth/AuthContext";

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(() => {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar la lista de usuarios."));
  }, []);

  useEffect(reload, [reload]);

  async function handleToggleActive(u: ManagedUser) {
    try {
      await updateUser(u.id, { isActive: !u.isActive });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el usuario.");
    }
  }

  async function handleRoleChange(u: ManagedUser, role: Role) {
    try {
      await updateUser(u.id, { role });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el usuario.");
    }
  }

  async function handleDelete(u: ManagedUser) {
    if (!confirm(`¿Borrar la cuenta de ${u.email}? No se puede deshacer.`)) return;
    try {
      await deleteUser(u.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo borrar el usuario.");
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <div className="page-title-row">
          <h1 className="page-title">Usuarios</h1>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Nuevo usuario
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {showForm && (
          <CreateUserForm
            onCreated={() => {
              setShowForm(false);
              reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Creado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={u.id === currentUser?.id}
                      onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                    >
                      <option value="USER">Usuario</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`pill ${u.isActive ? "status-found" : "status-not-found"} pill-button`}
                      disabled={u.id === currentUser?.id}
                      onClick={() => handleToggleActive(u)}
                    >
                      {u.isActive ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="fact-time">{new Date(u.createdAt).toLocaleDateString("es-EC")}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      disabled={u.id === currentUser?.id}
                      title="Borrar usuario"
                      onClick={() => handleDelete(u)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users?.length === 0 && <p className="section-empty">Todavía no hay usuarios.</p>}
        </div>
      </main>
    </div>
  );
}

function CreateUserForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createUser({ email: email.trim(), password, role });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el usuario.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Correo</span>
        <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="field">
        <span>Rol</span>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="USER">Usuario</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="inline-form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Creando…" : "Crear usuario"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
