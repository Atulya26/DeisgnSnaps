import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  FolderOpen,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ImageIcon,
  CloudDownload,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { SidebarTrigger } from "../../app/components/ui/sidebar";
import { Separator } from "../../app/components/ui/separator";
import { Button } from "../../app/components/ui/button";
import { Input } from "../../app/components/ui/input";
import { Badge } from "../../app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../app/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../app/components/ui/dialog";
import type { AdminProject, R2Folder } from "../types";
import { getR2Config, listFolders, listFolderImages, deleteR2Folder } from "../services/r2";

const STORAGE_KEY = "portfolio_admin_projects";

function loadProjects(): AdminProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: AdminProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>(loadProjects);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  const filtered = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newProject: AdminProject = {
      id,
      r2Folder: "",
      title: "Untitled Project",
      category: "",
      year: new Date().getFullYear().toString(),
      description: "",
      tags: [],
      richContent: "",
      coverImageKey: "",
      images: [],
      contentBlocks: [],
      x: 0,
      y: 0,
      width: 300,
      height: 240,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    setProjects((prev) => [newProject, ...prev]);
  };

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    // Find the project to get its R2 folder
    const projectToDelete = projects.find((p) => p.id === deleteId);

    // Delete from R2 if it has a folder
    if (projectToDelete?.r2Folder) {
      const config = getR2Config();
      if (config?.workerUrl) {
        await deleteR2Folder(config, projectToDelete.r2Folder);
      }
    }

    setProjects((prev) => prev.filter((p) => p.id !== deleteId));
    setDeleteId(null);
    setDeleting(false);
  };

  const toggleStatus = (id: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === "published" ? "draft" : "published",
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  // ── Import from R2 ──
  const [importOpen, setImportOpen] = useState(false);
  const [r2Folders, setR2Folders] = useState<R2Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [importingFolder, setImportingFolder] = useState<string | null>(null);

  const [folderError, setFolderError] = useState<string | null>(null);

  const loadR2Folders = async () => {
    const config = getR2Config();
    setFolderError(null);

    if (!config?.workerUrl) {
      setFolderError(
        "Worker URL not configured. Go to Settings, paste your Worker URL, and click Save."
      );
      return;
    }

    setLoadingFolders(true);
    try {
      const folders = await listFolders(config);
      setR2Folders(folders);
      if (folders.length === 0) {
        setFolderError(
          "Worker responded but no folders found. Make sure you have folders (not just loose files) in your R2 bucket."
        );
      }
    } catch (err) {
      setFolderError(
        `Failed to fetch: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
    setLoadingFolders(false);
  };

  const openImportDialog = () => {
    setImportOpen(true);
    loadR2Folders();
  };

  const importFolder = async (folder: R2Folder) => {
    const config = getR2Config();
    if (!config) return;

    // Check if already imported
    if (projects.some((p) => p.r2Folder === folder.path)) return;

    setImportingFolder(folder.path);

    // Fetch images for this folder
    const images = await listFolderImages(config, folder.path);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Auto-create content blocks from images
    const contentBlocks = images.map((img) => ({
      type: "image" as const,
      id: crypto.randomUUID(),
      url: img.url,
      key: img.key,
    }));

    const newProject: AdminProject = {
      id,
      r2Folder: folder.path,
      title: folder.name
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()), // "project-lumina" -> "Project Lumina"
      category: "",
      year: new Date().getFullYear().toString(),
      description: "",
      tags: [],
      richContent: "",
      coverImageKey: images[0]?.url ?? "",
      images,
      contentBlocks,
      x: 0,
      y: 0,
      width: 300,
      height: 240,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    setProjects((prev) => [newProject, ...prev]);
    setImportingFolder(null);
  };

  const isFolderImported = (folderPath: string) =>
    projects.some((p) => p.r2Folder === folderPath);

  return (
    <>
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium text-foreground">Projects</h1>
          <Badge variant="secondary" className="tabular-nums">
            {projects.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={openImportDialog}
            className="gap-1.5"
          >
            <CloudDownload className="size-4" />
            Import from R2
          </Button>
          <Button size="sm" onClick={handleCreate} className="gap-1.5">
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Project Grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
              <FolderOpen className="size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {search ? "No projects match your search" : "No projects yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search
                  ? "Try a different search term"
                  : "Create your first project to get started"}
              </p>
              {!search && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5"
                  onClick={handleCreate}
                >
                  <Plus className="size-4" />
                  New Project
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onToggleStatus={() => toggleStatus(project.id)}
                  onDelete={() => setDeleteId(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              This will permanently delete this project and all its images from R2. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from R2 Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import from R2</DialogTitle>
            <DialogDescription>
              Select folders from your R2 bucket to import as projects. Each folder becomes a new project with its images pre-loaded.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {loadingFolders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading folders from R2...
                </span>
              </div>
            ) : r2Folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <FolderOpen className="size-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No folders found in bucket
                </p>
                {folderError ? (
                  <p className="mt-2 max-w-sm text-center text-xs text-destructive">
                    {folderError}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Make sure you've uploaded folders to R2 and the Worker URL is configured in Settings.
                  </p>
                )}
              </div>
            ) : (
              r2Folders.map((folder) => {
                const imported = isFolderImported(folder.path);
                const importing = importingFolder === folder.path;
                return (
                  <div
                    key={folder.path}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FolderOpen className="size-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {folder.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {folder.imageCount} image{folder.imageCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    {imported ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="size-3" />
                        Imported
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => importFolder(folder)}
                        disabled={importing}
                        className="gap-1.5"
                      >
                        {importing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        {importing ? "Importing..." : "Import"}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectCard({
  project,
  onToggleStatus,
  onDelete,
}: {
  project: AdminProject;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const coverUrl = project.coverImageKey || project.images?.[0]?.url;

  return (
    <div className="group overflow-hidden rounded-xl border border-border transition-colors hover:border-border/80 hover:bg-accent/20">
      {/* Image area */}
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden"
        style={{ backgroundColor: "#F2F1EE" }}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={project.title}
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground/30" />
        )}

        {/* Status badge */}
        <div className="absolute left-2.5 top-2.5">
          <Badge
            variant={project.status === "published" ? "default" : "secondary"}
            className="text-[10px] uppercase"
          >
            {project.status}
          </Badge>
        </div>

        {/* Actions menu — always visible */}
        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="size-7 rounded-full"
                aria-label="Project actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/admin/projects/${project.id}`}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleStatus}>
                <Eye className="mr-2 size-4" />
                {project.status === "published" ? "Unpublish" : "Publish"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Info */}
      <Link
        to={`/admin/projects/${project.id}`}
        className="block px-4 py-3"
      >
        <h3 className="truncate text-sm font-medium text-foreground">
          {project.title}
        </h3>
        {project.images.length > 0 && (
          <p className="mt-0.5 tabular-nums text-xs text-muted-foreground">
            {project.images.length} image{project.images.length !== 1 ? "s" : ""}
          </p>
        )}
      </Link>
    </div>
  );
}
