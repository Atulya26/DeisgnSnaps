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
  const sidebarRef = useRef<HTMLDivElement>(null);
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

  // Theme-aware card colors
  const cardBg = theme === "light" ? "#FFFFFF" : "#1C1C1C";
  const cardBorder = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const cardShadow = theme === "light"
    ? "0 4px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)"
    : "0 4px 40px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2)";
  const textureBg = theme === "light" ? "#EAE8E3" : "#111111";
  const textureLineColor = theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)";
  const sidebarTextColor = theme === "light" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)";

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
              {/* Left: Project counter + title */}
              <div className="flex items-center gap-4">
                <span
                  style={{
                    fontSize: 11,
                    color: sidebarTextColor,
                    letterSpacing: "0.1em",
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {displayNum}/{totalNum}
                </span>
                <span
                  className="hidden sm:block"
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
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
                className="flex min-h-screen justify-center px-4 pb-24 pt-20 sm:px-8 lg:px-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Desktop sidebar (left gutter) — hidden on mobile ── */}
                <div
                  ref={sidebarRef}
                  className="mr-8 hidden w-48 shrink-0 lg:block"
                  style={{ paddingTop: 48 }}
                >
                  <div className="sticky top-28">
                    {/* Project number — large, faded */}
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    >
                      <span
                        style={{
                          fontSize: 64,
                          fontWeight: 300,
                          color: sidebarTextColor,
                          fontFamily: "'Instrument Serif', Georgia, serif",
                          lineHeight: 1,
                          display: "block",
                        }}
                      >
                        {displayNum}
                      </span>
                    </motion.div>

                    {/* Category label */}
                    <motion.div
                      className="mt-6"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 400,
                          color: sidebarTextColor,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase" as const,
                          fontFamily: "'Geist Mono', monospace",
                        }}
                      >
                        {currentProject.category}
                      </span>
                    </motion.div>

                    {/* Year */}
                    <motion.div
                      className="mt-2"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: sidebarTextColor,
                          fontFamily: "'Geist Mono', monospace",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {currentProject.year}
                      </span>
                    </motion.div>

                    {/* Tags — vertical */}
                    <motion.div
                      className="mt-8 flex flex-col gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                    >
                      {currentProject.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 10,
                            color: sidebarTextColor,
                            fontFamily: "'Geist Mono', monospace",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </motion.div>

                    {/* Scroll indicator */}
                    <motion.div
                      className="mt-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.8 }}
                    >
                      <div
                        style={{
                          width: 1,
                          height: 48,
                          backgroundColor: sidebarTextColor,
                          marginBottom: 8,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          color: sidebarTextColor,
                          fontFamily: "'Geist Mono', monospace",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase" as const,
                          writingMode: "vertical-lr" as const,
                        }}
                      >
                        Scroll
                      </span>
                    </motion.div>
                  </div>
                </div>

                {/* ── Content card ── */}
                <motion.div
                  ref={cardRef}
                  className="w-full max-w-[860px]"
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 20,
                    border: `1px solid ${cardBorder}`,
                    boxShadow: cardShadow,
                    overflow: "hidden",
                  }}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                >
                  {/* ── Hero Image — with parallax ── */}
                  <div data-hero className="overflow-hidden">
                    <ImageWithFallback
                      src={currentProject.imageUrl}
                      alt={currentProject.title}
                      className="w-full"
                      style={{ minHeight: 300, display: "block" }}
                    />
                  </div>

                  {/* ── Card inner content ── */}
                  <div className="px-6 py-8 sm:px-10 sm:py-10">
                    {/* Mobile-only meta header (hidden on desktop where sidebar shows it) */}
                    <div className="mb-1 flex items-center gap-3 lg:hidden">
                      <span
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          fontFamily: "'Geist Mono', monospace",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {currentProject.category}
                      </span>
                      <span
                        style={{ fontSize: 11, color: colors.borderLight, fontFamily: "'Geist Mono', monospace" }}
                      >
                        /
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          fontFamily: "'Geist Mono', monospace",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {currentProject.year}
                      </span>
                    </div>

                    {/* Title */}
                    <motion.h1
                      className="text-balance"
                      style={{
                        fontFamily: "'Instrument Serif', Georgia, serif",
                        fontSize: "clamp(28px, 4vw, 44px)",
                        fontWeight: 400,
                        color: theme === "light" ? "#111" : "#F0F0F0",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                      }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    >
                      {currentProject.title}
                    </motion.h1>

                    {/* Tags — mobile inline, desktop hidden (shown in sidebar) */}
                    <motion.div
                      className="mt-4 flex flex-wrap gap-1.5 lg:hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      {currentProject.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full px-2.5 py-0.5"
                          style={{
                            fontSize: 10,
                            color: colors.textMuted,
                            border: `1px solid ${cardBorder}`,
                            fontFamily: "'Geist Mono', monospace",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </motion.div>

                    {/* Description */}
                    {currentProject.description && (
                      <motion.p
                        className="mt-6 text-pretty sm:mt-8"
                        style={{
                          fontSize: 15,
                          color: theme === "light" ? "#555" : "#999",
                          lineHeight: 1.8,
                          maxWidth: 600,
                          letterSpacing: "-0.005em",
                        }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                      >
                        {currentProject.description}
                      </motion.p>
                    )}

                    {/* ── Separator ── */}
                    <motion.div
                      className="mt-8 sm:mt-10"
                      style={{
                        height: 1,
                        backgroundColor: cardBorder,
                        transformOrigin: "left",
                      }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
                    />

                    {/* ── Gallery: GSAP scroll-driven reveal ── */}
                    <div className="mt-8 space-y-6 sm:mt-10 sm:space-y-8">
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
                                      className="px-4 py-2.5"
                                      style={{
                                        fontSize: 11,
                                        color: colors.textMuted,
                                        fontFamily: "'Geist Mono', monospace",
                                        letterSpacing: "0.02em",
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
                                    fontSize: 14,
                                    color: theme === "light" ? "#555" : "#999",
                                    lineHeight: 1.8,
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
                    <div className="mt-10 flex items-center justify-between sm:mt-14">
                      <span
                        style={{
                          fontSize: 10,
                          color: sidebarTextColor,
                          fontFamily: "'Geist Mono', monospace",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase" as const,
                        }}
                      >
                        {displayNum} / {totalNum}
                      </span>
                      <div className="flex items-center gap-3">
                        {currentIndex > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); goPrev(); }}
                            className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 transition-all hover:opacity-70 active:scale-95"
                            style={{
                              fontSize: 11,
                              color: colors.textMuted,
                              border: `1px solid ${cardBorder}`,
                              fontFamily: "'Geist Mono', monospace",
                              letterSpacing: "0.02em",
                            }}
                          >
                            <ArrowLeft size={12} />
                            Prev
                          </button>
                        )}
                        {currentIndex < projects.length - 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); goNext(); }}
                            className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 transition-all hover:opacity-70 active:scale-95"
                            style={{
                              fontSize: 11,
                              color: colors.textMuted,
                              border: `1px solid ${cardBorder}`,
                              fontFamily: "'Geist Mono', monospace",
                              letterSpacing: "0.02em",
                            }}
                          >
                            Next
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* ── Desktop right gutter — hidden on mobile ── */}
                <div className="ml-8 hidden w-48 shrink-0 lg:block" />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
