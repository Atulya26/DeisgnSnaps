import { useRef, useEffect, useCallback, useMemo } from "react";
import { gsap } from "gsap";
import { useTheme } from "./ThemeContext";
import { computeInitialCamera } from "./autoLayout";
import type { Project } from "./types";

interface BootSequenceProps {
  projects: Project[];
  onComplete: () => void;
}

// Must match InfiniteCanvas constants exactly
const DEFAULT_ZOOM = 0.60;
const TOOLBAR_HEIGHT = 88;
const TITLE_BAR_HEIGHT = 56;

/**
 * Boot Sequence — "Big wordmark → scatter to canvas"
 *
 * Phase 0: Ambient fade-in (overlay covers canvas at full white).
 * Phase 1: HERO — massive "Atulya" wordmark at center, tagline underneath,
 *          corner meta. Feels like shopify.design's "Make the new normal"
 *          landing: one big statement, plenty of air.
 * Phase 2: Hold so the viewer reads the wordmark.
 * Phase 3: Wordmark scales down + fades up out of the way while the
 *          scatter replicas fly from the former text origin to their exact
 *          canvas positions.
 * Phase 4: Scatter-group pulls back 1.08 → 1.0 while overlay fades out.
 *          Pixel-perfect handoff to the live InfiniteCanvas underneath.
 */
