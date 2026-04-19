import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ProjectDocument, ProjectIndexEntry } from "../content/schema";
import type { CanvasProjectSummary } from "./components/types";
import { projects as hardcodedProjects } from "./components/data";
import { Toolbar } from "./components/Toolbar";
import { InfiniteCanvas } from "./components/InfiniteCanvas";
import { autoLayoutProjects } from "./components/autoLayout";
import { ThemeProvider, useTheme } from "./components/ThemeContext";
import { ThemeTransition } from "./components/ThemeTransition";
import {
  loadPublicProjectDetail,
  loadPublicProjectIndex,
  prefetchPublicSearchIndex,
  prefetchPublicProjectDetail,
} from "./contentClient";

const LazyProjectDetail = lazy(async () => {
  const mod = await import("./components/ProjectDetail");
  return { default: mod.ProjectDetail };
});

const LazyBootSequence = lazy(async () => {
  const mod = await import("./components/BootSequence");
  return { default: mod.BootSequence };
});

const LazyCustomCursor = lazy(async () => {
  const mod = await import("./components/CustomCursor");
  return { default: mod.CustomCursor };
});

const LazySearchDialog = lazy(async () => {
  const mod = await import("./components/SearchDialog");
  return { default: mod.SearchDialog };
});

function mapFallbackProjects(): ProjectIndexEntry[] {
  return hardcodedProjects.map(({ imageUrl, width, height, x, y, ...project }, index) => ({
    id: project.id,
    slug: project.id,
    title: project.title,
    category: project.category,
    year: project.year,
    cardImageUrl: imageUrl,
    coverImageUrl: imageUrl,
    width,
    height,
    sortOrder: index,
    status: "published" as const,
  }));
}

function AppContent() {
  const { colors } = useTheme();
  const [isBooting, setIsBooting] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [projectIndex, setProjectIndex] = useState<ProjectIndexEntry[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<Record<string, ProjectDocument>>({});
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const originRectRef = useRef<DOMRect | null>(null);
  const fallbackProjects = useMemo(() => mapFallbackProjects(), []);

  useEffect(() => {
    let cancelled = false;

    loadPublicProjectIndex()
      .then((projects) => {
        if (cancelled) return;
        setProjectIndex(projects.filter((project) => project.status === "published"));
      })
      .catch(() => {
        if (cancelled) return;
        setProjectIndex(fallbackProjects);
      })
      .finally(() => {
        if (!cancelled) setIndexLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackProjects]);

  const projects = useMemo<CanvasProjectSummary[]>(() => {
    if (!indexLoaded) return [];
    const source = projectIndex.length > 0 ? projectIndex : fallbackProjects;
    return autoLayoutProjects(source);
  }, [fallbackProjects, indexLoaded, projectIndex]);

  const hasResolvedProjects = indexLoaded && projects.length > 0;

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedDocument = selectedProject ? projectDocuments[selectedProject.id] ?? null : null;

  const ensureProjectDocument = useCallback(async (project: CanvasProjectSummary) => {
    if (projectDocuments[project.id]) return projectDocuments[project.id];

    setLoadingProjectId(project.id);
    try {
      const document = await loadPublicProjectDetail(project.slug);
      setProjectDocuments((prev) => ({ ...prev, [project.id]: document }));
      return document;
    } finally {
      setLoadingProjectId((current) => (current === project.id ? null : current));
    }
  }, [projectDocuments]);

  useEffect(() => {
    if (!selectedProject) return;
    const currentIndex = projects.findIndex((project) => project.id === selectedProject.id);
    const neighbors = [projects[currentIndex - 1], projects[currentIndex + 1]].filter(Boolean);

    for (const neighbor of neighbors) {
      prefetchPublicProjectDetail(neighbor.slug);
    }
  }, [projects, selectedProject]);

  const handleOpenProject = useCallback((project: CanvasProjectSummary, rect: DOMRect) => {
    originRectRef.current = rect;
    setOriginRect(rect);
    setSelectedProjectId(project.id);
    void ensureProjectDocument(project);
  }, [ensureProjectDocument]);

  const handleCloseProject = useCallback(() => {
    setSelectedProjectId(null);
    setTimeout(() => {
      setOriginRect(null);
      originRectRef.current = null;
    }, 400);
  }, []);

  const handleNavigate = useCallback((project: CanvasProjectSummary) => {
    setSelectedProjectId(project.id);
    setOriginRect(null);
    void ensureProjectDocument(project);
  }, [ensureProjectDocument]);

  const handleSelectProjectFromSearch = useCallback((project: CanvasProjectSummary) => {
    setSearchOpen(false);
    setSelectedProjectId(project.id);
    setOriginRect(null);
    originRectRef.current = null;
    void ensureProjectDocument(project);
  }, [ensureProjectDocument]);

  const handleBootComplete = useCallback(() => {
    setIsBooting(false);
  }, []);

  useEffect(() => {
    if (!hasResolvedProjects || isBooting || selectedProjectId) return;

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName;
      return (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasResolvedProjects, isBooting, selectedProjectId]);

  return (
    <div
      className="h-dvh w-dvw overflow-hidden"
      data-custom-cursor
      style={{
        backgroundColor: colors.bg,
        transition: "background-color 0.35s ease",
      }}
    >
      <Suspense fallback={null}>
        <LazyCustomCursor />
      </Suspense>
      <ThemeTransition />

      {hasResolvedProjects && isBooting && (
        <Suspense fallback={null}>
          <LazyBootSequence projects={projects} onComplete={handleBootComplete} />
        </Suspense>
      )}

      {hasResolvedProjects && (
        <Toolbar
          projectCount={projects.length}
          onOpenSearch={() => setSearchOpen(true)}
          onPrefetchSearch={prefetchPublicSearchIndex}
        />
      )}

      {hasResolvedProjects ? (
        <div className="h-full">
          <InfiniteCanvas
            projects={projects}
            onOpenProject={handleOpenProject}
          />
        </div>
      ) : (
        <div className="h-full w-full" />
      )}

      <Suspense fallback={null}>
        <LazyProjectDetail
          project={selectedProject}
          projectDocument={selectedDocument}
          isLoading={loadingProjectId === selectedProject?.id}
          projects={projects}
          originRect={originRect}
          onClose={handleCloseProject}
          onNavigate={handleNavigate}
        />
      </Suspense>

      <Suspense fallback={null}>
        <LazySearchDialog
          open={searchOpen}
          projects={projects}
          onClose={() => setSearchOpen(false)}
          onSelectProject={handleSelectProjectFromSearch}
        />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
