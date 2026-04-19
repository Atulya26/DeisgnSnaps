import {
  CheckCircle,
  External,
  GitBranch,
  LoaderCircle,
  ShieldCheck,
  Warning,
} from "geist-icons";
import { useState } from "react";
import { SidebarTrigger } from "../../app/components/ui/sidebar";
import { Separator } from "../../app/components/ui/separator";
import { Button } from "../../app/components/ui/button";
import { testConnection } from "../services/firebase";
import { useAuth } from "../components/AuthContext";

const apiBase = import.meta.env.VITE_API_BASE_URL || "(same origin)";

export function SettingsPage() {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection();
    setTestResult({
      ok: result.ok,
      message: result.ok
        ? `Connected. Found ${result.projectCount} project${result.projectCount === 1 ? "" : "s"} in the repo.`
        : result.error ?? "Connection failed",
    });
    setTesting(false);
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium text-foreground">Settings</h1>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <ShieldCheck className="size-3" />
            Authenticated
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          <div>
            <h2 className="text-balance text-xl font-medium text-foreground">
              GitHub + Vercel Configuration
            </h2>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              This admin writes directly to the repo and lets Vercel redeploy the portfolio from `main`.
            </p>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50">
                <CheckCircle className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Connected</p>
                <p className="text-xs text-muted-foreground">API: {apiBase}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Publishing</span>
            </div>
            <div className="space-y-2 text-sm">
              <ConfigRow label="Signed in as" value={user?.login ?? "—"} />
              <ConfigRow label="Auth provider" value="GitHub" />
              <ConfigRow label="Source of truth" value="GitHub repo" />
              <ConfigRow label="Deploy target" value="Vercel main branch" />
            </div>

            <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing} className="gap-1.5">
              {testing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Test Connection
            </Button>

            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  testResult.ok
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle className="size-3.5 shrink-0" />
                ) : (
                  <Warning className="size-3.5 shrink-0" />
                )}
                {testResult.message}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">How it works</h3>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">1.</span>
                Sign in with GitHub
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">2.</span>
                Reorder projects, upload images, and edit project content
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">3.</span>
                Save or publish directly to the repo
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">4.</span>
                Vercel redeploys automatically from `main`
              </li>
            </ol>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open Vercel
              <External className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
        {value}
      </code>
    </div>
  );
}
