import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Cross, ArrowLeft, ArrowRight } from "geist-icons";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import type { Project } from "./types";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { easings } from "./animationConfig";
import { useTheme } from "./ThemeContext";

gsap.registerPlugin(ScrollTrigger);

interface ProjectDetailProps {
  project: Project | null;
  projects: Project[];
  originRect: DOMRect | null;
  onClose: () => void;
  onNavigate: (project: Project) => void;
}

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -100 : 100,
    opacity: 0,
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
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { colors, theme } = useTheme();
  const lenisRef = useRef<Lenis | null>(null);
  const scrollTriggersRef = useRef<ScrollTrigger[]>([]);

  // ── Lifecycle ──
  useEffect(() => {
    if (project) {
      const idx = projects.findIndex((p) => p.id === project.id);
      setCurrentIndex(idx);
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        const el = containerRef.current;
        if (el && !lenisRef.current) {
          lenisRef.current = new Lenis({
            wrapper: el,
            content: el.firstElementChild as HTMLElement,
            smoothWheel: true,
            lerp: 0.07,
            touchMultiplier: 1.5,
            wheelMultiplier: 1,
            autoRaf: true,
          });
          // Connect Lenis to ScrollTrigger
          lenisRef.current.on("scroll", ScrollTrigger.update);
        }
      }, 80);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
        // Clean up ScrollTriggers
        scrollTriggersRef.current.forEach((st) => st.kill());
        scrollTriggersRef.current = [];
        if (lenisRef.current) {
          lenisRef.current.destroy();
          lenisRef.current = null;
        }
      };
    } else {
      document.body.style.overflow = "";
      scrollTriggersRef.current.forEach((st) => st.kill());
      scrollTriggersRef.current = [];
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
    }
  }, [project, projects]);

  // ── GSAP scroll-driven image reveals ──
  useEffect(() => {
    if (!project || prefersReduced) return;

    // Wait for DOM to settle
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      // Clean previous triggers
      scrollTriggersRef.current.forEach((st) => st.kill());
      scrollTriggersRef.current = [];

      // Select all reveal targets
      const images = container.querySelectorAll<HTMLElement>("[data-reveal]");
      images.forEach((img, i) => {
        // Initial state
        gsap.set(img, {
          clipPath: "inset(20% 0% 20% 0%)",
          opacity: 0,
          y: 40,
          scale: 0.96,
        });

        const st = ScrollTrigger.create({
          trigger: img,
          scroller: container,
          start: "top 85%",
          end: "top 30%",
          onEnter: () => {
            gsap.to(img, {
              clipPath: "inset(0% 0% 0% 0%)",
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.9,
              ease: "power3.out",
              delay: i * 0.05,
            });
          },
          once: true,
        });
        scrollTriggersRef.current.push(st);
      });

      // Parallax on hero
      const hero = container.querySelector<HTMLElement>("[data-hero]");
      if (hero) {
        const st = ScrollTrigger.create({
          trigger: hero,
          scroller: container,
          start: "top top",
          end: "bottom top",
          scrub: 0.5,
          onUpdate: (self) => {
            const progress = self.progress;
            gsap.set(hero, {
              y: progress * 60,
              scale: 1 - progress * 0.03,
              opacity: 1 - progress * 0.3,
            });
          },
        });
        scrollTriggersRef.current.push(st);
      }

      ScrollTrigger.refresh();
    }, 200);

    return () => {
      clearTimeout(timer);
      scrollTriggersRef.current.forEach((st) => st.kill());
      scrollTriggersRef.current = [];
    };
  }, [project, currentIndex, prefersReduced]);

  const currentProject = currentIndex >= 0 ? projects[currentIndex] : null;

  const goNext = useCallback(() => {
    if (currentIndex < projects.length - 1) {
      setDirection(1);
      const next = projects[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      onNavigate(next);
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

  // Swipe (touch)
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

  // Swipe (mouse)
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

  if (!currentProject) return null;

  const hasContentBlocks =
    currentProject.contentBlocks && currentProject.contentBlocks.length > 0;
  const galleryImages =
    currentProject.galleryImages?.filter(
      (url) => url !== currentProject.imageUrl
    ) ?? [];

  const displayNum = String(currentIndex + 1).padStart(2, "0");
  const totalNum = String(projects.length).padStart(2, "0");

  // Theme-aware card colors (Tier 5: white-first, Inter, no magazine sidebar)
  const cardBg = theme === "light" ? "#FFFFFF" : "#1C1C1C";
  const cardBorder = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const cardShadow = theme === "light"
    ? "0 4px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
    : "0 4px 40px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2)";
  const textureBg = theme === "light" ? "#F7F7F7" : "#111111";
  const textureLineColor = theme === "light" ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.03)";
  const metaColor = theme === "light" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";

  return (
    <AnimatePresence>
      {project && (
        <>
          {/* ── Textured backdrop ── */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: textureBg }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={easings.slowFade}
            onClick={onClose}
          >
            {/* Dot pattern texture */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(${textureLineColor} 1px, transparent 1px)`,
                backgroundSize: "24px 24px",
              }}
            />
            {/* Subtle gradient wash from top */}
            <div
              className="absolute inset-0"
              style={{
                background: theme === "light"
                  ? "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 40%)"
                  : "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%)",
              }}
            />
          </motion.div>

          {/* ── Scrollable content layer ── */}
          <motion.div
            ref={containerRef}
            className="fixed inset-0 z-50 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={easings.fade}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            {/* ── Fixed top bar ── */}
            <motion.div
              key={`topbar-${currentProject.id}`}
              className="fixed left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4 sm:px-8"
              style={{
                backgroundColor: theme === "light" ? "rgba(234,232,227,0.8)" : "rgba(17,17,17,0.8)",
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
              }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            >
              {/* Left: Project counter + title (Inter, cleaner) */}
              <div className="flex items-center gap-4">
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: metaColor,
                    letterSpacing: "-0.005em",
                    fontFamily: "'Inter', sans-serif",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {displayNum} / {totalNum}
                </span>
                <span
                  className="hidden sm:block"
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {currentProject.title}
                </span>
              </div>

              {/* Right: Nav + close */}
              <div className="flex items-center gap-2">
                {currentIndex > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    className="flex cursor-pointer items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                    }}
                    aria-label="Previous project"
                  >
                    <ArrowLeft size={16} color={colors.text} />
                  </button>
                )}
                {currentIndex < projects.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    className="flex cursor-pointer items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                    }}
                    aria-label="Next project"
                  >
                    <ArrowRight size={16} color={colors.text} />
                  </button>
                )}
                <div
                  style={{
                    width: 1,
                    height: 16,
                    backgroundColor: theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)",
                    margin: "0 4px",
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="flex cursor-pointer items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                  }}
                  aria-label="Close"
                >
                  <Cross size={16} color={colors.text} />
                </button>
              </div>
            </motion.div>

            {/* ── Main layout: sidebar + card ── */}
            <AnimatePresence mode="popLayout" custom={direction}>
              <motion.div
                key={currentProject.id}
                custom={direction}
                variants={prefersReduced ? undefined : slideVariants}
                initial={prefersReduced ? { opacity: 0 } : "enter"}
                animate={prefersReduced ? { opacity: 1 } : "center"}
                exit={prefersReduced ? { opacity: 0 } : "exit"}
                transition={prefersReduced ? { duration: 0.15 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex min-h-screen justify-center px-4 pb-24 pt-20 sm:px-8"
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Content card ── */}
                <motion.div
                  ref={cardRef}
                  className="w-full max-w-[1040px]"
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 24,
                    border: `1px solid ${cardBorder}`,
                    boxShadow: cardShadow,
                    overflow: "hidden",
                  }}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                >
                  {/* ── Header (before hero): category + year, then big title ── */}
                  <div className="px-8 pt-10 pb-8 sm:px-14 sm:pt-14 sm:pb-10">
                    {/* Meta row — Inter, inline, all themes */}
                    <motion.div
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.25 }}
                    >
                      {currentProject.category && (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: metaColor,
                            letterSpacing: "-0.005em",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {currentProject.category}
                        </span>
                      )}
                      {currentProject.category && currentProject.year && (
                        <span
                          aria-hidden
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: "50%",
                            backgroundColor: metaColor,
                            opacity: 0.5,
                          }}
                        />
                      )}
                      {currentProject.year && (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: metaColor,
                            letterSpacing: "-0.005em",
                            fontFamily: "'Inter', sans-serif",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {currentProject.year}
                        </span>
                      )}
                    </motion.div>

                    {/* Big Inter display title */}
                    <motion.h1
                      className="mt-4 text-balance"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "clamp(36px, 5.5vw, 72px)",
                        fontWeight: 700,
                        color: colors.text,
                        letterSpacing: "-0.035em",
                        lineHeight: 1.02,
                      }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    >
                      {currentProject.title}
                    </motion.h1>

                    {/* Description */}
                    {currentProject.description && (
                      <motion.p
                        className="mt-6 text-pretty sm:mt-8"
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 18,
                          fontWeight: 400,
                          color: colors.textSecondary,
                          lineHeight: 1.55,
                          maxWidth: 720,
                          letterSpacing: "-0.01em",
                        }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                      >
                        {currentProject.description}
                      </motion.p>
                    )}

                    {/* Tag pills — Inter */}
                    {currentProject.tags?.length > 0 && (
                      <motion.div
                        className="mt-6 flex flex-wrap gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.45 }}
                      >
                        {currentProject.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full px-3 py-1"
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: colors.textSecondary,
                              border: `1px solid ${cardBorder}`,
                              fontFamily: "'Inter', sans-serif",
                              letterSpacing: "-0.005em",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </motion.div>
                    )}
                  </div>

                  {/* ── Hero Image — with parallax ── */}
                  <div
                    data-hero
                    className="overflow-hidden"
                    style={{ backgroundColor: colors.imageBg }}
                  >
                    <ImageWithFallback
                      src={currentProject.imageUrl}
                      alt={currentProject.title}
                      className="w-full"
                      style={{ minHeight: 300, display: "block" }}
                    />
                  </div>

                  {/* ── Card inner content: gallery / content blocks ── */}
                  <div className="px-8 py-10 sm:px-14 sm:py-14">
                    {/* ── Gallery: GSAP scroll-driven reveal ── */}
                    <div className="space-y-6 sm:space-y-8">
                      {/* Content Blocks */}
                      {hasContentBlocks &&
                        currentProject.contentBlocks!
                          .filter((block) => {
                            if (block.type === "image" && block.url === currentProject.imageUrl) return false;
                            return true;
                          })
                          .map((block, idx) => {
                            if (block.type === "image") {
                              return (
                                <div
                                  key={block.id}
                                  data-reveal
                                  className="overflow-hidden"
                                  style={{
                                    borderRadius: 12,
                                    backgroundColor: colors.imageBg,
                                  }}
                                >
                                  <ImageWithFallback
                                    src={block.url}
                                    alt={block.caption || `Image ${idx + 1}`}
                                    className="w-full"
                                    style={{ display: "block" }}
                                  />
                                  {block.caption && (
                                    <p
                                      className="px-5 py-3"
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: colors.textMuted,
                                        fontFamily: "'Inter', sans-serif",
                                        letterSpacing: "-0.005em",
                                      }}
                                    >
                                      {block.caption}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            if (block.type === "text") {
                              return (
                                <div
                                  key={block.id}
                                  data-reveal
                                  className="prose prose-neutral max-w-none"
                                  style={{
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: 16,
                                    color: colors.textSecondary,
                                    lineHeight: 1.7,
                                    letterSpacing: "-0.005em",
                                  }}
                                  dangerouslySetInnerHTML={{ __html: block.content }}
                                />
                              );
                            }
                            return null;
                          })}

                      {/* Legacy gallery images */}
                      {!hasContentBlocks &&
                        galleryImages.map((url, idx) => (
                          <div
                            key={url + idx}
                            data-reveal
                            className="overflow-hidden"
                            style={{
                              borderRadius: 12,
                              backgroundColor: colors.imageBg,
                            }}
                          >
                            <ImageWithFallback
                              src={url}
                              alt={`${currentProject.title} - ${idx + 2}`}
                              className="w-full"
                              style={{ display: "block" }}
                            />
                          </div>
                        ))}
                    </div>

                    {/* ── Card footer ── */}
                    <div className="mt-12 flex items-center justify-between sm:mt-16">
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: metaColor,
                          fontFamily: "'Inter', sans-serif",
                          letterSpacing: "-0.005em",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {displayNum} / {totalNum}
                      </span>
                      <div className="flex items-center gap-3">
                        {currentIndex > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); goPrev(); }}
                            className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 transition-all hover:opacity-70 active:scale-95"
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: colors.textSecondary,
                              border: `1px solid ${cardBorder}`,
                              fontFamily: "'Inter', sans-serif",
                              letterSpacing: "-0.005em",
                            }}
                          >
                            <ArrowLeft size={14} />
                            Previous
                          </button>
                        )}
                        {currentIndex < projects.length - 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); goNext(); }}
                            className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 transition-all hover:opacity-70 active:scale-95"
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: colors.textSecondary,
                              border: `1px solid ${cardBorder}`,
                              fontFamily: "'Inter', sans-serif",
                              letterSpacing: "-0.005em",
                            }}
                          >
                            Next
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
