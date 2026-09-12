import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireAdmin } from "./auth/RequireAdmin";
import { LoginPage } from "./auth/LoginPage";
import { DashboardPage } from "./dashboard/DashboardPage";
import { UsersPage } from "./admin/UsersPage";
import { BulkPage } from "./admin/BulkPage";
import { ApiKeysPage } from "./admin/ApiKeysPage";
import { ExportPage } from "./admin/ExportPage";
import { HelpPage } from "./help/HelpPage";
import { AccountPage } from "./account/AccountPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RequireAuth>
              <RequireAdmin>
                <UsersPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/consulta-masiva"
          element={
            <RequireAuth>
              <RequireAdmin>
                <BulkPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/api-keys"
          element={
            <RequireAuth>
              <RequireAdmin>
                <ApiKeysPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/exportar"
          element={
            <RequireAuth>
              <RequireAdmin>
                <ExportPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/mi-cuenta"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="/ayuda"
          element={
            <RequireAuth>
              <HelpPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
