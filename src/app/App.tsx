import { useState, useCallback, useRef, useMemo } from "react";
import type { Project } from "./components/types";
import { projects as hardcodedProjects } from "./components/data";
import { Toolbar } from "./components/Toolbar";
import { InfiniteCanvas } from "./components/InfiniteCanvas";
import { ProjectDetail } from "./components/ProjectDetail";
import { CustomCursor } from "./components/CustomCursor";
import { autoLayoutProjects } from "./components/autoLayout";
import { ThemeProvider, useTheme } from "./components/ThemeContext";
import { ThemeTransition } from "./components/ThemeTransition";
import type { AdminProject } from "../admin/types";

/** Read published admin projects from localStorage */
function getPublishedAdminProjects(): {
  project: Omit<Project, "x" | "y" | "width" | "height">;
}[] {
  try {
    const raw = localStorage.getItem("portfolio_admin_projects");
    if (!raw) return [];
    const adminProjects: AdminProject[] = JSON.parse(raw);
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
  } catch {
    return [];
  }
}

function AppContent() {
  const { colors } = useTheme();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const originRectRef = useRef<DOMRect | null>(null);

  // Merge hardcoded + published admin projects, then auto-layout everything
  const projects = useMemo(() => {
    const adminEntries = getPublishedAdminProjects();
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
  }, []);

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
      <Toolbar projectCount={projects.length} />

      <div className="h-full" style={{ paddingTop: 70 }}>
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
