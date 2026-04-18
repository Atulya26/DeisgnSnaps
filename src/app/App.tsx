import { useState, useCallback, useRef, useMemo } from "react";
import type { Project } from "./components/types";
import { projects as hardcodedProjects } from "./components/data";
import { localPortfolioProjects } from "./components/portfolioData.local.generated";
import { Toolbar } from "./components/Toolbar";
import { InfiniteCanvas } from "./components/InfiniteCanvas";
import { ProjectDetail } from "./components/ProjectDetail";
import { CustomCursor } from "./components/CustomCursor";
import { BootSequence } from "./components/BootSequence";
import { autoLayoutProjects } from "./components/autoLayout";
import { ThemeProvider, useTheme } from "./components/ThemeContext";
import { ThemeTransition } from "./components/ThemeTransition";

function AppContent() {
  const { colors } = useTheme();
  const [isBooting, setIsBooting] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const originRectRef = useRef<DOMRect | null>(null);

  // Local-first portfolio source for static hosting. The admin code remains
  // in the repo, but the public site no longer depends on the admin API.
  const projects = useMemo(() => {
    const allProjects = localPortfolioProjects.length > 0
      ? localPortfolioProjects
      : hardcodedProjects.map(({ x, y, width, height, ...rest }) => rest);

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

      {/* Boot sequence overlay */}
      {isBooting && projects.length > 0 && (
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
