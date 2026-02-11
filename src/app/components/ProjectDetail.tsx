import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import type { Project } from "./types";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { springs, easings } from "./animationConfig";
import { useTheme } from "./ThemeContext";

interface ProjectDetailProps {
  project: Project | null;
  projects: Project[];
  originRect: DOMRect | null;
  onClose: () => void;
  onNavigate: (project: Project) => void;
}

// Stagger variants for project info content
const contentContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.35,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const contentChildVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.gentle,
  },
};

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 150 : -150,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -150 : 150,
    opacity: 0,
    scale: 0.97,
  }),
};

export function ProjectDetail({
  project,
  projects,
  originRect,
  onClose,
  onNavigate,
}: ProjectDetailProps) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { colors } = useTheme();

  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (project) {
      const idx = projects.findIndex((p) => p.id === project.id);
      setCurrentIndex(idx);
      document.body.style.overflow = "hidden";

      // Initialize Lenis on the scrollable container after a tick
      const timer = setTimeout(() => {
        const el = containerRef.current;
        if (el && !lenisRef.current) {
          lenisRef.current = new Lenis({
            wrapper: el,
            content: el.firstElementChild as HTMLElement,
            smoothWheel: true,
            lerp: 0.08,
            touchMultiplier: 1.5,
            wheelMultiplier: 1,
            autoRaf: true,
          });
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
        if (lenisRef.current) {
          lenisRef.current.destroy();
          lenisRef.current = null;
        }
      };
    } else {
      document.body.style.overflow = "";
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
    }
  }, [project, projects]);

  const currentProject = currentIndex >= 0 ? projects[currentIndex] : null;

  const goNext = useCallback(() => {
    if (currentIndex < projects.length - 1) {
      setDirection(1);
      const next = projects[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      onNavigate(next);
      // Scroll to top smoothly via Lenis
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { immediate: true });
      } else {
        containerRef.current?.scrollTo(0, 0);
      }
    }
  }, [currentIndex, projects, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      const prev = projects[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      onNavigate(prev);
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { immediate: true });
      } else {
        containerRef.current?.scrollTo(0, 0);
      }
    }
  }, [currentIndex, projects, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!project) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [project, onClose, goNext, goPrev]);

  // Swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  // Mouse swipe (drag)
  const isDragging = useRef(false);
  const dragStartX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = dragStartX.current - e.clientX;
    if (Math.abs(diff) > 80) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  // Hero transform calculations for GPU-composited animation
  const heroTransform = useMemo(() => {
    if (!originRect || direction !== 0) return null;

    const targetWidth = Math.min(900, window.innerWidth - 48);
    const targetLeft = (window.innerWidth - targetWidth) / 2;
    const targetTop = 80;
    const targetHeight = Math.min(540, targetWidth * 0.6);

    const scaleX = originRect.width / targetWidth;
    const scaleY = originRect.height / targetHeight;
    const scale = (scaleX + scaleY) / 2; // average for uniform scale

    return {
      scale,
      x: originRect.left - targetLeft + (originRect.width - targetWidth * scale) / 2,
      y: originRect.top - targetTop + (originRect.height - targetHeight * scale) / 2,
    };
  }, [originRect, direction]);

  if (!currentProject) return null;

  // Build the list of content to show:
  // 1. If contentBlocks exist, use them (Dribbble-style)
  // 2. Otherwise, fall back to galleryImages + description
  const hasContentBlocks =
    currentProject.contentBlocks && currentProject.contentBlocks.length > 0;
  const galleryImages = currentProject.galleryImages?.filter(
    (url) => url !== currentProject.imageUrl
  ) ?? [];

  return (
    <AnimatePresence>
      {project && (
        <>
          {/* Backdrop with subtle line texture */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: colors.bg }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={easings.slowFade}
            onClick={onClose}
          >
            {/* Diagonal line texture overlay */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 11px,
                  ${colors.gridLine} 11px,
                  ${colors.gridLine} 12px
                )`,
                opacity: 0.7,
              }}
            />
          </motion.div>

          {/* Content */}
          <motion.div
            ref={containerRef}
            className="fixed inset-0 z-50 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97, y: 20 }}
            transition={easings.fade}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            {/* Top bar */}
            <motion.div
              key={`topbar-${currentProject.id}`}
              className="fixed left-0 right-0 top-0 z-10 flex items-center justify-between px-6 py-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.snappy, delay: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 13, color: colors.textMuted }}>
                  {currentIndex + 1} / {projects.length}
                </span>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="flex items-center justify-center rounded-full transition-all hover:scale-105"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: colors.border,
                  backdropFilter: "blur(20px)",
                }}
                aria-label="Close"
              >
                <X size={18} color={colors.text} />
              </button>
            </motion.div>

            {/* Navigation arrows */}
            {currentIndex > 0 && (
              <motion.button
                key={`prev-${currentProject.id}`}
                className="fixed left-6 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full transition-all hover:scale-105"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: colors.surfaceAlpha,
                  boxShadow: colors.cardShadow,
                  backdropFilter: "blur(20px)",
                }}
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springs.snappy, delay: 0.2 }}
                aria-label="Previous project"
              >
                <ArrowLeft size={20} color={colors.text} />
              </motion.button>
            )}
            {currentIndex < projects.length - 1 && (
              <motion.button
                key={`next-${currentProject.id}`}
                className="fixed right-6 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full transition-all hover:scale-105"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: colors.surfaceAlpha,
                  boxShadow: colors.cardShadow,
                  backdropFilter: "blur(20px)",
                }}
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springs.snappy, delay: 0.2 }}
                aria-label="Next project"
              >
                <ArrowRight size={20} color={colors.text} />
              </motion.button>
            )}

            {/* Main content with slide animation */}
            <AnimatePresence mode="popLayout" custom={direction}>
              <motion.div
                key={currentProject.id}
                custom={direction}
                variants={prefersReduced ? undefined : slideVariants}
                initial={prefersReduced ? { opacity: 0 } : "enter"}
                animate={prefersReduced ? { opacity: 1 } : "center"}
                exit={prefersReduced ? { opacity: 0 } : "exit"}
                transition={prefersReduced ? { duration: 0.15 } : springs.gentle}
                className="flex min-h-screen flex-col items-center px-6 pb-24 pt-20"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Hero Image */}
                <motion.div
                  className="w-full overflow-hidden"
                  style={{
                    maxWidth: 900,
                    borderRadius: 18,
                    backgroundColor: colors.imageBg,
                    transformOrigin: "top left",
                  }}
                  initial={
                    heroTransform
                      ? {
                          scale: heroTransform.scale,
                          x: heroTransform.x,
                          y: heroTransform.y,
                          borderRadius: 14,
                        }
                      : { opacity: 0, y: 20 }
                  }
                  animate={{
                    scale: 1,
                    x: 0,
                    y: 0,
                    borderRadius: 18,
                    opacity: 1,
                  }}
                  exit={
                    heroTransform
                      ? {
                          scale: heroTransform.scale,
                          x: heroTransform.x,
                          y: heroTransform.y,
                          borderRadius: 14,
                          opacity: 0,
                        }
                      : { opacity: 0, scale: 0.95 }
                  }
                  transition={springs.gentle}
                >
                  <ImageWithFallback
                    src={currentProject.imageUrl}
                    alt={currentProject.title}
                    className="w-full"
                    style={{
                      minHeight: 320,
                    }}
                  />
                </motion.div>

                {/* Project Info — staggered reveal */}
                <motion.div
                  className="w-full"
                  style={{ maxWidth: 900 }}
                  variants={contentContainerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {/* Title row */}
                  <motion.div
                    className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
                    variants={contentChildVariants}
                  >
                    <div>
                      <h1
                        className="text-balance"
                        style={{
                          fontSize: 36,
                          color: colors.text,
                          letterSpacing: "-0.03em",
                          lineHeight: 1.15,
                        }}
                      >
                        {currentProject.title}
                      </h1>
                      <div className="mt-2 flex items-center gap-3">
                        <span style={{ fontSize: 14, color: colors.textSecondary }}>
                          {currentProject.category}
                        </span>
                        <span style={{ fontSize: 14, color: colors.borderLight }}>
                          /
                        </span>
                        <span style={{ fontSize: 14, color: colors.textMuted }}>
                          {currentProject.year}
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Tags */}
                  <motion.div className="mt-5 flex flex-wrap gap-2" variants={contentChildVariants}>
                    {currentProject.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-3 py-1"
                        style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                          backgroundColor: colors.border,
                          letterSpacing: "0.01em",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </motion.div>

                  {/* Separator */}
                  <motion.div
                    className="mt-8"
                    style={{
                      height: 1,
                      backgroundColor: colors.border,
                    }}
                    variants={contentChildVariants}
                  />

                  {/* Description */}
                  {currentProject.description && (
                    <motion.p
                      className="mt-8 text-pretty"
                      style={{
                        fontSize: 17,
                        color: colors.textSecondary,
                        lineHeight: 1.75,
                        maxWidth: 640,
                        letterSpacing: "-0.005em",
                      }}
                      variants={contentChildVariants}
                    >
                      {currentProject.description}
                    </motion.p>
                  )}

                  {/* ── Content Blocks (Dribbble-style) ── */}
                  {hasContentBlocks && (
                    <motion.div className="mt-10 space-y-6" variants={contentChildVariants}>
                      {currentProject.contentBlocks!
                        .filter((block) => {
                          if (block.type === "image" && block.url === currentProject.imageUrl) return false;
                          return true;
                        })
                        .map((block, idx) => {
                          if (block.type === "image") {
                            return (
                              <motion.div
                                key={block.id}
                                className="overflow-hidden"
                                style={{ borderRadius: 14, backgroundColor: colors.imageBg }}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ ...springs.gentle, delay: idx * 0.05 }}
                              >
                                <ImageWithFallback
                                  src={block.url}
                                  alt={block.caption || `Image ${idx + 1}`}
                                  className="w-full"
                                />
                                {block.caption && (
                                  <p
                                    className="px-5 py-3"
                                    style={{
                                      fontSize: 13,
                                      color: colors.textMuted,
                                      backgroundColor: colors.bg,
                                    }}
                                  >
                                    {block.caption}
                                  </p>
                                )}
                              </motion.div>
                            );
                          }

                          if (block.type === "text") {
                            return (
                              <motion.div
                                key={block.id}
                                className="prose prose-neutral max-w-none"
                                style={{
                                  fontSize: 16,
                                  color: colors.textSecondary,
                                  lineHeight: 1.8,
                                }}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={springs.gentle}
                                dangerouslySetInnerHTML={{ __html: block.content }}
                              />
                            );
                          }

                          return null;
                        })}
                    </motion.div>
                  )}

                  {/* ── Legacy gallery images (for hardcoded projects without blocks) ── */}
                  {!hasContentBlocks && galleryImages.length > 0 && (
                    <motion.div className="mt-10 space-y-4" variants={contentChildVariants}>
                      {galleryImages.map((url, idx) => (
                        <motion.div
                          key={url + idx}
                          className="overflow-hidden"
                          style={{ borderRadius: 14, backgroundColor: colors.imageBg }}
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-50px" }}
                          transition={{ ...springs.gentle, delay: idx * 0.05 }}
                        >
                          <ImageWithFallback
                            src={url}
                            alt={`${currentProject.title} - ${idx + 2}`}
                            className="w-full"
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {/* Swipe hint */}
                  <motion.div
                    className="mt-12 flex items-center justify-center gap-2"
                    variants={contentChildVariants}
                  >
                    <span style={{ fontSize: 12, color: colors.textMuted, opacity: 0.4 }}>
                      Swipe or use arrow keys to navigate
                    </span>
                  </motion.div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
