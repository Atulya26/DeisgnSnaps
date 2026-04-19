import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext.tsx";
import { RequireAuth } from "./components/RequireAuth.tsx";
import { AdminLayout } from "./components/AdminLayout.tsx";

const LoginPage = lazy(async () => {
  const mod = await import("./pages/LoginPage.tsx");
  return { default: mod.LoginPage };
});

const ProjectsPage = lazy(async () => {
  const mod = await import("./pages/ProjectsPage.tsx");
  return { default: mod.ProjectsPage };
});

const ProjectEditorPage = lazy(async () => {
  const mod = await import("./pages/ProjectEditorPage.tsx");
  return { default: mod.ProjectEditorPage };
});

const SettingsPage = lazy(async () => {
  const mod = await import("./pages/SettingsPage.tsx");
  return { default: mod.SettingsPage };
});

function AdminRouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="login"
          element={(
            <Suspense fallback={<AdminRouteFallback />}>
              <LoginPage />
            </Suspense>
          )}
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route
            index
            element={(
              <Suspense fallback={<AdminRouteFallback />}>
                <ProjectsPage />
              </Suspense>
            )}
          />
          <Route
            path="projects/:id"
            element={(
              <Suspense fallback={<AdminRouteFallback />}>
                <ProjectEditorPage />
              </Suspense>
            )}
          />
          <Route
            path="settings"
            element={(
              <Suspense fallback={<AdminRouteFallback />}>
                <SettingsPage />
              </Suspense>
            )}
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
