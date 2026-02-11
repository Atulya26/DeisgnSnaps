import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen,
  ImageIcon,
  Settings,
  ArrowRight,
  CloudOff,
  CheckCircle2,
} from "lucide-react";
import { SidebarTrigger } from "../../app/components/ui/sidebar";
import { Separator } from "../../app/components/ui/separator";
import { getR2Config } from "../services/r2";
import type { AdminProject } from "../types";

export function DashboardPage() {
  const [config, setConfig] = useState(getR2Config());
  const [projects, setProjects] = useState<AdminProject[]>([]);

  useEffect(() => {
    setConfig(getR2Config());
    try {
      const raw = localStorage.getItem("portfolio_admin_projects");
      if (raw) setProjects(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const publishedCount = projects.filter((p) => p.status === "published").length;
  const draftCount = projects.filter((p) => p.status === "draft").length;
  const totalImages = projects.reduce((acc, p) => acc + (p.images?.length ?? 0), 0);

  return (
    <>
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <h1 className="text-sm font-medium text-foreground">Dashboard</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Welcome */}
          <div>
            <h2 className="text-balance text-2xl font-medium text-foreground">
              Portfolio Admin
            </h2>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              Manage your projects, connect to Cloudflare R2, and publish to your portfolio.
            </p>
          </div>

          {/* R2 Connection Status */}
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {config ? (
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <CloudOff className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {config ? "R2 Bucket Connected" : "R2 Not Connected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {config
                      ? `${config.bucketName} via ${config.publicDomain}`
                      : "Configure your Cloudflare R2 bucket to get started"}
                  </p>
                </div>
              </div>
              <Link
                to="/admin/settings"
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent"
              >
                <Settings className="size-3.5" />
                {config ? "Edit" : "Connect"}
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Projects"
              value={projects.length}
              icon={FolderOpen}
              to="/admin/projects"
            />
            <StatCard
              label="Published"
              value={publishedCount}
              icon={CheckCircle2}
              subtitle={`${draftCount} drafts`}
            />
            <StatCard
              label="Images"
              value={totalImages}
              icon={ImageIcon}
            />
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/admin/projects"
                className="group flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Manage Projects
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Add, edit, or publish projects
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

              <Link
                to="/admin/settings"
                className="group flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <Settings className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      R2 Settings
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Configure bucket connection
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  subtitle,
  to,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  subtitle?: string;
  to?: string;
}) {
  const content = (
    <div className="rounded-xl border border-border p-4 transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between">
        <Icon className="size-4 text-muted-foreground" />
        {to && <ArrowRight className="size-3.5 text-muted-foreground" />}
      </div>
      <p className="mt-3 text-2xl font-medium tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-muted-foreground/70">{subtitle}</p>
      )}
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return content;
}
