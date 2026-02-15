import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  LockClosed,
  Warning,
  LoaderCircle,
} from "geist-icons";
import { Button } from "../../app/components/ui/button";
import { Input } from "../../app/components/ui/input";
import { useAuth } from "../components/AuthContext";

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // Already logged in — redirect to admin
  if (!loading && user) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError("");
    setSigningIn(true);

    const result = await signIn(email, password);
    if (!result.ok) {
      let msg = result.error ?? "Sign-in failed";
      if (msg.toLowerCase().includes("invalid")) msg = "Invalid credentials.";
      if (msg.toLowerCase().includes("unauthorized")) msg = "Unauthorized.";
      setError(msg);
    }
    setSigningIn(false);
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xs flex-col items-center gap-5"
      >
        <div className="flex size-14 items-center justify-center rounded-2xl bg-foreground">
          <LockClosed className="size-6 text-background" />
        </div>

        <div className="text-center">
          <h1 className="text-lg font-medium text-foreground">Admin Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage your portfolio content.
          </p>
        </div>

        <div className="w-full space-y-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="Email"
            autoFocus
            autoComplete="email"
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Password"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="flex w-full items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <Warning className="size-3.5 shrink-0" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full gap-1.5"
          disabled={signingIn || !email || !password}
        >
          {signingIn ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <LockClosed className="size-4" />
          )}
          {signingIn ? "Signing in..." : "Sign In"}
        </Button>

        <a
          href="/"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to portfolio
        </a>
      </form>
    </div>
  );
}
