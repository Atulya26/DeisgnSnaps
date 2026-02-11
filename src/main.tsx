import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app/App.tsx";
import { AdminLayout } from "./admin/components/AdminLayout.tsx";
import { ProjectsPage } from "./admin/pages/ProjectsPage.tsx";
import { ProjectEditorPage } from "./admin/pages/ProjectEditorPage.tsx";
import { SettingsPage } from "./admin/pages/SettingsPage.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      {/* Portfolio */}
      <Route path="/" element={<App />} />

      {/* Admin Panel */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectEditorPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
