import { useRef, useEffect, useCallback, useMemo } from "react";
import { gsap } from "gsap";
import { useTheme } from "./ThemeContext";
import type { Project } from "./types";

interface BootSequenceProps {
  projects: Project[];
  onComplete: () => void;
}

// Must match InfiniteCanvas constants exactly
const DEFAULT_ZOOM = 0.60;
const CAMERA_X = -60;
const CAMERA_Y = -40;
const TOOLBAR_HEIGHT = 70;
const TITLE_BAR_HEIGHT = 48; // approx height of the title bar below image

/**
 * Boot Sequence — "Card Stack → Scatter to exact canvas positions"
 *
 * Phase 1: Cards rapid-fire stack at center
 * Phase 2: Brief hold with logo + progress
 * Phase 3: Cards scatter to their EXACT canvas positions (matching autoLayout + camera + zoom)
 *          so when overlay fades, it's pixel-identical to the real canvas underneath
 * Phase 4: Overlay fades out — seamless, zero-jitter handoff
 */
export function BootSequence({ projects, onComplete }: BootSequenceProps) {
  const { theme, colors } = useTheme();
  const overlayRef = useRef<HTMLDivElement>(null);
  const stackCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scatterCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const logoRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Stack phase: 12 cards for the rapid stacking
  const stackCards = useMemo(() => {
    const shuffled = [...projects].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(12, projects.length));
  }, [projects]);

  const STACK_W = 200;
  const STACK_H = 140;

  const setStackRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    stackCardRefs.current[idx] = el;
  }, []);

  const setScatterRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    scatterCardRefs.current[idx] = el;
  }, []);

  // Compute the EXACT screen positions each card will have on the real canvas.
  // This replicates InfiniteCanvas's transform: scale(zoom) translate3d(-camX, -camY, 0)
  // plus the toolbar offset.
  const scatterPositions = useMemo(() => {
    const z = DEFAULT_ZOOM;
    const offsetX = -CAMERA_X; // 60
    const offsetY = -CAMERA_Y; // 40

    return projects.map((p) => {
      // Canvas-space → screen-space:
      // screenX = (projectX + cameraOffset) * zoom
      // screenY = (projectY + cameraOffset) * zoom + toolbarHeight
      const sx = (p.x + offsetX) * z;
      const sy = (p.y + offsetY) * z + TOOLBAR_HEIGHT;
      const sw = p.width * z;
      const sh = p.height * z;
      const titleH = TITLE_BAR_HEIGHT * z;

      return { x: sx, y: sy, w: sw, h: sh, titleH };
    });
  }, [projects]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const logo = logoRef.current;
    const status = statusRef.current;
    const progressBar = progressBarRef.current;
    if (!overlay || !logo || !status || !progressBar) return;

    const stackEls = stackCardRefs.current.filter(Boolean) as HTMLDivElement[];
    const scatterEls = scatterCardRefs.current.filter(Boolean) as HTMLDivElement[];
    if (stackEls.length === 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;

    // ── Initial state: stack cards at center, invisible ──
    stackEls.forEach((card) => {
      gsap.set(card, {
        x: cx - STACK_W / 2,
        y: cy - STACK_H / 2 - 10,
        opacity: 0,
        scale: 0.6,
        rotation: 0,
        transformOrigin: "center center",
      });
    });

    // ── Initial state: scatter cards at center, invisible ──
    scatterEls.forEach((card) => {
      gsap.set(card, {
        opacity: 0,
        scale: 0.4,
        x: cx - 50,
        y: cy - 35,
        rotation: 0,
      });
    });

    gsap.set(logo, { opacity: 0, y: -8 });
    gsap.set(status, { opacity: 0 });

    const tl = gsap.timeline({
      onComplete: () => onComplete(),
    });

    // ── Phase 0: Logo ──
    tl.to(logo, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, 0);

    // ── Phase 1: Rapid card stacking ──
    const STACK_INTERVAL = 0.06;
    stackEls.forEach((card, i) => {
      const rot = (Math.random() - 0.5) * 14;
      const ox = (Math.random() - 0.5) * 10;
      const oy = (Math.random() - 0.5) * 8;

      tl.to(
        card,
        {
          opacity: 1,
          scale: 1,
          rotation: rot,
          x: cx - STACK_W / 2 + ox,
          y: cy - STACK_H / 2 - 10 + oy,
          duration: 0.1,
          ease: "back.out(1.4)",
        },
        0.2 + i * STACK_INTERVAL
      );
    });

    // Progress bar fills
    const stackEnd = 0.2 + stackEls.length * STACK_INTERVAL;
    tl.to(progressBar, { scaleX: 1, duration: stackEnd, ease: "power1.inOut" }, 0);

    // ── Phase 2: Brief hold ──
    const holdStart = stackEnd + 0.1;
    tl.to(status, { opacity: 1, duration: 0.2, ease: "power2.out" }, holdStart);

    // ── Phase 3: Scatter to exact canvas positions ──
    const scatterStart = holdStart + 0.3;

    // Fade out stack cards + UI
    tl.to(status, { opacity: 0, duration: 0.15 }, scatterStart);
    tl.to(logo, { opacity: 0, y: -6, duration: 0.15 }, scatterStart);
    tl.to(progressBar.parentElement!, { opacity: 0, duration: 0.12 }, scatterStart);

    stackEls.forEach((card) => {
      tl.to(card, { opacity: 0, scale: 0.7, duration: 0.15 }, scatterStart);
    });

    // Fly scatter cards from center to their exact canvas positions
    const SCATTER_STAGGER = 0.012;
    scatterEls.forEach((card, i) => {
      const pos = scatterPositions[i];
      if (!pos) return;

      const delay = scatterStart + 0.1 + i * SCATTER_STAGGER;

      tl.fromTo(
        card,
        {
          x: cx - pos.w / 2,
          y: cy - (pos.h + pos.titleH) / 2,
          opacity: 0,
          scale: 0.35,
          rotation: (Math.random() - 0.5) * 25,
        },
        {
          x: pos.x,
          y: pos.y,
          opacity: 1,
          scale: 1,
          rotation: 0,
          duration: 0.7,
          ease: "power3.out",
        },
        delay
      );
    });

    // ── Phase 4: Fade overlay — seamless handoff ──
    const lastScatterDelay = scatterStart + 0.1 + scatterEls.length * SCATTER_STAGGER;
    const fadeStart = lastScatterDelay + 0.25;
    tl.to(
      overlay,
      {
        opacity: 0,
        duration: 0.5,
        ease: "power2.inOut",
      },
      fadeStart
    );

    return () => {
      tl.kill();
    };
  }, [projects, scatterPositions, onComplete, STACK_W, STACK_H]);

  // Theme colors
  const bgColor = theme === "light" ? "#F5F3EF" : "#161616";
  const cardBg = theme === "light" ? "#FEFEFE" : "#1E1E1E";
  const cardBorder = theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)";
  const textColor = theme === "light" ? "#171717" : "#ECECEC";
  const mutedColor = theme === "light" ? "#999" : "#555";
  const progressBg = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const progressFill = theme === "light" ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)";
  const dotColor = theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)";
  const cardShadow = theme === "light"
    ? "0 1px 2px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.04)"
    : "0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* Dot texture — same as BackgroundRippleEffect feel */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(${dotColor} 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* ── Logo ── */}
      <div
        ref={logoRef}
        className="absolute left-0 right-0 top-0 z-30 flex items-center justify-center"
        style={{ paddingTop: 32 }}
      >
        <span
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 22,
            color: textColor,
            letterSpacing: "-0.02em",
          }}
        >
          Studio
        </span>
      </div>

      {/* ── Stack cards (Phase 1) ── */}
      {stackCards.map((project, idx) => (
        <div
          key={`stack-${project.id}-${idx}`}
          ref={(el) => setStackRef(el, idx)}
          className="absolute overflow-hidden"
          style={{
            width: STACK_W,
            height: STACK_H,
            borderRadius: 10,
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: cardShadow,
            willChange: "transform, opacity",
            zIndex: 10 + idx,
          }}
        >
          <img
            src={project.imageUrl}
            alt=""
            loading="eager"
            className="h-full w-full object-cover"
            style={{ pointerEvents: "none" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 px-2.5 py-1.5"
            style={{
              background: theme === "light"
                ? "linear-gradient(transparent, rgba(255,255,255,0.92))"
                : "linear-gradient(transparent, rgba(0,0,0,0.8))",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: textColor,
                letterSpacing: "-0.01em",
              }}
            >
              {project.title}
            </span>
          </div>
        </div>
      ))}

      {/* ── Scatter cards (Phase 3) — exact canvas replicas ── */}
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
            {/* Image area — exact scaled height */}
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
            {/* Title bar — replica of PortfolioCard */}
            <div
              className="flex items-center justify-between gap-1 overflow-hidden"
              style={{
                backgroundColor: cardBg,
                padding: `${6 * DEFAULT_ZOOM}px ${8 * DEFAULT_ZOOM}px`,
                height: pos.titleH,
              }}
            >
              <div className="flex items-center gap-1 overflow-hidden">
                <span
                  style={{
                    fontSize: 10 * DEFAULT_ZOOM,
                    color: colors.textMuted,
                    fontFamily: "'Geist Mono', monospace",
                    letterSpacing: "0.02em",
                    opacity: 0.6,
                    flexShrink: 0,
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span
                  className="truncate"
                  style={{
                    fontSize: 14 * DEFAULT_ZOOM,
                    color: colors.text,
                    fontWeight: 450,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {project.title}
                </span>
              </div>
              {project.category && (
                <span
                  className="shrink-0"
                  style={{
                    fontSize: 10 * DEFAULT_ZOOM,
                    color: colors.textMuted,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase" as const,
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {project.category}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Center status (no counter) ── */}
      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
        <div ref={statusRef}>
          <span
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              color: mutedColor,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
            }}
          >
            Loading works
          </span>
        </div>
        <div
          className="mt-3"
          style={{
            width: 100,
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
    </div>
  );
}
