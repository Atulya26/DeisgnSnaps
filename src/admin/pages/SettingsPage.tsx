import { useState, useEffect } from "react";
import {
  Save,
  Trash2,
  CheckCircle2,
  CloudOff,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Zap,
  FolderOpen,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { SidebarTrigger } from "../../app/components/ui/sidebar";
import { Separator } from "../../app/components/ui/separator";
import { Button } from "../../app/components/ui/button";
import { Input } from "../../app/components/ui/input";
import {
  getR2Config,
  saveR2Config,
  clearR2Config,
  testWorkerConnection,
} from "../services/r2";
import type { R2Config } from "../types";

const SETTINGS_PIN = "2612";
const PIN_SESSION_KEY = "portfolio_settings_unlocked";

const EMPTY_CONFIG: R2Config = {
  accountId: "",
  bucketName: "portfolio-assets",
  accessKeyId: "",
  secretAccessKey: "",
  publicDomain: "",
  workerUrl: "",
};

export function SettingsPage() {
  // ── PIN gate ──
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  // Check session unlock on mount
  useEffect(() => {
    if (sessionStorage.getItem(PIN_SESSION_KEY) === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handlePinSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pin === SETTINGS_PIN) {
      setIsUnlocked(true);
      sessionStorage.setItem(PIN_SESSION_KEY, "true");
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  };

  // ── Settings state ──
  const [config, setConfig] = useState<R2Config>(EMPTY_CONFIG);
  const [isConnected, setIsConnected] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const existing = getR2Config();
    if (existing) {
      setConfig(existing);
      setIsConnected(true);
    }
  }, []);

  const handleSave = () => {
    saveR2Config(config);
    setIsConnected(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDisconnect = () => {
    clearR2Config();
    setConfig(EMPTY_CONFIG);
    setIsConnected(false);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!config.workerUrl) {
      setTestResult({ ok: false, message: "Enter a Worker URL first" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testWorkerConnection(config.workerUrl);
    if (result.ok) {
      setTestResult({
        ok: true,
        message: `Connected! Found ${result.folderCount} folder${result.folderCount === 1 ? "" : "s"} in bucket.`,
      });
    } else {
      setTestResult({
        ok: false,
        message: result.error ?? "Connection failed",
      });
    }
    setTesting(false);
  };

  const updateField = (field: keyof R2Config, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  // ── PIN lock screen ──
  if (!isUnlocked) {
    return (
      <>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium text-foreground">Settings</h1>
        </header>

        <div className="flex flex-1 items-center justify-center p-6">
          <form
            onSubmit={handlePinSubmit}
            className="flex w-full max-w-xs flex-col items-center gap-5"
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <Lock className="size-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium text-foreground">
                Settings Locked
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the PIN to access configuration.
              </p>
            </div>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(false);
              }}
              placeholder="Enter PIN"
              className={`text-center tabular-nums text-lg tracking-[0.3em] ${
                pinError ? "border-destructive" : ""
              }`}
              autoFocus
            />
            {pinError && (
              <p className="text-xs text-destructive">Incorrect PIN. Try again.</p>
            )}
            <Button type="submit" className="w-full gap-1.5" disabled={pin.length === 0}>
              <ShieldCheck className="size-4" />
              Unlock
            </Button>
          </form>
        </div>
      </>
    );
  }

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
            Unlocked
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-balance text-xl font-medium text-foreground">
              Cloudflare R2 Configuration
            </h2>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              Connect your R2 bucket via a Cloudflare Worker to manage project images.
            </p>
          </div>

          {/* Status Card */}
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                </div>
              ) : (
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <CloudOff className="size-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isConnected ? "Connected" : "Not Connected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isConnected
                    ? `Bucket: ${config.bucketName}`
                    : "Fill in the details below to connect"}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Worker URL — most important field */}
            <div className="rounded-xl border-2 border-primary/20 bg-primary/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Worker API (Required)
                </span>
              </div>
              <FieldGroup
                label="Worker URL"
                description="The URL of your deployed Cloudflare Worker that reads from R2."
              >
                <div className="flex gap-2">
                  <Input
                    value={config.workerUrl}
                    onChange={(e) => updateField("workerUrl", e.target.value)}
                    placeholder="https://portfolio-r2-api.yourname.workers.dev"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testing || !config.workerUrl}
                    className="shrink-0 gap-1.5"
                  >
                    {testing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Zap className="size-4" />
                    )}
                    Test
                  </Button>
                </div>
              </FieldGroup>

              {/* Test result */}
              {testResult && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                    testResult.ok
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="size-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="size-3.5 shrink-0" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>

            <Separator />

            <FieldGroup
              label="Cloudflare Account ID"
              description="Found in the Cloudflare dashboard sidebar URL or R2 overview."
            >
              <Input
                value={config.accountId}
                onChange={(e) => updateField("accountId", e.target.value)}
                placeholder="e.g. a1b2c3d4e5f6..."
              />
            </FieldGroup>

            <FieldGroup
              label="Bucket Name"
              description="The name of your R2 bucket."
            >
              <Input
                value={config.bucketName}
                onChange={(e) => updateField("bucketName", e.target.value)}
                placeholder="portfolio-assets"
              />
            </FieldGroup>

            <FieldGroup
              label="Public Domain (Optional)"
              description="The public domain or R2.dev URL for your bucket. Used as fallback for image URLs."
            >
              <Input
                value={config.publicDomain}
                onChange={(e) => updateField("publicDomain", e.target.value)}
                placeholder="e.g. pub-xxxx.r2.dev"
              />
            </FieldGroup>

            <Separator />

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    API Keys (Optional)
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    Not needed if using the Worker. Only for future direct R2 write operations.
                    Stored in browser localStorage only.
                  </p>
                </div>
              </div>
            </div>

            <FieldGroup
              label="Access Key ID"
              description="R2 API token with read access."
            >
              <Input
                type="password"
                value={config.accessKeyId}
                onChange={(e) => updateField("accessKeyId", e.target.value)}
                placeholder="Optional"
              />
            </FieldGroup>

            <FieldGroup
              label="Secret Access Key"
              description="The secret for your R2 API token."
            >
              <Input
                type="password"
                value={config.secretAccessKey}
                onChange={(e) => updateField("secretAccessKey", e.target.value)}
                placeholder="Optional"
              />
            </FieldGroup>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-border pt-5">
            {isConnected ? (
              <Button
                variant="outline"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDisconnect}
              >
                <Trash2 className="size-4" />
                Disconnect
              </Button>
            ) : (
              <div />
            )}
            <Button onClick={handleSave} className="gap-1.5">
              {saved ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>

          {/* Deploy Instructions */}
          <div className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">
              Deploy the Worker
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The worker lives in <code className="rounded bg-muted px-1 py-0.5">worker/</code> folder of this project.
              Deploy it with these commands:
            </p>
            <div className="mt-3 space-y-2">
              <CodeBlock>cd worker && npm install</CodeBlock>
              <CodeBlock>npx wrangler login</CodeBlock>
              <CodeBlock>npx wrangler deploy</CodeBlock>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              After deploying, copy the worker URL (e.g. <code className="rounded bg-muted px-1 py-0.5">https://portfolio-r2-api.yourname.workers.dev</code>) and paste it above.
            </p>
          </div>

          {/* Workflow */}
          <div className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">
              How it works
            </h3>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">1.</span>
                Deploy the Cloudflare Worker (it reads your R2 bucket)
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">2.</span>
                Paste the Worker URL above and click "Test"
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">3.</span>
                Create folders in R2 (e.g. <code className="rounded bg-muted px-1 py-0.5">project-lumina/</code>) and upload images
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">4.</span>
                Go to Projects — your folders appear automatically
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">5.</span>
                Add title, description, tags, rich content, and publish
              </li>
            </ol>
            <a
              href="https://developers.cloudflare.com/r2/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Cloudflare R2 Docs
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function FieldGroup({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg bg-foreground/[0.03] px-3 py-2 text-xs text-foreground">
      <code>$ {children}</code>
    </pre>
  );
}