export function BootSequence({ projects, onComplete }: BootSequenceProps) {
  const { theme, colors } = useTheme();
  const overlayRef = useRef<HTMLDivElement>(null);
  const scatterCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scatterGroupRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const cornerTopRef = useRef<HTMLDivElement>(null);
  const cornerBottomRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const setScatterRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    scatterCardRefs.current[idx] = el;
  }, []);

  // Scatter screen positions — shared with InfiniteCanvas's initial camera so
  // the handoff is pixel-identical regardless of viewport size.
  const scatterPositions = useMemo(() => {
    const z = DEFAULT_ZOOM;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const cam = computeInitialCamera(projects, { width: vw, height: vh }, z, TOOLBAR_HEIGHT);

    return projects.map((p) => {
      const sx = (p.x - cam.x) * z;
      const sy = (p.y - cam.y) * z;
      const sw = p.width * z;
      const sh = p.height * z;
      const titleH = TITLE_BAR_HEIGHT * z;
      return { x: sx, y: sy, w: sw, h: sh, titleH };
    });
  }, [projects]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const wordmark = wordmarkRef.current;
    const tagline = taglineRef.current;
    const cornerTop = cornerTopRef.current;
    const cornerBottom = cornerBottomRef.current;
    const progressBar = progressBarRef.current;
    if (!overlay || !wordmark || !tagline || !progressBar) return;

    const scatterEls = scatterCardRefs.current.filter(Boolean) as HTMLDivElement[];

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;

    // ── Initial: hero text below + faded, corners hidden, cards invisible ──
    gsap.set(wordmark, { opacity: 0, y: 36, scale: 1.02, filter: "blur(6px)" });
    gsap.set(tagline, { opacity: 0, y: 14 });
    if (cornerTop) gsap.set(cornerTop, { opacity: 0, y: -6 });
    if (cornerBottom) gsap.set(cornerBottom, { opacity: 0, y: 6 });

    scatterEls.forEach((card) => {
      gsap.set(card, {
        opacity: 0,
        scale: 0.4,
        x: cx - 50,
        y: cy - 35,
        rotation: 0,
      });
    });
    if (scatterGroupRef.current) {
      gsap.set(scatterGroupRef.current, {
        scale: 1.08,
        transformOrigin: "center center",
      });
    }

    const tl = gsap.timeline({ onComplete: () => onComplete() });

    // Phase 0: corners ease in
    if (cornerTop) tl.to(cornerTop, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0);
    if (cornerBottom) tl.to(cornerBottom, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.05);

    // Phase 1: HERO wordmark appears — the moment of identity
    tl.to(
      wordmark,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.9,
        ease: "power3.out",
      },
      0.15
    );
    tl.to(
      tagline,
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
      0.55
    );

    // Progress bar fills through the reveal + hold
    tl.to(progressBar, { scaleX: 1, duration: 1.6, ease: "power1.inOut" }, 0);

    // Phase 2: hold for the eye to read "Atulya"
    const holdUntil = 1.55;

    // Phase 3: hero recedes + scatter cards fly
    const scatterStart = holdUntil;
    tl.to(
      wordmark,
      {
        opacity: 0,
        y: -28,
        scale: 0.92,
        duration: 0.5,
        ease: "power2.in",
      },
      scatterStart
    );
    tl.to(
      tagline,
      { opacity: 0, y: -12, duration: 0.35, ease: "power2.in" },
      scatterStart
    );
    tl.to(progressBar.parentElement!, { opacity: 0, duration: 0.3 }, scatterStart);
    if (cornerTop) tl.to(cornerTop, { opacity: 0, duration: 0.3 }, scatterStart);
    if (cornerBottom) tl.to(cornerBottom, { opacity: 0, duration: 0.3 }, scatterStart);

    const SCATTER_STAGGER = 0.012;
    scatterEls.forEach((card, i) => {
      const pos = scatterPositions[i];
      if (!pos) return;

      // Fly from the approximate hero text origin so the transition reads as
      // "cards emerge from under the wordmark".
      const delay = scatterStart + 0.15 + i * SCATTER_STAGGER;

      tl.fromTo(
        card,
        {
          x: cx - pos.w / 2,
          y: cy - (pos.h + pos.titleH) / 2,
          opacity: 0,
          scale: 0.35,
          rotation: (Math.random() - 0.5) * 22,
        },
        {
          x: pos.x,
          y: pos.y,
          opacity: 1,
          scale: 1,
          rotation: 0,
          duration: 0.75,
          ease: "power3.out",
        },
        delay
      );
    });

    // Phase 4: pullback + overlay fade
    const lastScatterDelay = scatterStart + 0.15 + scatterEls.length * SCATTER_STAGGER;
    const settleStart = lastScatterDelay + 0.15;
    const fadeStart = settleStart + 0.55;
    if (scatterGroupRef.current) {
      tl.to(
        scatterGroupRef.current,
        { scale: 1.0, duration: 0.9, ease: "power2.out" },
        settleStart
      );
    }
    tl.to(
      overlay,
      { opacity: 0, duration: 0.5, ease: "power2.inOut" },
      fadeStart
    );

    return () => {
      tl.kill();
    };
  }, [projects, scatterPositions, onComplete]);

  // Theme-synced colors
  const bgColor = theme === "light" ? "#FFFFFF" : "#0E0E0E";
  const cardBg = theme === "light" ? "#FFFFFF" : "#1E1E1E";
  const cardBorder = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textColor = theme === "light" ? "#0A0A0A" : "#F1F1F1";
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)";
  const progressBg = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const progressFill = theme === "light" ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.18)";
  const liveDot = theme === "light" ? "#1a51f4" : "#6e8eff";
  const cardShadow = theme === "light"
    ? "0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.05)"
    : "0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* ── Top-left corner: tiny wordmark (echo of the real toolbar) ── */}
      <div
        ref={cornerTopRef}
        className="absolute left-0 top-0 z-30 flex items-center"
        style={{ paddingLeft: 40, paddingTop: 32 }}
      >
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: textColor,
            letterSpacing: "-0.01em",
          }}
        >
          atulya
        </span>
      </div>

      {/* ── Bottom-left corner: live status badge + progress ── */}
      <div
        ref={cornerBottomRef}
        className="absolute bottom-0 left-0 z-30 flex items-center gap-3"
        style={{ paddingLeft: 40, paddingBottom: 32 }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: liveDot,
            boxShadow: `0 0 12px ${liveDot}`,
          }}
        />
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: textColor,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Live
        </span>
        <span aria-hidden style={{ color: mutedColor }}>·</span>
        <div
          style={{
            width: 140,
            height: 2,
            borderRadius: 1,
            backgroundColor: progressBg,
            overflow: "hidden",
          }}
        >
          <div
            ref={progressBarRef}
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: progressFill,
              transformOrigin: "left",
              transform: "scaleX(0)",
            }}
          />
        </div>
      </div>

      {/* ── Bottom-right corner: "selected works" ── */}
      <div
        className="absolute bottom-0 right-0 z-30"
        style={{ paddingRight: 40, paddingBottom: 32 }}
      >
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: mutedColor,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Selected works — 2026
        </span>
      </div>

      {/* ── HERO: huge "Atulya" wordmark at center ── */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6">
        <div
          ref={wordmarkRef}
          style={{
            willChange: "transform, opacity, filter",
          }}
        >
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "clamp(84px, 16vw, 220px)",
              fontWeight: 800,
              color: textColor,
              letterSpacing: "-0.05em",
              lineHeight: 0.95,
              display: "block",
            }}
          >
            Atulya
          </span>
        </div>

        <div ref={taglineRef} className="mt-6 text-center">
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 17,
              fontWeight: 500,
              color: mutedColor,
              letterSpacing: "-0.005em",
            }}
          >
            Design portfolio — crafted pixel by pixel.
          </span>
        </div>
      </div>

      {/* ── Scatter replicas (Phase 3) — pixel-perfect canvas stand-ins.
             Wrapped in a group so Phase 4 can pull back 1.08 → 1.0. ── */}
      <div
        ref={scatterGroupRef}
        className="absolute inset-0"
        style={{ willChange: "transform" }}
      >
        {projects.map((project, idx) => {
          const pos = scatterPositions[idx];
          if (!pos) return null;
          return (
            <div
              key={`scatter-${project.id}`}
              ref={(el) => setScatterRef(el, idx)}
              className="absolute overflow-hidden"
              style={{
                width: pos.w,
                borderRadius: 14 * DEFAULT_ZOOM,
                backgroundColor: cardBg,
                border: `1px solid ${cardBorder}`,
                boxShadow: cardShadow,
                willChange: "transform, opacity",
                zIndex: 5,
              }}
            >
              <div
                style={{
                  height: pos.h,
                  overflow: "hidden",
                  backgroundColor: colors.imageBg,
                }}
              >
                <img
                  src={project.imageUrl}
                  alt=""
                  loading="eager"
                  className="h-full w-full object-cover"
                  style={{ pointerEvents: "none" }}
                />
              </div>
              <div
                className="flex items-center justify-between gap-2 overflow-hidden"
                style={{
                  backgroundColor: cardBg,
                  padding: `${18 * DEFAULT_ZOOM}px ${24 * DEFAULT_ZOOM}px`,
                  height: pos.titleH,
                }}
              >
                <span
                  className="truncate"
                  style={{
                    fontSize: 20 * DEFAULT_ZOOM,
                    color: colors.text,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    fontFamily: "'Inter', sans-serif",
                    lineHeight: 1.25,
                  }}
                >
                  {project.title}
                </span>
                {project.category && (
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 13 * DEFAULT_ZOOM,
                      color: colors.textMuted,
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {project.category}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
