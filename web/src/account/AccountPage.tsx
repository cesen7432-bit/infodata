import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../dashboard/components/AppHeader";
import { ApiError } from "../api/client";
import { changePassword } from "../api/auth";
import { useAuth } from "../auth/AuthContext";

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      await logout();
      navigate("/login", { state: { message: "Contraseña actualizada. Inicia sesión de nuevo." }, replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña.");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <h1 className="page-title">Mi cuenta</h1>

        <div className="auth-card">
          <p className="auth-sub">
            Cambiar la contraseña de <strong>{user?.email}</strong>. Al confirmar se cerrará tu sesión actual y
            deberás volver a iniciar sesión con la contraseña nueva.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <label className="field">
              <span>Contraseña actual</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span>Nueva contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Confirmar nueva contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
