import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FloppyDisk,
  Image,
  Plus,
  FolderOpen,
  RefreshClockwise,
  LoaderCircle,
  TextFormat,
  Trash,
  CloudUpload,
  ChevronDown,
  ChevronUp,
  Star,
} from "geist-icons";
import { SidebarTrigger } from "../../app/components/ui/sidebar";
import { Separator } from "../../app/components/ui/separator";
import { Button } from "../../app/components/ui/button";
import { Input } from "../../app/components/ui/input";
import { Badge } from "../../app/components/ui/badge";
import { RichTextEditor } from "../components/RichTextEditor";
import type { AdminProject, StorageImage, ContentBlock, ImageBlock, TextBlock } from "../types";
import {
  loadProjectFromFirestore,
  saveProjectToFirestore,
  deleteProjectFromFirestore,
  deleteStorageFolder,
  uploadFile,
  listFolderImages,
  saveLocalProjects,
  getLocalProjects,
} from "../services/firebase";

function loadProjects(): AdminProject[] {
  return getLocalProjects();
}

function saveProjects(projects: AdminProject[]) {
  saveLocalProjects(projects);
}

export function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<AdminProject | null>(null);
  const [folderImages, setFolderImages] = useState<StorageImage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load project — try Firestore first, fall back to localStorage
  useEffect(() => {
    async function load() {
      if (id) {
        try {
          const fromFirestore = await loadProjectFromFirestore(id);
          if (fromFirestore) {
            // Migrate old projects that don't have contentBlocks
            if (!fromFirestore.contentBlocks) {
              fromFirestore.contentBlocks = [];
              if (fromFirestore.images?.length) {
                fromFirestore.contentBlocks = fromFirestore.images.map((img) => ({
                  type: "image" as const,
                  id: crypto.randomUUID(),
                  url: img.url,
                  key: img.key,
                }));
              }
            }
            setProject(fromFirestore);
            setFolderImages(fromFirestore.images ?? []);
            return;
          }
        } catch (err) {
          console.error("Failed to load from Firestore:", err);
        }
      }

      // Fallback to localStorage
      const projects = loadProjects();
      const found = projects.find((p) => p.id === id);
      if (found) {
        if (!found.contentBlocks) {
          found.contentBlocks = [];
          if (found.images?.length) {
            found.contentBlocks = found.images.map((img) => ({
              type: "image" as const,
              id: crypto.randomUUID(),
              url: img.url,
              key: img.key,
            }));
          }
        }
        setProject(found);
        setFolderImages(found.images ?? []);
      } else {
        navigate("/admin");
      }
    }
    load();
  }, [id, navigate]);

  // Load images from Firebase Storage folder
  useEffect(() => {
    if (!project?.storagePath) return;

    listFolderImages(project.storagePath).then((images) => {
      if (images.length > 0) {
        setFolderImages(images);
        setProject((prev) => (prev ? { ...prev, images } : prev));
      }
    });
  }, [project?.storagePath]);

  // Save — to Firestore + localStorage
  const save = useCallback(async () => {
    if (!project) return;
    setIsSaving(true);

    const updatedProject = { ...project, updatedAt: new Date().toISOString() };

    // Save to localStorage
    const projects = loadProjects();
    const updated = projects.map((p) =>
      p.id === project.id ? updatedProject : p
    );
    // If not in localStorage yet, add it
    if (!projects.some((p) => p.id === project.id)) {
      updated.push(updatedProject);
    }
    saveProjects(updated);

    // Save to Firestore
    try {
      await saveProjectToFirestore(updatedProject);
    } catch (err) {
      console.error("Failed to save to Firestore:", err);
    }

    setLastSaved(new Date());
    setTimeout(() => setIsSaving(false), 300);
  }, [project]);

  // Save on Cmd+S
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [save]);

  const update = <K extends keyof AdminProject>(key: K, value: AdminProject[K]) => {
    setProject((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const refreshFromStorage = async () => {
    if (!project?.storagePath) return;
    setRefreshing(true);
    const images = await listFolderImages(project.storagePath);
    setFolderImages(images);
    update("images", images);
    if (!project.coverImageKey && images.length > 0) {
      update("coverImageKey", images[0].url);
    }
    setRefreshing(false);
  };

  // ── Content Blocks ──

  const updateBlocks = (blocks: ContentBlock[]) => {
    update("contentBlocks", blocks);
  };

  const addImageBlock = (url: string, key?: string) => {
    if (!project) return;
    const block: ImageBlock = {
      type: "image",
      id: crypto.randomUUID(),
      url,
      key,
    };
    updateBlocks([...project.contentBlocks, block]);
  };

  const addTextBlock = () => {
    if (!project) return;
    const block: TextBlock = {
      type: "text",
      id: crypto.randomUUID(),
      content: "",
    };
    updateBlocks([...project.contentBlocks, block]);
  };

  const removeBlock = (blockId: string) => {
    if (!project) return;
    updateBlocks(project.contentBlocks.filter((b) => b.id !== blockId));
  };

  const moveBlock = (blockId: string, direction: "up" | "down") => {
    if (!project) return;
    const blocks = [...project.contentBlocks];
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    updateBlocks(blocks);
  };

  const updateBlockContent = (blockId: string, content: string) => {
    if (!project) return;
    updateBlocks(
      project.contentBlocks.map((b) =>
        b.id === blockId ? { ...b, content } : b
      )
    );
  };

  const updateBlockCaption = (blockId: string, caption: string) => {
    if (!project) return;
    updateBlocks(
      project.contentBlocks.map((b) =>
        b.id === blockId && b.type === "image" ? { ...b, caption } : b
      )
    );
  };

  // ── File Upload ──

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !project) return;

    setUploading(true);

    // Determine storage folder name
    const folder = project.storagePath
      ? project.storagePath.replace(/\/$/, "")
      : `projects/${project.id}`;

    // If no storagePath set, set it now
    if (!project.storagePath) {
      update("storagePath", folder + "/");
    }

    for (const file of Array.from(files)) {
      const key = `${folder}/${file.name}`;
      const result = await uploadFile(key, file);

      if (result.ok) {
        const newImg: StorageImage = {
          key: result.key,
          name: file.name,
          url: result.url,
          size: file.size,
          lastModified: new Date(),
        };
        setFolderImages((prev) => [...prev, newImg]);
        setProject((prev) => {
          if (!prev) return prev;
          const updatedImages = [...prev.images, newImg];
          const updatedBlocks = [
            ...prev.contentBlocks,
            {
              type: "image" as const,
              id: crypto.randomUUID(),
              url: result.url,
              key: result.key,
            },
          ];
          return {
            ...prev,
            images: updatedImages,
            contentBlocks: updatedBlocks,
            coverImageKey: prev.coverImageKey || result.url,
            storagePath: prev.storagePath || folder + "/",
          };
        });
      } else {
        console.error("Upload failed:", result.error);
        alert(`Upload failed for "${file.name}": ${result.error}\n\nMake sure Firebase Storage rules allow writes. See Settings for instructions.`);
      }
    }

    setUploading(false);
  };

  // Add image from existing folder images to blocks
  const addExistingImageToBlocks = (img: StorageImage) => {
    addImageBlock(img.url, img.key);
  };

  if (!project) return null;

  return (
    <>
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="size-4" />
            Projects
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="truncate text-sm text-muted-foreground">
            {project.title || "Untitled"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Badge
            variant={project.status === "published" ? "default" : "secondary"}
            className="cursor-pointer text-[10px] uppercase"
            onClick={() =>
              update(
                "status",
                project.status === "published" ? "draft" : "published"
              )
            }
          >
            {project.status}
          </Badge>
          <Button size="sm" onClick={save} disabled={isSaving} className="gap-1.5">
            <FloppyDisk className="size-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Main content — two column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ════════════════════════════════════════════
            LEFT SIDEBAR — Project details (compact)
            ════════════════════════════════════════════ */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/30 p-5">
          <div className="flex-1 space-y-5">
            {/* Title */}
            <FieldGroup label="Title">
              <Input
                value={project.title}
                onChange={(e) => {
                  const title = e.target.value;
                  update("title", title);
                }}
                placeholder="Project title"
                className="text-sm"
              />
            </FieldGroup>

            {/* Storage path (read-only) */}
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
              <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-[11px] text-muted-foreground">
                {project.storagePath || "auto-created on first upload"}
              </span>
              {project.storagePath && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto size-6 shrink-0"
                  onClick={refreshFromStorage}
                  disabled={refreshing}
                  title="Refresh from Storage"
                >
                  {refreshing ? (
                    <LoaderCircle className="size-3 animate-spin" />
                  ) : (
                    <RefreshClockwise className="size-3" />
                  )}
                </Button>
              )}
            </div>

            <Separator />

            {/* Cover Image */}
            <FieldGroup label="Cover Image">
              <p className="text-[10px] text-muted-foreground">
                Shown on the portfolio card
              </p>
              {project.coverImageKey ? (
                <div className="relative mt-1.5 overflow-hidden rounded-lg border border-border">
                  <img
                    src={project.coverImageKey}
                    alt="Cover"
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <Badge className="absolute left-1.5 top-1.5 text-[9px]">
                    <Star className="mr-0.5 size-2.5" />
                    Cover
                  </Badge>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-center rounded-lg border border-dashed border-border py-6">
                  <span className="text-[10px] text-muted-foreground">
                    No cover — click star on an image block
                  </span>
                </div>
              )}
            </FieldGroup>

            <Separator />

            {/* Folder images (thumbnails) */}
            {folderImages.length > 0 && (
              <FieldGroup label={`Images (${folderImages.length})`}>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {folderImages.map((img, idx) => {
                    const isInBlocks = project.contentBlocks.some(
                      (b) => b.type === "image" && (b.url === img.url || b.key === img.key)
                    );
                    return (
                      <button
                        key={img.key + idx}
                        type="button"
                        onClick={() => !isInBlocks && addExistingImageToBlocks(img)}
                        className={`group/thumb relative overflow-hidden rounded border transition-all ${
                          isInBlocks
                            ? "border-primary/30 opacity-50"
                            : "border-border hover:border-primary/50"
                        }`}
                        title={isInBlocks ? "Already in blocks" : `Add "${img.name}" to content`}
                        disabled={isInBlocks}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="aspect-square w-full object-cover"
                        />
                        {!isInBlocks && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                            <Plus className="size-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </FieldGroup>
            )}
          </div>

          {/* Delete project — pinned to bottom */}
          <div className="mt-6 border-t border-border pt-4">
            <Button
              variant="ghost"
              className="w-full gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                if (!confirm("Delete this project and all its images? This cannot be undone.")) return;
                // Delete from Firebase Storage
                if (project.storagePath) {
                  await deleteStorageFolder(project.storagePath);
                }
                // Delete from Firestore
                try {
                  await deleteProjectFromFirestore(project.id);
                } catch (err) {
                  console.error("Failed to delete from Firestore:", err);
                }
                // Delete from localStorage
                const projects = loadProjects().filter((p) => p.id !== project.id);
                saveProjects(projects);
                navigate("/admin");
              }}
            >
              <Trash className="size-3.5" />
              Delete Project
            </Button>
          </div>
        </aside>

        {/* ════════════════════════════════════════════
            RIGHT — Content blocks (Dribbble-style)
            ════════════════════════════════════════════ */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-3xl p-8">
            {/* Block toolbar */}
            <div className="mb-6 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Insert Block
              </span>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={addTextBlock}
                >
                  <TextFormat className="size-3.5" />
                  Text
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="size-3.5" />
                  )}
                  Upload Image
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* Content blocks */}
            {project.contentBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-20">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                  <Image className="size-7 text-muted-foreground/40" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  Start building your project post
                </p>
                <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
                  Add image and text blocks to create a Dribbble-style project showcase.
                  Upload images or add text descriptions.
                </p>
                <div className="mt-5 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <CloudUpload className="size-4" />
                    Upload Images
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={addTextBlock}
                  >
                    <TextFormat className="size-4" />
                    Add Text
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {project.contentBlocks.map((block, idx) => (
                  <ContentBlockEditor
                    key={block.id}
                    block={block}
                    index={idx}
                    total={project.contentBlocks.length}
                    isCover={block.type === "image" && project.coverImageKey === block.url}
                    onSetCover={(url) => update("coverImageKey", url)}
                    onRemove={() => removeBlock(block.id)}
                    onMoveUp={() => moveBlock(block.id, "up")}
                    onMoveDown={() => moveBlock(block.id, "down")}
                    onUpdateContent={(content) => updateBlockContent(block.id, content)}
                    onUpdateCaption={(caption) => updateBlockCaption(block.id, caption)}
                  />
                ))}

                {/* Add more blocks */}
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="h-px flex-1 bg-border" />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-muted-foreground"
                      onClick={addTextBlock}
                    >
                      <Plus className="size-3" />
                      Text
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-muted-foreground"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="size-3" />
                      Image
                    </Button>
                  </div>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

// ── Content Block Editor Component ──

function ContentBlockEditor({
  block,
  index,
  total,
  isCover,
  onSetCover,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdateContent,
  onUpdateCaption,
}: {
  block: ContentBlock;
  index: number;
  total: number;
  isCover: boolean;
  onSetCover: (url: string) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateContent: (content: string) => void;
  onUpdateCaption: (caption: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Block controls — floating right side */}
      <div
        className={`absolute -right-12 top-1 z-10 flex flex-col gap-0.5 transition-opacity ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
          title="Move up"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
          title="Move down"
        >
          <ChevronDown className="size-3.5" />
        </button>
        {block.type === "image" && (
          <button
            type="button"
            onClick={() => onSetCover(block.url)}
            className={`flex size-7 items-center justify-center rounded-md transition-colors ${
              isCover
                ? "text-amber-500"
                : "text-muted-foreground hover:bg-accent hover:text-amber-500"
            }`}
            title={isCover ? "Current cover" : "Set as cover"}
          >
            <Star className={`size-3.5 ${isCover ? "fill-current" : ""}`} />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Remove block"
        >
          <Trash className="size-3.5" />
        </button>
      </div>

      {/* Block content */}
      {block.type === "image" ? (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <img
            src={block.url}
            alt={block.caption || "Project image"}
            className="w-full"
            style={{ minHeight: 100 }}
          />
          {/* Caption */}
          <div className="border-t border-border/30 px-4 py-2">
            <input
              type="text"
              value={block.caption || ""}
              onChange={(e) => onUpdateCaption(e.target.value)}
              placeholder="Add a caption..."
              className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50">
          <RichTextEditor
            content={block.content}
            onChange={onUpdateContent}
            placeholder="Enter your text here..."
          />
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
