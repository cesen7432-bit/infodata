import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "../dashboard/components/AppHeader";
import { ApiError } from "../api/client";
import { Role } from "../api/types";
import { createUser, deleteUser, ManagedUser, listUsers, updateUser } from "../api/users";
import { useAuth } from "../auth/AuthContext";

type FormMode = { mode: "create" } | { mode: "edit"; user: ManagedUser } | null;

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);

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
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormMode((v) => (v?.mode === "create" ? null : { mode: "create" }))}
          >
            <Plus size={16} /> Nuevo usuario
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {formMode && (
          <UserForm
            mode={formMode.mode}
            initialUser={formMode.mode === "edit" ? formMode.user : undefined}
            onDone={() => {
              setFormMode(null);
              reload();
            }}
            onCancel={() => setFormMode(null)}
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
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        title="Editar usuario"
                        onClick={() => setFormMode({ mode: "edit", user: u })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        disabled={u.id === currentUser?.id}
                        title="Borrar usuario"
                        onClick={() => handleDelete(u)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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

function UserForm({
  mode,
  initialUser,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  initialUser?: ManagedUser;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(initialUser?.role ?? "USER");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createUser({ email: email.trim(), password, role });
      } else {
        await updateUser(initialUser!.id, { email: email.trim(), role, password: password.trim() || undefined });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el usuario.");
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
        <span>{mode === "create" ? "Contraseña" : "Nueva contraseña (opcional)"}</span>
        <input
          type="password"
          required={mode === "create"}
          minLength={8}
          placeholder={mode === "edit" ? "Dejar en blanco para no cambiarla" : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
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
          {submitting ? "Guardando…" : mode === "create" ? "Crear usuario" : "Guardar cambios"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
