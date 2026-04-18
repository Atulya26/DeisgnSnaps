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
const TOOLBAR_HEIGHT = 64;
const TITLE_BAR_HEIGHT = 56;

// Stack replica dimensions (used in Phase 1 pile-up)
const STACK_W = 220;
const STACK_H = 150;

/**
 * Boot Sequence — "Big wordmark + card stack → scatter"
 *
 * Two moments, one frame:
 *   • Upper third: huge "Atulya" wordmark + tagline (identity).
 *   • Lower third: rapid pile-up of ~12 project cards (the work).
 * Both co-exist during the hold beat — the viewer sees WHO + WHAT before
 * the cards scatter out to their final canvas positions and the wordmark
 * fades up and away. Pixel-perfect handoff preserved.
 */
export function BootSequence({ projects, onComplete }: BootSequenceProps) {
  const { theme, colors } = useTheme();
  const overlayRef = useRef<HTMLDivElement>(null);
  const stackCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scatterCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scatterGroupRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);

  const setStackRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    stackCardRefs.current[idx] = el;
  }, []);
  const setScatterRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    scatterCardRefs.current[idx] = el;
  }, []);

  // Stack phase uses a shuffled slice of up to 12 projects
  const stackCards = useMemo(() => {
    const shuffled = [...projects].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(12, projects.length));
  }, [projects]);

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
    if (!overlay || !wordmark || !tagline) return;

    const stackEls = stackCardRefs.current.filter(Boolean) as HTMLDivElement[];
    const scatterEls = scatterCardRefs.current.filter(Boolean) as HTMLDivElement[];

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;

    // Stack pile anchored in the lower third, well clear of the wordmark block.
    const stackCenterY = vh * 0.7;

    // ── Initial states ─────────────────────────────────────────────
    gsap.set(wordmark, { opacity: 0, y: 36, scale: 1.02, filter: "blur(6px)" });
    gsap.set(tagline, { opacity: 0, y: 14 });

    stackEls.forEach((card) => {
      gsap.set(card, {
        x: cx - STACK_W / 2,
        y: stackCenterY - STACK_H / 2,
        opacity: 0,
        scale: 0.6,
        rotation: 0,
        transformOrigin: "center center",
      });
    });

    scatterEls.forEach((card) => {
      gsap.set(card, {
        opacity: 0,
        scale: 0.4,
        x: cx - 50,
        y: stackCenterY - 35, // fly out from where the stack sat
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

    // Phase 1: HERO wordmark reveals (blur → focus)
    tl.to(
      wordmark,
      { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.85, ease: "power3.out" },
      0.15
    );
    tl.to(
      tagline,
      { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" },
      0.5
    );

    // Phase 2: Card stack rapid-fire pile-up (runs in parallel with wordmark
    // reveal — so the viewer sees identity + work building at once).
    const STACK_INTERVAL = 0.055;
    const stackPhaseStart = 0.35;
    stackEls.forEach((card, i) => {
      const rot = (Math.random() - 0.5) * 16;
      const ox = (Math.random() - 0.5) * 12;
      const oy = (Math.random() - 0.5) * 10;
      tl.to(
        card,
        {
          opacity: 1,
          scale: 1,
          rotation: rot,
          x: cx - STACK_W / 2 + ox,
          y: stackCenterY - STACK_H / 2 + oy,
          duration: 0.1,
          ease: "back.out(1.4)",
        },
        stackPhaseStart + i * STACK_INTERVAL
      );
    });

    // Phase 3: Hold — both wordmark and stack sit together for a beat.
    const holdEnd = Math.max(1.25, stackPhaseStart + stackEls.length * STACK_INTERVAL + 0.45);

    // Phase 4: Stack scatters to canvas positions; wordmark fades up.
    const scatterStart = holdEnd;
    tl.to(wordmark, { opacity: 0, y: -28, scale: 0.92, duration: 0.5, ease: "power2.in" }, scatterStart);
    tl.to(tagline, { opacity: 0, y: -12, duration: 0.35, ease: "power2.in" }, scatterStart);

    // Fade the stack cards out so they don't overlap the scatter replicas.
    stackEls.forEach((card) => {
      tl.to(card, { opacity: 0, scale: 0.75, duration: 0.2, ease: "power2.in" }, scatterStart);
    });

    const SCATTER_STAGGER = 0.012;
    scatterEls.forEach((card, i) => {
      const pos = scatterPositions[i];
      if (!pos) return;
      const delay = scatterStart + 0.1 + i * SCATTER_STAGGER;

      tl.fromTo(
        card,
        {
          x: stackCenterY ? cx - pos.w / 2 : cx - pos.w / 2, // fly from stack origin
          y: stackCenterY - (pos.h + pos.titleH) / 2,
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

    // Phase 5: Scatter-group pullback + overlay fade.
    const lastScatterDelay = scatterStart + 0.1 + scatterEls.length * SCATTER_STAGGER;
    const settleStart = lastScatterDelay + 0.15;
    const fadeStart = settleStart + 0.55;
    if (scatterGroupRef.current) {
      tl.to(scatterGroupRef.current, { scale: 1.0, duration: 0.9, ease: "power2.out" }, settleStart);
    }
    tl.to(overlay, { opacity: 0, duration: 0.5, ease: "power2.inOut" }, fadeStart);

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
  const cardShadow = theme === "light"
    ? "0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.05)"
    : "0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* ── HERO: huge "Atulya" wordmark anchored to the upper third ── */}
      <div
        className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center px-6"
        style={{ top: "22vh" }}
      >
        <div
          ref={wordmarkRef}
          style={{ willChange: "transform, opacity, filter" }}
        >
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "clamp(84px, 15vw, 200px)",
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

        <div ref={taglineRef} className="mt-5 text-center">
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

      {/* ── Stack replicas (Phase 2) — piled at lower-third ── */}
      {stackCards.map((project, idx) => (
        <div
          key={`stack-${project.id}-${idx}`}
          ref={(el) => setStackRef(el, idx)}
          className="absolute overflow-hidden"
          style={{
            width: STACK_W,
            height: STACK_H,
            borderRadius: 12,
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: cardShadow,
            willChange: "transform, opacity",
            zIndex: 25 + idx,
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
            className="absolute inset-x-0 bottom-0 px-3 py-2"
            style={{
              background: theme === "light"
                ? "linear-gradient(transparent, rgba(255,255,255,0.94))"
                : "linear-gradient(transparent, rgba(0,0,0,0.82))",
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: textColor,
                letterSpacing: "-0.01em",
              }}
            >
              {project.title}
            </span>
          </div>
        </div>
      ))}

      {/* ── Scatter replicas (Phase 4) — pixel-perfect canvas stand-ins.
             Wrapped in a group so Phase 5 can pull back 1.08 → 1.0. ── */}
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
