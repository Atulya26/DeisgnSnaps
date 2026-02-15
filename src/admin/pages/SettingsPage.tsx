import { useState } from "react";
import {
  CheckCircle,
  Cloud,
  External,
  Warning,
  LoaderCircle,
  Lightning,
  ShieldCheck,
} from "geist-icons";
import { SidebarTrigger } from "../../app/components/ui/sidebar";
import { Separator } from "../../app/components/ui/separator";
import { Button } from "../../app/components/ui/button";
import { testConnection } from "../services/firebase";
import { useAuth } from "../components/AuthContext";

const apiBase = import.meta.env.VITE_API_BASE_URL || "(same origin)";
const assetBase = import.meta.env.VITE_PUBLIC_ASSET_BASE_URL || "(served by API)";

export function SettingsPage() {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection();
    if (result.ok) {
      setTestResult({
        ok: true,
        message: `Connected! Found ${result.projectCount} project${result.projectCount === 1 ? "" : "s"} in Firestore.`,
      });
    } else {
      setTestResult({
        ok: false,
        message: result.error ?? "Connection failed",
      });
    }
    setTesting(false);
  };

  return (
    <>
      {/* Header */}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-balance text-xl font-medium text-foreground">
              Cloudflare Configuration
            </h2>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              Your admin API, storage, and publishing connection details.
            </p>
          </div>

          {/* Status Card */}
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50">
                <CheckCircle className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Connected</p>
                <p className="text-xs text-muted-foreground">
                  API: {apiBase}
                </p>
              </div>
            </div>
          </div>

          {/* Account info */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Cloud className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Account Details
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <ConfigRow label="Signed in as" value={user?.email ?? "—"} />
              <ConfigRow label="API base URL" value={apiBase} />
              <ConfigRow label="Asset base URL" value={assetBase} />
              <ConfigRow label="Storage backend" value="Cloudflare R2" />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="gap-1.5"
            >
              {testing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Lightning className="size-4" />
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

          {/* How it works */}
          <div className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">
              How it works
            </h3>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">1.</span>
                Sign in to the admin panel (you're already signed in)
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">2.</span>
                Go to Projects and create a new project
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">3.</span>
                Upload images from Admin — they are stored in Cloudflare R2
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">4.</span>
                Add text blocks, set a cover image, and publish
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">5.</span>
                Published projects automatically appear on your portfolio
              </li>
            </ol>
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Cloudflare Dashboard
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
