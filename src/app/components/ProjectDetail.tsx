import { useEffect, useCallback, useState, useRef } from "react";
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

  // Tier 6: unified page — no floating card, no dot-pattern backdrop.
  // Every surface uses the main theme colors so the detail page reads as
  // one continuous document, not three disconnected layers.
  const pageBg = colors.bg;
  const topbarBg = theme === "light" ? "rgba(255,255,255,0.82)" : "rgba(18,18,18,0.82)";
  const cardBorder = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const metaColor = theme === "light" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const galleryBtnBg = theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(30,30,30,0.92)";

  // Build the horizontal-scroll gallery source list: cover + gallery images +
  // any image-type content blocks. Dedupe by url.
  const galleryAll: { url: string; caption?: string }[] = (() => {
    const seen = new Set<string>();
    const out: { url: string; caption?: string }[] = [];
    if (currentProject.imageUrl && !seen.has(currentProject.imageUrl)) {
      seen.add(currentProject.imageUrl);
      out.push({ url: currentProject.imageUrl });
    }
    for (const url of galleryImages) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ url });
    }
    if (hasContentBlocks) {
      for (const b of currentProject.contentBlocks!) {
        if (b.type === "image" && b.url && !seen.has(b.url)) {
          seen.add(b.url);
          out.push({ url: b.url, caption: b.caption });
        }
      }
    }
    return out;
  })();

  // Text-only content blocks stay vertical after the gallery.
  const textBlocks = hasContentBlocks
    ? currentProject.contentBlocks!.filter((b) => b.type === "text")
    : [];

  return (
    <AnimatePresence>
      {project && (
        <>
          {/* ── Unified white page (no backdrop layer) ── */}
          <motion.div
            ref={containerRef}
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ backgroundColor: pageBg }}
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
            {/* ── Sticky top bar ── */}
            <motion.div
              key={`topbar-${currentProject.id}`}
              className="fixed left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10"
              style={{
                backgroundColor: topbarBg,
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                borderBottom: `1px solid ${cardBorder}`,
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
                className="min-h-screen pb-24 pt-28 sm:pt-32"
                onClick={(e) => e.stopPropagation()}
              >
                <div ref={cardRef}>
                  {/* ── GALLERY FIRST: portfolio = work showcase, words come after ── */}
                  {galleryAll.length > 0 && (
                    <motion.div
                      className="relative"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                    >
                      <HorizontalGallery
                        images={galleryAll}
                        theme={theme}
                        bg={colors.imageBg}
                        btnBg={galleryBtnBg}
                        textColor={colors.text}
                        captionColor={colors.textMuted}
                      />
                    </motion.div>
                  )}

                  {/* ── Text block BELOW the gallery. Meta row then big
                       title, description, tags. Scroll down to read. ── */}
                  <div className="mx-auto mt-20 max-w-[1100px] px-6 sm:mt-28 sm:px-10">
                    <motion.div
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.35 }}
                    >
                      {currentProject.category && (
                        <span
                          style={{
                            fontSize: 14,
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
                            fontSize: 14,
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

                    <motion.h1
                      className="mt-4 text-balance"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "clamp(40px, 6.2vw, 88px)",
                        fontWeight: 700,
                        color: colors.text,
                        letterSpacing: "-0.04em",
                        lineHeight: 1.0,
                      }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                    >
                      {currentProject.title}
                    </motion.h1>

                    {currentProject.description && (
                      <motion.p
                        className="mt-6 text-pretty sm:mt-8"
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 19,
                          fontWeight: 400,
                          color: colors.textSecondary,
                          lineHeight: 1.55,
                          maxWidth: 760,
                          letterSpacing: "-0.01em",
                        }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
                      >
                        {currentProject.description}
                      </motion.p>
                    )}

                    {currentProject.tags?.length > 0 && (
                      <motion.div
                        className="mt-6 flex flex-wrap gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55 }}
                      >
                        {currentProject.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full px-3 py-1.5"
                            style={{
                              fontSize: 13,
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

                  {/* ── Optional vertical text blocks ── */}
                  {textBlocks.length > 0 && (
                    <div className="mx-auto mt-16 max-w-[760px] space-y-6 px-6 sm:mt-20 sm:px-10">
                      {textBlocks.map((block) => (
                        <div
                          key={block.id}
                          data-reveal
                          className="prose prose-neutral max-w-none"
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 17,
                            color: colors.textSecondary,
                            lineHeight: 1.7,
                            letterSpacing: "-0.005em",
                          }}
                          dangerouslySetInnerHTML={{ __html: (block as { content: string }).content }}
                        />
                      ))}
                    </div>
                  )}

                  {/* ── Footer ── */}
                  <div className="mx-auto mt-20 flex max-w-[1100px] items-center justify-between px-6 sm:mt-28 sm:px-10">
                    <span
                      style={{
                        fontSize: 14,
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
                          className="flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 transition-all hover:opacity-70 active:scale-95"
                          style={{
                            fontSize: 14,
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
                          className="flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 transition-all hover:opacity-70 active:scale-95"
                          style={{
                            fontSize: 14,
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
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Horizontal-scroll gallery — shopify.design-style full-bleed strip.
// CSS scroll-snap for native feel; left/right arrows for mouse-only users.
// ─────────────────────────────────────────────────────────────────────────
interface HorizontalGalleryProps {
  images: { url: string; caption?: string }[];
  theme: "light" | "dark";
  bg: string;
  btnBg: string;
  textColor: string;
  captionColor: string;
}

function HorizontalGallery({
  images,
  theme,
  bg,
  btnBg,
  textColor,
  captionColor,
}: HorizontalGalleryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges, images.length]);

  const step = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>("[data-slide]");
    const gap = 24;
    const delta = (slide?.offsetWidth ?? el.clientWidth * 0.8) + gap;
    el.scrollBy({ left: delta * dir, behavior: "smooth" });
  };

  const arrowBg = btnBg;
  const arrowBorder = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="hide-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto"
        style={{
          scrollPaddingInline: "max(24px, calc((100vw - 1100px) / 2))",
          paddingInline: "max(24px, calc((100vw - 1100px) / 2))",
          paddingBlock: 8,
        }}
      >
        {images.map((img, i) => (
          <div
            key={img.url + i}
            data-slide
            className="snap-center shrink-0"
            style={{
              // Smaller on desktop so the title/description peeks below the
              // fold — viewer sees there's more to read without scrolling.
              width: "min(900px, 74vw)",
            }}
          >
            <div
              className="overflow-hidden"
              style={{
                backgroundColor: bg,
                borderRadius: 20,
                aspectRatio: "16 / 10",
              }}
            >
              <ImageWithFallback
                src={img.url}
                alt={img.caption ?? `Project image ${i + 1}`}
                className="h-full w-full object-cover"
                style={{ display: "block" }}
              />
            </div>
            {/* Below the image: just the NN/TT counter (right-aligned).
                Caption label above removed per Tier 8 feedback. */}
            <div className="mt-3 flex items-center justify-end px-1">
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: captionColor,
                  letterSpacing: "-0.005em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(i + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Arrow buttons — only show when there's more than one slide */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous image"
            disabled={!canPrev}
            className="absolute top-1/2 -translate-y-1/2 rounded-full transition-opacity active:scale-95 disabled:opacity-0"
            style={{
              left: 16,
              width: 44,
              height: 44,
              backgroundColor: arrowBg,
              border: `1px solid ${arrowBorder}`,
              backdropFilter: "blur(12px) saturate(1.2)",
              WebkitBackdropFilter: "blur(12px) saturate(1.2)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ArrowLeft size={16} color={textColor} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next image"
            disabled={!canNext}
            className="absolute top-1/2 -translate-y-1/2 rounded-full transition-opacity active:scale-95 disabled:opacity-0"
            style={{
              right: 16,
              width: 44,
              height: 44,
              backgroundColor: arrowBg,
              border: `1px solid ${arrowBorder}`,
              backdropFilter: "blur(12px) saturate(1.2)",
              WebkitBackdropFilter: "blur(12px) saturate(1.2)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ArrowRight size={16} color={textColor} />
          </button>
        </>
      )}
    </div>
  );
}
