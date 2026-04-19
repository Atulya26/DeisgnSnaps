import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen,
  LoaderCircle,
  MagnifyingGlass,
  Plus,
  Trash,
} from "geist-icons";
import { SidebarTrigger } from "../../app/components/ui/sidebar";
import { Separator } from "../../app/components/ui/separator";
import { Button } from "../../app/components/ui/button";
import { Input } from "../../app/components/ui/input";
import { Badge } from "../../app/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../app/components/ui/dialog";
import type { AdminProjectDocument, AdminProjectListItem } from "../types";
import {
  deleteProjectFromFirestore,
  loadProjectFromFirestore,
  loadProjectsFromFirestore,
  reorderProjects,
  saveProjectToFirestore,
} from "../services/firebase";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "project";
}

function createNewProject(sortOrder: number): AdminProjectDocument {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = `untitled-${id.slice(0, 8)}`;

  return {
    id,
    slug,
    title: "Untitled Project",
    category: "",
    year: new Date().getFullYear().toString(),
    cardImageUrl: "",
    coverImageUrl: "",
    width: 440,
    height: 360,
    sortOrder,
    status: "draft",
    description: "",
    tags: [],
    gallery: [],
    blocks: [],
    updatedAt: now,
    createdAt: now,
    assets: [],
    cardAssetId: undefined,
    coverAssetId: undefined,
  };
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<AdminProjectListItem[]>([]);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const loadedProjects = await loadProjectsFromFirestore();
        setProjects(loadedProjects.sort((a, b) => a.sortOrder - b.sortOrder));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) =>
      [project.title, project.category, project.year].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [projects, search]);

  const handleCreate = async () => {
    const project = createNewProject(projects.length);
    project.slug = slugify(project.title) + `-${project.id.slice(0, 8)}`;

    const saved = await saveProjectToFirestore(project);
    setProjects((prev) => [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteProjectFromFirestore(deleteId);
    setProjects((prev) => prev.filter((project) => project.id !== deleteId));
    setDeleteId(null);
  };

  const toggleStatus = async (projectId: string) => {
    const target = await loadProjectFromFirestore(projectId);
    if (!target) return;

    const saved = await saveProjectToFirestore({
      ...target,
      status: target.status === "published" ? "draft" : "published",
    });

    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              status: saved.status,
              updatedAt: saved.updatedAt,
            }
          : project
      )
    );
  };

  const moveProject = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    const current = [...projects];
    const sourceIndex = current.findIndex((project) => project.id === sourceId);
    const targetIndex = current.findIndex((project) => project.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [moved] = current.splice(sourceIndex, 1);
    current.splice(targetIndex, 0, moved);

    const nextProjects = current.map((project, index) => ({
      ...project,
      sortOrder: index,
    }));

    setProjects(nextProjects);
    setSavingOrder(true);
    try {
      const reordered = await reorderProjects(nextProjects.map((project) => project.id));
      setProjects(reordered.sort((a, b) => a.sortOrder - b.sortOrder));
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium text-foreground">Projects</h1>
          <Badge variant="secondary" className="tabular-nums">
            {projects.length}
          </Badge>
          {savingOrder && (
            <span className="text-xs text-muted-foreground">Saving order…</span>
          )}
        </div>
        <Button size="sm" onClick={handleCreate} className="gap-1.5">
          <Plus className="size-4" />
          New Project
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="relative max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading projects…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
              <FolderOpen className="size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {search ? "No projects match your search" : "No projects yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search ? "Try a different search term" : "Create your first project to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              {filtered.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  draggedId={draggedId}
                  onToggleStatus={() => void toggleStatus(project.id)}
                  onDelete={() => setDeleteId(project.id)}
                  onDragStart={() => setDraggedId(project.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onMoveHere={(sourceId) => void moveProject(sourceId, project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              This will permanently delete the project metadata and published assets from the repo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} className="gap-1.5">
              <Trash className="size-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectRow({
  project,
  draggedId,
  onToggleStatus,
  onDelete,
  onDragStart,
  onDragEnd,
  onMoveHere,
}: {
  project: AdminProjectListItem;
  draggedId: string | null;
  onToggleStatus: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMoveHere: (sourceId: string) => void;
}) {
  const isDragged = draggedId === project.id;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (draggedId) onMoveHere(draggedId);
      }}
      className={`grid grid-cols-[auto_88px_minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 ${
        isDragged ? "opacity-50" : ""
      }`}
    >
      <div className="grid h-6 w-4 grid-cols-2 gap-1 self-center text-muted-foreground/50">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className="size-1 rounded-full bg-current" />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
        {project.cardImageUrl ? (
          <img
            src={project.cardImageUrl}
            alt={project.title}
            className="aspect-[16/10] w-full object-cover"
          />
        ) : (
          <div className="aspect-[16/10] bg-muted" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/admin/projects/${project.id}`} className="truncate text-sm font-medium text-foreground hover:underline">
            {project.title}
          </Link>
          <Badge variant={project.status === "published" ? "default" : "secondary"} className="text-[10px] uppercase">
            {project.status}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {project.category || "Uncategorized"} · {project.year || "—"}
        </p>
      </div>

      <Button variant="outline" size="sm" onClick={onToggleStatus}>
        {project.status === "published" ? "Unpublish" : "Publish"}
      </Button>

      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}
