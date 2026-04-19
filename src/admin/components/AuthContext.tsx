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
import { getSession, signOutAdmin, startGitHubSignIn } from "../services/firebase";

// ─── Context ─────────────────────────────────────────────────────────────────

interface User {
  login: string;
  avatarUrl?: string;
  name?: string;
}

interface AuthContextValue {
  user: User | null;
  authConfigured: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
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
  const [authConfigured, setAuthConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSession()
      .then((session) => {
        if (!mounted) return;
        setUser(session.authenticated && session.user ? session.user : null);
        setAuthConfigured(session.authConfigured ?? true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async () => {
    startGitHubSignIn();
  };

  const signOut = async () => {
    await signOutAdmin();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authConfigured, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
