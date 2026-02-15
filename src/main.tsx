import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app/App.tsx";
import { AuthProvider } from "./admin/components/AuthContext.tsx";
import { RequireAuth } from "./admin/components/RequireAuth.tsx";
import { AdminLayout } from "./admin/components/AdminLayout.tsx";
import { LoginPage } from "./admin/pages/LoginPage.tsx";
import { ProjectsPage } from "./admin/pages/ProjectsPage.tsx";
import { ProjectEditorPage } from "./admin/pages/ProjectEditorPage.tsx";
import { SettingsPage } from "./admin/pages/SettingsPage.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        {/* Portfolio */}
        <Route path="/" element={<App />} />

        {/* Admin Login — public */}
        <Route path="/admin/login" element={<LoginPage />} />

        {/* Admin Panel — protected */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectEditorPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
