import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CloudUpload,
  FloppyDisk,
  LoaderCircle,
  Plus,
  Star,
  TextFormat,
  Trash,
} from "geist-icons";
import { SidebarTrigger } from "../../app/components/ui/sidebar";
import { Separator } from "../../app/components/ui/separator";
import { Button } from "../../app/components/ui/button";
import { Input } from "../../app/components/ui/input";
import { Badge } from "../../app/components/ui/badge";
import type { AdminProjectDocument, MediaAsset, ProjectBlock } from "../types";
import {
  deleteProjectAsset,
  deleteProjectFromFirestore,
  loadProjectFromFirestore,
  saveProjectToFirestore,
  uploadProjectAssets,
} from "../services/firebase";
import { optimizeImageUploads } from "../services/optimizeImageUploads";

const LazyRichTextEditor = lazy(async () => {
  const mod = await import("../components/RichTextEditor");
  return { default: mod.RichTextEditor };
});

function getGalleryAssets(project: AdminProjectDocument) {
  return project.assets.filter((asset) => asset.role === "gallery");
}

function getSelectedAsset(project: AdminProjectDocument, assetId?: string) {
  return project.assets.find((asset) => asset.id === assetId) ?? null;
}

function syncProjectPreview(project: AdminProjectDocument): AdminProjectDocument {
  const selectedCover = getSelectedAsset(project, project.coverAssetId);
  const selectedCard = getSelectedAsset(project, project.cardAssetId);

  return {
    ...project,
    coverImageUrl: selectedCover?.src ?? project.coverImageUrl ?? "",
    cardImageUrl: selectedCard?.src ?? project.cardImageUrl ?? "",
    gallery: [
      ...(selectedCover
        ? [{ ...selectedCover, id: "cover", role: "cover" as const }]
        : []),
      ...getGalleryAssets(project),
    ],
  };
}

