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
  const { user, loading, signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const isLocalhost =
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname);

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
              : "Sign in with GitHub to edit project order, images, and content."}
          </p>
        </div>

        <Button
          type="button"
          className="w-full gap-2"
          onClick={handleSignIn}
          disabled={signingIn}
        >
          {signingIn ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <GitBranch className="size-4" />
          )}
          {signingIn ? "Redirecting…" : isLocalhost ? "Continue Locally" : "Continue with GitHub"}
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
