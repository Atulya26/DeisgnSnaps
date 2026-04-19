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
const STACK_W = 264;
const STACK_TITLE_H = 36;
const STACK_IMAGE_H = 176;
const STACK_H = STACK_IMAGE_H + STACK_TITLE_H;
const STACK_CARD_COUNT = 8;

function hexToRgba(hex: string, alpha: number) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Boot Sequence — centered stack + ambient shader field → scatter
 *
 * The stack stays as the hero, dead-center. "Atulya" sits behind it as part
 * of the composition, with soft shader-like light and shadow around the
 * center so the loader feels atmospheric without changing the home cards.
 */
export function BootSequence({ projects, onComplete }: BootSequenceProps) {
  const { theme, colors, animationConfig, dotGridConfig } = useTheme();
  const overlayRef = useRef<HTMLDivElement>(null);
  const stackCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scatterCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scatterGroupRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const ambientPrimaryRef = useRef<HTMLDivElement>(null);
  const ambientSecondaryRef = useRef<HTMLDivElement>(null);
  const centerGlowRef = useRef<HTMLDivElement>(null);
  const stackShadowRef = useRef<HTMLDivElement>(null);

  const setStackRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    stackCardRefs.current[idx] = el;
  }, []);
  const setScatterRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    scatterCardRefs.current[idx] = el;
  }, []);

  // Stack phase uses a smaller shuffled slice so the loader stays light.
  const stackCards = useMemo(() => {
    const shuffled = [...projects].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(STACK_CARD_COUNT, projects.length));
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
    const ambientPrimary = ambientPrimaryRef.current;
    const ambientSecondary = ambientSecondaryRef.current;
    const centerGlow = centerGlowRef.current;
    const stackShadow = stackShadowRef.current;
    if (!overlay || !wordmark || !ambientPrimary || !ambientSecondary || !centerGlow || !stackShadow) {
      return;
    }

    const stackEls = stackCardRefs.current.filter(Boolean) as HTMLDivElement[];
    const scatterEls = scatterCardRefs.current.filter(Boolean) as HTMLDivElement[];

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;

    const stackCenterY = cy;

    // ── Initial states ─────────────────────────────────────────────
    gsap.set(wordmark, { opacity: 0, y: 18, scale: 0.94, filter: "blur(10px)" });
    gsap.set(ambientPrimary, { opacity: 0, scale: 1.16, x: -72, y: -40 });
    gsap.set(ambientSecondary, { opacity: 0, scale: 1.08, x: 62, y: 36 });
    gsap.set(centerGlow, { opacity: 0, scale: 0.78 });
    gsap.set(stackShadow, { opacity: 0, scale: 0.82 });

    stackEls.forEach((card) => {
      gsap.set(card, {
        x: cx - STACK_W / 2,
        y: stackCenterY - STACK_H / 2,
        opacity: 0,
        scale: 0.68,
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

    // Phase 1: ambient shader field and centered identity reveal.
    tl.to(
      ambientPrimary,
      {
        opacity: theme === "light" ? 0.95 : 0.78,
        scale: 1,
        x: 0,
        y: 0,
        duration: 0.95,
        ease: "power2.out",
      },
      0
    );
    tl.to(
      ambientSecondary,
      {
        opacity: theme === "light" ? 0.72 : 0.6,
        scale: 1,
        x: 0,
        y: 0,
        duration: 1.1,
        ease: "power2.out",
      },
      0.04
    );
    tl.to(
      centerGlow,
      { opacity: 1, scale: 1, duration: 0.85, ease: "power2.out" },
      0.08
    );
    tl.to(
      stackShadow,
      { opacity: 1, scale: 1, duration: 0.65, ease: "power2.out" },
      0.18
    );
    tl.to(
      wordmark,
      {
        opacity: theme === "light" ? 0.24 : 0.34,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.9,
        ease: "power3.out",
      },
      0.16
    );

    // Phase 2: centered card stack rapid-fire pile-up.
    const STACK_INTERVAL = 0.055;
    const stackPhaseStart = 0.24;
    stackEls.forEach((card, i) => {
      const rot = (Math.random() - 0.5) * 18;
      const ox = (Math.random() - 0.5) * 16;
      const oy = (Math.random() - 0.5) * 12;
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

    tl.to(
      ambientPrimary,
      { x: 34, y: -16, duration: 1.1, ease: "sine.inOut" },
      stackPhaseStart + 0.2
    );
    tl.to(
      ambientSecondary,
      { x: -28, y: 18, duration: 1.1, ease: "sine.inOut" },
      stackPhaseStart + 0.28
    );

    // Phase 3: centered hold.
    const holdEnd = Math.max(1.18, stackPhaseStart + stackEls.length * STACK_INTERVAL + 0.52);

    // Phase 4: stack scatters to canvas positions; identity and shades dissolve.
    const scatterStart = holdEnd;
    tl.to(
      wordmark,
      { opacity: 0, y: -8, scale: 1.03, filter: "blur(12px)", duration: 0.45, ease: "power2.in" },
      scatterStart
    );
    tl.to(
      centerGlow,
      { opacity: 0, scale: 1.16, duration: 0.5, ease: "power2.inOut" },
      scatterStart
    );
    tl.to(
      stackShadow,
      { opacity: 0, scale: 1.08, duration: 0.35, ease: "power2.in" },
      scatterStart
    );
    tl.to(
      [ambientPrimary, ambientSecondary],
      { opacity: 0, scale: 1.14, duration: 0.55, ease: "power2.inOut" },
      scatterStart + 0.03
    );

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
  }, [onComplete, projects, scatterPositions, theme]);

  // Theme-synced colors
  const bgColor = theme === "light" ? "#FFFFFF" : "#0E0E0E";
  const accentColor =
    theme === "light" ? dotGridConfig.lightActiveColor : dotGridConfig.darkActiveColor;
  const cardBg = colors.cardBg;
  const cardBorder = theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)";
  const textColor = colors.text;
  const mutedColor = colors.textMuted;
  const cardShadow = colors.cardShadow;
  const ambientPrimaryGradient = `radial-gradient(circle at 50% 50%, ${hexToRgba(accentColor, theme === "light" ? 0.2 : 0.28)} 0%, ${hexToRgba(accentColor, theme === "light" ? 0.08 : 0.14)} 42%, transparent 72%)`;
  const ambientSecondaryGradient =
    theme === "light"
      ? "radial-gradient(circle at 50% 50%, rgba(255, 219, 196, 0.58) 0%, rgba(255, 238, 228, 0.3) 38%, transparent 72%)"
      : "radial-gradient(circle at 50% 50%, rgba(149, 157, 255, 0.16) 0%, rgba(64, 72, 132, 0.1) 40%, transparent 72%)";
  const centerGlowGradient =
    theme === "light"
      ? `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.98) 0%, ${hexToRgba(accentColor, 0.08)} 34%, transparent 72%)`
      : `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, ${hexToRgba(accentColor, 0.12)} 34%, transparent 72%)`;
  const shadowGradient =
    theme === "light"
      ? "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 46%, transparent 78%)"
      : "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.16) 48%, transparent 82%)";
  const wordmarkGradient = `linear-gradient(90deg, ${hexToRgba(textColor, 0.9)} 0%, ${hexToRgba(accentColor, theme === "light" ? 0.95 : 0.88)} 50%, ${hexToRgba(textColor, 0.9)} 100%)`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            theme === "light"
              ? "radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(251,251,252,1) 66%, rgba(244,244,246,1) 100%)"
              : "radial-gradient(circle at 50% 50%, rgba(25,25,28,1) 0%, rgba(16,16,18,1) 62%, rgba(10,10,12,1) 100%)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
        <div
          ref={ambientPrimaryRef}
          className="absolute"
          style={{
            width: "min(72vw, 920px)",
            height: "min(60vw, 760px)",
            borderRadius: "999px",
            background: ambientPrimaryGradient,
            filter: `blur(${theme === "light" ? 22 : 34}px)`,
            mixBlendMode: theme === "light" ? "multiply" : "screen",
          }}
        />
        <div
          ref={ambientSecondaryRef}
          className="absolute"
          style={{
            width: "min(58vw, 760px)",
            height: "min(44vw, 540px)",
            borderRadius: "999px",
            background: ambientSecondaryGradient,
            filter: `blur(${theme === "light" ? 28 : 36}px)`,
            mixBlendMode: theme === "light" ? "multiply" : "screen",
          }}
        />
        <div
          ref={centerGlowRef}
          className="absolute"
          style={{
            width: "min(42vw, 520px)",
            height: "min(42vw, 520px)",
            borderRadius: "999px",
            background: centerGlowGradient,
            filter: `blur(${theme === "light" ? 12 : 22}px)`,
          }}
        />
        <div
          ref={wordmarkRef}
          style={{
            willChange: "transform, opacity, filter",
            paddingBottom: "0.16em",
            WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 14%, black 86%, transparent 100%)",
            maskImage: "linear-gradient(90deg, transparent 0%, black 14%, black 86%, transparent 100%)",
          }}
        >
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "clamp(144px, 22vw, 304px)",
              fontWeight: 780,
              letterSpacing: "-0.07em",
              lineHeight: 1.02,
              display: "block",
              whiteSpace: "nowrap",
              backgroundImage: wordmarkGradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Atulya
          </span>
        </div>
        <div
          ref={stackShadowRef}
          className="absolute"
          style={{
            width: "min(34vw, 430px)",
            height: "min(8vw, 96px)",
            marginTop: STACK_H * 0.78,
            borderRadius: "999px",
            background: shadowGradient,
            filter: "blur(16px)",
          }}
        />
      </div>

      {/* Centered stack composition */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background:
            theme === "light"
              ? "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0) 100%)"
              : "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* ── Stack replicas (Phase 2) — centered hero pile ── */}
      {stackCards.map((project, idx) => (
        <div
          key={`stack-${project.id}-${idx}`}
          ref={(el) => setStackRef(el, idx)}
          className="absolute overflow-hidden"
          style={{
            width: STACK_W,
            height: STACK_H,
            borderRadius: animationConfig.cardBorderRadius,
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: cardShadow,
            willChange: "transform, opacity",
            zIndex: 25 + idx,
          }}
        >
          <div
            style={{
              height: STACK_IMAGE_H,
              overflow: "hidden",
              backgroundColor: colors.imageBg,
            }}
          >
            <img
              src={project.cardImageUrl}
              alt=""
              loading={idx < 4 ? "eager" : "lazy"}
              decoding="async"
              {...({ fetchpriority: idx < 4 ? "high" : "low" } as Record<string, string>)}
              className="h-full w-full object-cover"
              style={{ pointerEvents: "none" }}
            />
          </div>
          <div
            className="flex items-center justify-between gap-3 px-4"
            style={{
              backgroundColor: cardBg,
              height: STACK_TITLE_H,
              paddingTop: 10,
              paddingBottom: 10,
            }}
          >
            <span
              className="truncate"
              style={{
                fontSize: 13,
                color: textColor,
                lineHeight: 1.15,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {project.title}
            </span>
            {project.category && (
              <span
                className="shrink-0"
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: mutedColor,
                  letterSpacing: "-0.005em",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {project.category}
              </span>
            )}
          </div>
        </div>
      ))}

      {/* ── Scatter replicas (Phase 4) — pixel-perfect canvas stand-ins.
             Wrapped in a group so Phase 5 can pull back 1.08 → 1.0. ── */}
      <div
        ref={scatterGroupRef}
        className="absolute inset-0 z-[12]"
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
                  src={project.cardImageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  {...({ fetchpriority: "low" } as Record<string, string>)}
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
