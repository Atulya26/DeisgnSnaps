import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { Project } from "./components/types";
import { projects as hardcodedProjects } from "./components/data";
import { Toolbar } from "./components/Toolbar";
import { InfiniteCanvas } from "./components/InfiniteCanvas";
import { ProjectDetail } from "./components/ProjectDetail";
import { CustomCursor } from "./components/CustomCursor";
import { BootSequence } from "./components/BootSequence";
import { autoLayoutProjects } from "./components/autoLayout";
import { ThemeProvider, useTheme } from "./components/ThemeContext";
import { ThemeTransition } from "./components/ThemeTransition";
import type { AdminProject } from "../admin/types";
import { getPublishedProjects } from "../admin/services/firebase";

/** Convert AdminProject[] to the shape expected by the portfolio */
function mapAdminToPortfolio(
  adminProjects: AdminProject[]
): { project: Omit<Project, "x" | "y" | "width" | "height"> }[] {
  return adminProjects
    .filter((p) => p.status === "published" && p.title && p.coverImageKey)
    .map((p) => ({
      project: {
        id: `admin-${p.id}`,
        title: p.title,
        category: p.category,
        year: p.year,
        imageUrl: p.coverImageKey,
        description: p.description,
        tags: p.tags,
        galleryImages: p.images?.map((img) => img.url).filter(Boolean) ?? [],
        contentBlocks: p.contentBlocks ?? [],
      },
    }));
}

function AppContent() {
  const { colors } = useTheme();
  const [isBooting, setIsBooting] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const originRectRef = useRef<DOMRect | null>(null);
  const [adminEntries, setAdminEntries] = useState<
    { project: Omit<Project, "x" | "y" | "width" | "height"> }[]
  >([]);
  const [firestoreLoaded, setFirestoreLoaded] = useState(false);

  // Load published projects from Firestore on mount — BEFORE boot starts
  useEffect(() => {
    async function loadFromFirestore() {
      try {
        const published = await getPublishedProjects();
        if (published.length > 0) {
          setAdminEntries(mapAdminToPortfolio(published));
        }
      } catch (err) {
        console.error("Failed to load published projects from Firestore:", err);
      } finally {
        setFirestoreLoaded(true);
      }
    }
    loadFromFirestore();
  }, []);

  // Merge hardcoded + published admin projects, then auto-layout everything
  const projects = useMemo(() => {
    const adminTitles = new Set(
      adminEntries.map((e) => e.project.title.toLowerCase())
    );

    // Strip x/y/w/h from hardcoded projects — auto-layout will recompute
    const hardcoded = hardcodedProjects
      .filter((p) => !adminTitles.has(p.title.toLowerCase()))
      .map(({ x, y, width, height, ...rest }) => rest);

    const adminPlain = adminEntries.map((e) => e.project);

    // Combine: hardcoded first, admin appended at end
    const allProjects = [...hardcoded, ...adminPlain];

    // Auto-layout computes x, y, width, height for every project
    return autoLayoutProjects(allProjects);
  }, [adminEntries]);

  // Warm the hero batch on idle so cards feel instant once the boot overlay
  // fades. Browser de-dupes the preload with the later <img> request.
  useEffect(() => {
    if (projects.length === 0) return;
    const idle =
      (window as Window & {
        requestIdleCallback?: (cb: () => void) => number;
      }).requestIdleCallback ??
      ((cb: () => void) => setTimeout(cb, 200));

    idle(() => {
      const seen = new Set<string>();
      for (const p of projects.slice(0, 10)) {
        if (!p.imageUrl || seen.has(p.imageUrl)) continue;
        seen.add(p.imageUrl);
        const l = document.createElement("link");
        l.rel = "preload";
        l.as = "image";
        l.href = p.imageUrl;
        (l as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = "high";
        document.head.appendChild(l);
      }

      // Second idle pass: off-thread decode of the next band so scrolling
      // into view is instantaneous. decode() resolves once the bitmap is
      // ready to paint; errors are ignored (some browsers reject on abort).
      idle(() => {
        for (const p of projects.slice(10, 30)) {
          if (!p.imageUrl || seen.has(p.imageUrl)) continue;
          seen.add(p.imageUrl);
          const img = new Image();
          img.decoding = "async";
          img.src = p.imageUrl;
          img.decode?.().catch(() => {});
        }
      });
    });
  }, [projects]);

  const handleOpenProject = useCallback((project: Project, rect: DOMRect) => {
    originRectRef.current = rect;
    setOriginRect(rect);
    setSelectedProject(project);
  }, []);

  const handleCloseProject = useCallback(() => {
    setSelectedProject(null);
    setTimeout(() => {
      setOriginRect(null);
      originRectRef.current = null;
    }, 600);
  }, []);

  const handleNavigate = useCallback((project: Project) => {
    setSelectedProject(project);
    setOriginRect(null);
  }, []);

  const handleBootComplete = useCallback(() => {
    setIsBooting(false);
  }, []);

  return (
    <div
      className="h-dvh w-dvw overflow-hidden"
      data-custom-cursor
      style={{
        backgroundColor: colors.bg,
        transition: "background-color 0.35s ease",
      }}
    >
      <CustomCursor />
      <ThemeTransition />

      {/* Boot sequence overlay — waits for Firestore so it only runs once */}
      {isBooting && firestoreLoaded && (
        <BootSequence projects={projects} onComplete={handleBootComplete} />
      )}

      <Toolbar projectCount={projects.length} />

      {/* Canvas fills the whole viewport — toolbar sits on top as a
          translucent overlay. Cards pan under it for that shopify-style
          soft-blur feel. Initial camera compensates via topInset so
          content still centers in the visible (below-toolbar) area. */}
      <div className="h-full">
        <InfiniteCanvas
          projects={projects}
          onOpenProject={handleOpenProject}
        />
      </div>

      <ProjectDetail
        project={selectedProject}
        projects={projects}
        originRect={originRect}
        onClose={handleCloseProject}
        onNavigate={handleNavigate}
      />
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
