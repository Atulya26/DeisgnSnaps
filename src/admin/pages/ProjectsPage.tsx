import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  MagnifyingGlass,
  FolderOpen,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash,
  Image,
  LoaderCircle,
} from "geist-icons";
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
import type { AdminProject } from "../types";
import {
  loadProjectsFromFirestore,
  saveProjectToFirestore,
  deleteProjectFromFirestore,
  deleteStorageFolder,
  saveLocalProjects,
} from "../services/firebase";

export function ProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load projects from Firestore on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const firestoreProjects = await loadProjectsFromFirestore();
        setProjects(firestoreProjects);
        // Sync to localStorage as cache
        saveLocalProjects(firestoreProjects);
      } catch (err) {
        console.error("Failed to load from Firestore:", err);
        // Fall back to localStorage
        try {
          const raw = localStorage.getItem("portfolio_admin_projects");
          if (raw) setProjects(JSON.parse(raw));
        } catch { /* ignore */ }
      }
      setLoading(false);
    }
    load();
  }, []);

  // Persist to localStorage whenever projects change
  useEffect(() => {
    if (!loading) {
      saveLocalProjects(projects);
    }
  }, [projects, loading]);

  const filtered = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = async () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newProject: AdminProject = {
      id,
      storagePath: "",
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

    // Save to Firestore
    try {
      await saveProjectToFirestore(newProject);
    } catch (err) {
      console.error("Failed to save new project to Firestore:", err);
    }
  };

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    const projectToDelete = projects.find((p) => p.id === deleteId);

    // Delete images from Firebase Storage
    if (projectToDelete?.storagePath) {
      await deleteStorageFolder(projectToDelete.storagePath);
    }

    // Delete from Firestore
    try {
      await deleteProjectFromFirestore(deleteId);
    } catch (err) {
      console.error("Failed to delete from Firestore:", err);
    }

    setProjects((prev) => prev.filter((p) => p.id !== deleteId));
    setDeleteId(null);
    setDeleting(false);
  };

  const toggleStatus = async (id: string) => {
    let updatedProject: AdminProject | undefined;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          updatedProject = {
            ...p,
            status: p.status === "published" ? "draft" : "published",
            updatedAt: new Date().toISOString(),
          };
          return updatedProject;
        }
        return p;
      })
    );

    // Sync to Firestore
    if (updatedProject) {
      try {
        await saveProjectToFirestore(updatedProject);
      } catch (err) {
        console.error("Failed to update status in Firestore:", err);
      }
    }
  };

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
            <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
            </div>
          ) : filtered.length === 0 ? (
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
              This will permanently delete this project and all its images from Firebase Storage. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting && <LoaderCircle className="size-4 animate-spin" />}
              {deleting ? "Deleting..." : "Delete"}
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
          <Image className="size-8 text-muted-foreground/30" />
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

        {/* Actions menu */}
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
                <Trash className="mr-2 size-4" />
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
