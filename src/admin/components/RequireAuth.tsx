import { Navigate } from "react-router-dom";
import { LoaderCircle } from "geist-icons";
import { useAuth } from "./AuthContext";

/**
 * Wraps admin routes — redirects to /admin/login if not authenticated.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
