import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  LoaderCircle,
  LockClosed,
  GitBranch,
} from "geist-icons";
import { Button } from "../../app/components/ui/button";
import { useAuth } from "../components/AuthContext";

export function LoginPage() {
  const { user, authConfigured, loading, signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const isLocalhost =
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const authError =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("error")
      : null;
  const needsDeploymentConfig = !isLocalhost && !authConfigured;

  if (!loading && user) {
    return <Navigate to="/admin" replace />;
  }

  const handleSignIn = async () => {
    setSigningIn(true);
    await signIn();
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
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-[28px] border border-border bg-card px-8 py-10">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-foreground">
          <LockClosed className="size-6 text-background" />
        </div>

        <div className="text-center">
          <h1 className="text-lg font-medium text-foreground">Portfolio Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLocalhost
              ? "Local dev mode is active. Continue to edit project order, images, and content on this machine."
              : needsDeploymentConfig
                ? "GitHub admin auth is not configured on this deployment yet. Add the Vercel env vars and redeploy."
                : "Sign in with GitHub to edit project order, images, and content."}
          </p>
          {authError === "auth_config" ? (
            <p className="mt-2 text-xs text-destructive">
              The deployed admin API is reachable now, but GitHub auth secrets are still missing in Vercel.
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          className="w-full gap-2"
          onClick={handleSignIn}
          disabled={signingIn || needsDeploymentConfig}
        >
          {signingIn ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <GitBranch className="size-4" />
          )}
          {signingIn
            ? "Redirecting…"
            : isLocalhost
              ? "Continue Locally"
              : needsDeploymentConfig
                ? "Configure GitHub Auth"
                : "Continue with GitHub"}
        </Button>

        <a
          href="/"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to portfolio
        </a>
      </div>
    </div>
  );
}
