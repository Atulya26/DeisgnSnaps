/**
 * API session auth context for the admin panel.
 *
 * Provides:
 *  - current user state
 *  - signIn / signOut helpers
 *  - <RequireAuth> wrapper that redirects to /admin/login
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSession, signInAdmin, signOutAdmin } from "../services/firebase";

// ─── Context ─────────────────────────────────────────────────────────────────

interface User {
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSession()
      .then((session) => {
        if (!mounted) return;
        setUser(session.authenticated && session.user ? session.user : null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await signInAdmin(email, password);
    if (result.ok) {
      const session = await getSession();
      setUser(session.authenticated && session.user ? session.user : null);
    }
    return result;
  };

  const signOut = async () => {
    await signOutAdmin();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
