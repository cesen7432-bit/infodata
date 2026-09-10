import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { BrandLogo } from "./BrandLogo";

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="app-brand">
        <BrandLogo />
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "app-nav-link is-active" : "app-nav-link")}>
            Consulta
          </NavLink>
          {user?.role === "ADMIN" && (
            <NavLink to="/usuarios" className={({ isActive }) => (isActive ? "app-nav-link is-active" : "app-nav-link")}>
              Usuarios
            </NavLink>
          )}
          {user?.role === "ADMIN" && (
            <NavLink to="/consulta-masiva" className={({ isActive }) => (isActive ? "app-nav-link is-active" : "app-nav-link")}>
              Consulta masiva
            </NavLink>
          )}
          {user?.role === "ADMIN" && (
            <NavLink to="/api-keys" className={({ isActive }) => (isActive ? "app-nav-link is-active" : "app-nav-link")}>
              API keys
            </NavLink>
          )}
          <NavLink to="/ayuda" className={({ isActive }) => (isActive ? "app-nav-link is-active" : "app-nav-link")}>
            Ayuda
          </NavLink>
        </nav>
      </div>
      <div className="app-user">
        <span className="pill role-pill">{user?.role === "ADMIN" ? "Admin" : "Usuario"}</span>
        <span className="app-user-email">{user?.email}</span>
        <button type="button" className="btn btn-ghost" onClick={() => logout()}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
