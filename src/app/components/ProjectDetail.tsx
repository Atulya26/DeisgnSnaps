import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Cross } from "geist-icons";
import type { ProjectDocument } from "../../content/schema";
import type { Project } from "./types";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useTheme } from "./ThemeContext";

interface ProjectDetailProps {
  project: Project | null;
  projectDocument: ProjectDocument | null;
  isLoading?: boolean;
  projects: Project[];
  originRect: DOMRect | null;
  onClose: () => void;
  onNavigate: (project: Project) => void;
}

interface HorizontalGalleryHandle {
  step: (dir: 1 | -1) => void;
}

const pageTransition = {
  duration: 0.38,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function ProjectDetail({
  project,
  projectDocument,
  isLoading = false,
  projects,
  originRect: _originRect,
  onClose,
  onNavigate,
}: ProjectDetailProps) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [direction, setDirection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HorizontalGalleryHandle | null>(null);
  const prefersReduced = useReducedMotion();
  const { colors, theme } = useTheme();

  useEffect(() => {
    if (!project) {
      document.body.style.overflow = "";
      return;
    }

    const idx = projects.findIndex((entry) => entry.id === project.id);
    setCurrentIndex(idx);
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });

    return () => {
      document.body.style.overflow = "";
    };
  }, [project, projects]);

  useEffect(() => {
    if (!project) return;
    const canStepGallery = (projectDocument?.gallery?.length ?? 1) > 1;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && canStepGallery) {
        e.preventDefault();
        galleryRef.current?.step(e.key === "ArrowRight" ? 1 : -1);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, project, projectDocument?.gallery?.length]);

  const currentProject = currentIndex >= 0 ? projects[currentIndex] : project;
  const assetMap = useMemo(() => {
    const map = new Map<string, { src: string; caption?: string }>();
    for (const asset of projectDocument?.gallery ?? []) {
      map.set(asset.id, { src: asset.src, caption: asset.caption });
    }
    return map;
  }, [projectDocument]);

  const galleryImages = useMemo(() => {
    if (projectDocument?.gallery?.length) {
      return projectDocument.gallery.map((asset) => ({
        url: asset.src,
        caption: asset.caption,
      }));
    }

    if (!currentProject) return [];
    return [
      {
        url: currentProject.coverImageUrl ?? currentProject.cardImageUrl,
      },
    ];
  }, [currentProject, projectDocument]);

  const blockContent = useMemo(() => {
    if (!projectDocument) return [];
    return projectDocument.blocks;
  }, [projectDocument]);

  const goNext = useCallback(() => {
    if (currentIndex < projects.length - 1) {
      setDirection(1);
      onNavigate(projects[currentIndex + 1]);
    }
  }, [currentIndex, onNavigate, projects]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      onNavigate(projects[currentIndex - 1]);
    }
  }, [currentIndex, onNavigate, projects]);

  if (!currentProject) return null;

  const displayNum = String(currentIndex + 1).padStart(2, "0");
  const totalNum = String(projects.length).padStart(2, "0");
  const topbarBg = theme === "light" ? "rgba(255,255,255,0.84)" : "rgba(18,18,18,0.84)";
  const borderColor = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const metaColor = theme === "light" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const controlBg = theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
  const galleryBtnBg = theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(30,30,30,0.92)";

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          ref={containerRef}
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{ backgroundColor: colors.bg }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: 16 }}
          transition={pageTransition}
        >
          <motion.div
            className="fixed left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10"
            style={{
              backgroundColor: topbarBg,
              backdropFilter: "blur(20px) saturate(1.4)",
              WebkitBackdropFilter: "blur(20px) saturate(1.4)",
              borderBottom: `1px solid ${borderColor}`,
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...pageTransition, delay: 0.08 }}
          >
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

            <div className="flex items-center gap-2">
              {currentIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  className="flex cursor-pointer items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95"
                  style={{ width: 36, height: 36, backgroundColor: controlBg }}
                  aria-label="Previous project"
                >
                  <ArrowLeft size={16} color={colors.text} />
                </button>
              )}
              {currentIndex < projects.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  className="flex cursor-pointer items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95"
                  style={{ width: 36, height: 36, backgroundColor: controlBg }}
                  aria-label="Next project"
                >
                  <ArrowRight size={16} color={colors.text} />
                </button>
              )}
              <div
                style={{
                  width: 1,
                  height: 16,
                  backgroundColor: borderColor,
                  margin: "0 4px",
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="flex cursor-pointer items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95"
                style={{ width: 36, height: 36, backgroundColor: controlBg }}
                aria-label="Close"
              >
                <Cross size={16} color={colors.text} />
              </button>
            </div>
          </motion.div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentProject.id}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? 48 : -48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -48 : 48 }}
              transition={pageTransition}
              className="min-h-screen pb-24 pt-28 sm:pt-32"
            >
              {galleryImages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...pageTransition, delay: 0.08 }}
                >
                  <HorizontalGallery
                    ref={galleryRef}
                    images={galleryImages}
                    theme={theme}
                    bg={colors.imageBg}
                    btnBg={galleryBtnBg}
                    textColor={colors.text}
                    captionColor={colors.textMuted}
                  />
                </motion.div>
              )}

              <div className="mx-auto mt-20 max-w-[1100px] px-6 sm:mt-28 sm:px-10">
                <motion.div
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...pageTransition, delay: 0.12 }}
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
                  {isLoading && (
                    <span
                      className="rounded-full px-2.5 py-1"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: colors.textMuted,
                        backgroundColor: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                        letterSpacing: "-0.01em",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      Loading details…
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
                    lineHeight: 1,
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...pageTransition, delay: 0.16 }}
                >
                  {currentProject.title}
                </motion.h1>

                {!!projectDocument?.description && (
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
                    transition={{ ...pageTransition, delay: 0.2 }}
                  >
                    {projectDocument.description}
                  </motion.p>
                )}

                {!!projectDocument?.tags?.length && (
                  <motion.div
                    className="mt-6 flex flex-wrap gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ ...pageTransition, delay: 0.24 }}
                  >
                    {projectDocument.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-3 py-1.5"
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: colors.textSecondary,
                          border: `1px solid ${borderColor}`,
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

              {blockContent.length > 0 && (
                <div className="mx-auto mt-16 max-w-[1100px] space-y-8 px-6 sm:mt-20 sm:px-10">
                  {blockContent.map((block, index) => {
                    if (block.type === "text") {
                      return (
                        <motion.div
                          key={block.id}
                          className="mx-auto max-w-[760px]"
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...pageTransition, delay: Math.min(index * 0.04, 0.2) }}
                        >
                          <div
                            className="prose prose-neutral max-w-none"
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontSize: 17,
                              color: colors.textSecondary,
                              lineHeight: 1.7,
                              letterSpacing: "-0.005em",
                            }}
                            dangerouslySetInnerHTML={{ __html: block.html }}
                          />
                        </motion.div>
                      );
                    }

                    const imageAsset = assetMap.get(block.assetId);
                    if (!imageAsset) return null;

                    return (
                      <motion.div
                        key={block.id}
                        className="mx-auto max-w-[980px]"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...pageTransition, delay: Math.min(index * 0.04, 0.2) }}
                      >
                        <div
                          className="overflow-hidden rounded-[24px]"
                          style={{
                            backgroundColor: colors.imageBg,
                            border: `1px solid ${borderColor}`,
                          }}
                        >
                          <ImageWithFallback
                            src={imageAsset.src}
                            alt={block.caption ?? imageAsset.caption ?? currentProject.title}
                            className="h-full w-full object-cover"
                            decoding="async"
                            loading="lazy"
                            {...({ fetchpriority: "low" } as Record<string, string>)}
                          />
                        </div>
                        {(block.caption ?? imageAsset.caption) && (
                          <p
                            className="mt-3 px-1"
                            style={{
                              fontSize: 13,
                              color: colors.textMuted,
                              fontFamily: "'Inter', sans-serif",
                              letterSpacing: "-0.005em",
                            }}
                          >
                            {block.caption ?? imageAsset.caption}
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

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
                      onClick={(e) => {
                        e.stopPropagation();
                        goPrev();
                      }}
                      className="flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 transition-all hover:opacity-70 active:scale-95"
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: colors.textSecondary,
                        border: `1px solid ${borderColor}`,
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
                      onClick={(e) => {
                        e.stopPropagation();
                        goNext();
                      }}
                      className="flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 transition-all hover:opacity-70 active:scale-95"
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: colors.textSecondary,
                        border: `1px solid ${borderColor}`,
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
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface HorizontalGalleryProps {
  images: { url: string; caption?: string }[];
  theme: "light" | "dark";
  bg: string;
  btnBg: string;
  textColor: string;
  captionColor: string;
}

const HorizontalGallery = forwardRef<HorizontalGalleryHandle, HorizontalGalleryProps>(function HorizontalGallery({
  images,
  theme,
  bg,
  btnBg,
  textColor,
  captionColor,
}, ref) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(images.length > 1);
  const [isPointerDragging, setIsPointerDragging] = useState(false);
  const hasMultipleImages = images.length > 1;

  const scrollToIndex = useCallback((targetIndex: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollerRef.current;
    const slide = slideRefs.current[targetIndex];
    if (!el || !slide) return;

    const left = Math.max(0, slide.offsetLeft - (el.clientWidth - slide.clientWidth) / 2);
    el.scrollTo({ left, behavior });
  }, []);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (!hasMultipleImages) {
      setActiveIndex(0);
      setCanPrev(false);
      setCanNext(false);
      return;
    }

    const viewportCenter = el.scrollLeft + el.clientWidth / 2;
    let nextIndex = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    slideRefs.current.forEach((slide, index) => {
      if (!slide) return;
      const slideCenter = slide.offsetLeft + slide.clientWidth / 2;
      const distance = Math.abs(slideCenter - viewportCenter);
      if (distance < minDistance) {
        minDistance = distance;
        nextIndex = index;
      }
    });

    setActiveIndex(nextIndex);
    setCanPrev(nextIndex > 0);
    setCanNext(nextIndex < images.length - 1);
  }, [hasMultipleImages, images.length]);

  const step = useCallback((dir: 1 | -1) => {
    if (!hasMultipleImages) return;
    const targetIndex = Math.max(0, Math.min(images.length - 1, activeIndex + dir));
    scrollToIndex(targetIndex);
  }, [activeIndex, hasMultipleImages, images.length, scrollToIndex]);

  useImperativeHandle(ref, () => ({ step }), [step]);

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
  }, [updateEdges]);

  useEffect(() => {
    setActiveIndex(0);
    setCanPrev(false);
    setCanNext(images.length > 1);
    requestAnimationFrame(() => updateEdges());
  }, [images, updateEdges]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasMultipleImages || e.pointerType === "touch") return;
    const el = scrollerRef.current;
    if (!el) return;

    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };
    setIsPointerDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    const dragState = dragStateRef.current;
    if (!el || !dragState.active) return;

    const deltaX = e.clientX - dragState.startX;
    el.scrollLeft = dragState.startScrollLeft - deltaX;
  };

  const endPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;

    dragStateRef.current = {
      active: false,
      pointerId: -1,
      startX: 0,
      startScrollLeft: 0,
    };
    setIsPointerDragging(false);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const arrowBorder = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const sidePadding = "max(24px, calc((100vw - 1100px) / 2))";
  const slideWidth = hasMultipleImages
    ? "min(900px, 74vw)"
    : "min(980px, calc(100vw - 48px))";

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className={`hide-scrollbar flex gap-6 ${hasMultipleImages ? "snap-x snap-mandatory overflow-x-auto" : "justify-center overflow-hidden"}`}
        style={{
          scrollPaddingInline: hasMultipleImages ? sidePadding : undefined,
          paddingInline: sidePadding,
          paddingBlock: 8,
          cursor: hasMultipleImages ? (isPointerDragging ? "grabbing" : "grab") : "default",
          overscrollBehaviorX: "contain",
          userSelect: isPointerDragging ? "none" : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
      >
        {images.map((image, index) => (
          <div
            key={image.url + index}
            ref={(el) => {
              slideRefs.current[index] = el;
            }}
            className={`${hasMultipleImages ? "snap-center" : ""} shrink-0`}
            style={{
              width: slideWidth,
              maxWidth: "100%",
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
                src={image.url}
                alt={image.caption ?? `Project image ${index + 1}`}
                className="h-full w-full object-cover"
                decoding="async"
                loading={index === 0 ? "eager" : "lazy"}
                {...({ fetchpriority: index === 0 ? "high" : "low" } as Record<string, string>)}
                style={{ display: "block" }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 px-1">
              <span
                className="truncate"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: captionColor,
                  letterSpacing: "-0.005em",
                }}
              >
                {image.caption ?? ""}
              </span>
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
                {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
              </span>
            </div>
          </div>
        ))}
      </div>

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
              backgroundColor: btnBg,
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
              backgroundColor: btnBg,
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
});
