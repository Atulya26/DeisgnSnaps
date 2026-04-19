import { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./app/App.tsx";
import "./styles/index.css";

const AdminApp = lazy(() => import("./admin/AdminApp.tsx"));

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route
        path="/admin/*"
        element={(
          <Suspense
            fallback={(
              <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
                Loading admin…
              </div>
            )}
          >
            <AdminApp />
          </Suspense>
        )}
      />
    </Routes>
  </BrowserRouter>
);