export function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<AdminProjectDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const loadedProject = await loadProjectFromFirestore(id);
      if (!loadedProject) {
        navigate("/admin");
        return;
      }
      setProject(syncProjectPreview(loadedProject));
    }

    void load();
  }, [id, navigate]);

  const save = useCallback(async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      const saved = await saveProjectToFirestore(syncProjectPreview(project));
      setProject(syncProjectPreview(saved));
      setLastSaved(new Date());
    } catch (error) {
      alert(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [project]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [save]);

  const updateProject = <K extends keyof AdminProjectDocument>(key: K, value: AdminProjectDocument[K]) => {
    setProject((current) => (current ? { ...current, [key]: value } : current));
  };

  const galleryAssets = useMemo(
    () => (project ? getGalleryAssets(project) : []),
    [project]
  );

  const handleUpload = async (fileList: FileList | null) => {
    if (!project || !fileList?.length) return;
    setUploading(true);
    try {
      const optimizedFiles = await optimizeImageUploads(fileList);
      const savedProject = await uploadProjectAssets(project.id, optimizedFiles);
      setProject(syncProjectPreview(savedProject));
      setLastSaved(new Date());
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const moveGalleryAsset = (assetId: string, direction: -1 | 1) => {
    if (!project) return;
    const assets = [...project.assets];
    const galleryIds = galleryAssets.map((asset) => asset.id);
    const currentIndex = galleryIds.findIndex((id) => id === assetId);
    const nextIndex = currentIndex + direction;
    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= galleryIds.length) return;

    const nextGalleryIds = [...galleryIds];
    [nextGalleryIds[currentIndex], nextGalleryIds[nextIndex]] = [nextGalleryIds[nextIndex], nextGalleryIds[currentIndex]];

    const galleryMap = new Map(galleryAssets.map((asset) => [asset.id, asset]));
    const reorderedGalleryAssets = nextGalleryIds.map((id) => galleryMap.get(id)).filter(Boolean) as MediaAsset[];
    const persistentAssets = assets.filter((asset) => asset.role !== "gallery");

    setProject(
      syncProjectPreview({
        ...project,
        assets: [...persistentAssets, ...reorderedGalleryAssets],
      })
    );
  };

  const setAssetAsCover = (assetId: string) => {
    if (!project) return;
    const selectedAsset = getSelectedAsset(project, assetId);
    if (!selectedAsset) return;
    setProject(
      syncProjectPreview({
        ...project,
        coverAssetId: assetId,
        coverImageUrl: selectedAsset.src,
      })
    );
  };

  const setAssetAsThumbnail = (assetId: string) => {
    if (!project) return;
    const selectedAsset = getSelectedAsset(project, assetId);
    if (!selectedAsset) return;
    setProject(
      syncProjectPreview({
        ...project,
        cardAssetId: assetId,
        cardImageUrl: selectedAsset.src,
      })
    );
  };

  const addTextBlock = () => {
    if (!project) return;
    const nextBlocks: ProjectBlock[] = [
      ...project.blocks,
      {
        id: crypto.randomUUID(),
        type: "text",
        html: "",
      },
    ];
    setProject({ ...project, blocks: nextBlocks });
  };

  const addImageBlock = (assetId: string) => {
    if (!project) return;
    const nextBlocks: ProjectBlock[] = [
      ...project.blocks,
      {
        id: crypto.randomUUID(),
        type: "image",
        assetId,
      },
    ];
    setProject({ ...project, blocks: nextBlocks });
  };

  const updateBlock = (blockId: string, updater: (block: ProjectBlock) => ProjectBlock) => {
    if (!project) return;
    setProject({
      ...project,
      blocks: project.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
    });
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    if (!project) return;
    const blocks = [...project.blocks];
    const index = blocks.findIndex((block) => block.id === blockId);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= blocks.length) return;
    [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
    setProject({ ...project, blocks });
  };

  const removeBlock = (blockId: string) => {
    if (!project) return;
    setProject({
      ...project,
      blocks: project.blocks.filter((block) => block.id !== blockId),
    });
  };

  const removeAsset = async (assetId: string) => {
    if (!project) return;
    const saved = await deleteProjectAsset(project.id, assetId);
    setProject(syncProjectPreview(saved));
  };

  if (!project) return null;

  const selectedCoverAsset = getSelectedAsset(project, project.coverAssetId);
  const selectedCardAsset = getSelectedAsset(project, project.cardAssetId);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/admin")}>
            <ArrowLeft className="size-4" />
            Projects
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="truncate text-sm text-muted-foreground">{project.title || "Untitled"}</span>
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
            onClick={() => updateProject("status", project.status === "published" ? "draft" : "published")}
          >
            {project.status}
          </Badge>
          <Button size="sm" onClick={() => void save()} disabled={isSaving} className="gap-1.5">
            <FloppyDisk className="size-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/30 p-5">
          <div className="space-y-5">
            <FieldGroup label="Title">
              <Input
                value={project.title}
                onChange={(event) => {
                  updateProject("title", event.target.value);
                }}
              />
            </FieldGroup>

            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Category">
                <Input
                  value={project.category}
                  onChange={(event) => updateProject("category", event.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="Year">
                <Input
                  value={project.year}
                  onChange={(event) => updateProject("year", event.target.value)}
                />
              </FieldGroup>
            </div>

            <FieldGroup label="Tags">
              <Input
                value={project.tags.join(", ")}
                onChange={(event) =>
                  updateProject(
                    "tags",
                    event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="UI, Dashboard, Fintech"
              />
            </FieldGroup>

            <FieldGroup label="Description">
              <textarea
                value={project.description}
                onChange={(event) => updateProject("description", event.target.value)}
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Project summary shown under the title."
              />
            </FieldGroup>

            <FieldGroup label="Slug">
              <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {project.slug}
              </div>
            </FieldGroup>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <PreviewCard
                label="Thumbnail"
                imageUrl={selectedCardAsset?.src || project.cardImageUrl}
              />
              <PreviewCard
                label="Cover"
                imageUrl={selectedCoverAsset?.src || project.coverImageUrl}
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CloudUpload className="size-4" />
              )}
              {uploading ? "Uploading…" : "Upload Images"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              multiple
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files)}
            />

            <Button
              variant="ghost"
              className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                if (!confirm("Delete this project from the repo?")) return;
                await deleteProjectFromFirestore(project.id);
                navigate("/admin");
              }}
            >
              <Trash className="size-4" />
              Delete Project
            </Button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-4xl space-y-10 p-8">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-foreground">Project Images</h2>
                  <p className="text-sm text-muted-foreground">
                    Reorder gallery images, choose the cover, and set the card thumbnail.
                  </p>
                </div>
              </div>

              {galleryAssets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
                  <p className="text-sm font-medium text-foreground">No images yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload a few still images to start building this project.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {galleryAssets.map((asset, index) => (
                    <div key={asset.id} className="rounded-2xl border border-border p-4">
                      <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4">
                        <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                          <img src={asset.src} alt="" className="aspect-[16/10] w-full object-cover" />
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {String(index + 1).padStart(2, "0")}
                            </Badge>
                            {project.coverAssetId === asset.id && (
                              <Badge variant="default" className="gap-1">
                                <Star className="size-3" />
                                Cover
                              </Badge>
                            )}
                            {project.cardAssetId === asset.id && (
                              <Badge variant="outline">Thumbnail</Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => moveGalleryAsset(asset.id, -1)} disabled={index === 0}>
                              Move Up
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => moveGalleryAsset(asset.id, 1)} disabled={index === galleryAssets.length - 1}>
                              Move Down
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setAssetAsCover(asset.id)}>
                              Set as Cover
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setAssetAsThumbnail(asset.id)}>
                              Set as Thumbnail
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => addImageBlock(asset.id)}>
                              Add to Story
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void removeAsset(asset.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-foreground">Story Content</h2>
                  <p className="text-sm text-muted-foreground">
                    Add text and image blocks in the order you want them to appear.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={addTextBlock}>
                    <TextFormat className="size-4" />
                    Text Block
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="size-4" />
                    Upload More
                  </Button>
                </div>
              </div>

              {project.blocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
                  <p className="text-sm font-medium text-foreground">No story blocks yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add text or attach one of your uploaded images to the story flow.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {project.blocks.map((block, index) => {
                    const imageAsset = block.type === "image"
                      ? project.assets.find((asset) => asset.id === block.assetId)
                      : null;

                    return (
                      <div key={block.id} className="rounded-2xl border border-border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {block.type === "text" ? "Text" : "Image"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => moveBlock(block.id, -1)} disabled={index === 0}>
                              Up
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => moveBlock(block.id, 1)} disabled={index === project.blocks.length - 1}>
                              Down
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeBlock(block.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>

                        {block.type === "text" ? (
                          <Suspense
                            fallback={(
                              <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
                                Loading editor…
                              </div>
                            )}
                          >
                            <LazyRichTextEditor
                              content={block.html}
                              onChange={(html) => updateBlock(block.id, (current) => ({ ...current, html }))}
                              placeholder="Enter your text here..."
                            />
                          </Suspense>
                        ) : imageAsset ? (
                          <div className="space-y-3">
                            <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                              <img src={imageAsset.src} alt="" className="w-full object-cover" />
                            </div>
                            <Input
                              value={block.caption ?? ""}
                              onChange={(event) =>
                                updateBlock(block.id, (current) => ({
                                  ...current,
                                  caption: event.target.value,
                                }))
                              }
                              placeholder="Add a caption"
                            />
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                            This image asset no longer exists.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function PreviewCard({
  label,
  imageUrl,
}: {
  label: string;
  imageUrl?: string;
}) {
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="aspect-[16/10] w-full object-cover" />
        ) : (
          <div className="aspect-[16/10] bg-muted/40" />
        )}
      </div>
    </div>
  );
}
