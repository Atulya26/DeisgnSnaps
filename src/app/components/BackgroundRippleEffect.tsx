"use client";
import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { gsap } from "gsap";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { useTheme } from "./ThemeContext";

gsap.registerPlugin(InertiaPlugin);

/**
 * Infinite-canvas dot grid with proximity glow and physics push.
 *
 * Uses GSAP InertiaPlugin for natural throw-and-decelerate physics.
 * Dots fill the viewport and tile infinitely with the camera.
 * - Mouse proximity: dots near cursor change color (base → active gradient)
 * - Fast mouse movement: nearby dots get pushed via InertiaPlugin
 * - Click: shockwave pushes dots outward via InertiaPlugin
 * - All rendered on canvas, zero DOM overhead
 */

function hexToRgb(hex: string) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

interface PushedDot {
  xOffset: number;
  yOffset: number;
  _inertiaApplied: boolean;
}

export const BackgroundRippleEffect = React.memo(
  ({
    cellSize = 40,
    cameraRef,
    zoomRef,
  }: {
    cellSize?: number;
    cameraRef: React.MutableRefObject<{ x: number; y: number }>;
    zoomRef: React.MutableRefObject<number>;
  }) => {
    const { theme, colors, dotGridConfig } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const themeRef = useRef({ theme, colors });
    themeRef.current = { theme, colors };

    // Read config from context
    const {
      dotSize: DOT_SIZE,
      gap: GAP,
      proximity: PROXIMITY,
      speedTrigger: SPEED_TRIGGER,
      shockRadius: SHOCK_RADIUS,
      shockStrength: SHOCK_STRENGTH,
      maxSpeed: MAX_SPEED,
      resistance: RESISTANCE,
      returnDuration: RETURN_DURATION,
    } = dotGridConfig;

    // Dot grid spacing in world space
    const dotGap = DOT_SIZE + GAP;

    // Pointer state
    const pointerRef = useRef({
      x: -9999,
      y: -9999,
      vx: 0,
      vy: 0,
      speed: 0,
      lastTime: 0,
      lastX: 0,
      lastY: 0,
      inCanvas: false,
    });

    // Dots that have been pushed (sparse — only dots currently animating)
    const pushedDots = useRef(new Map<string, PushedDot>());

    // Pre-compute circle path (rebuild when dotSize changes)
    const circlePath = useMemo(() => {
      if (typeof window === "undefined") return null;
      const p = new Path2D();
      p.arc(0, 0, DOT_SIZE / 2, 0, Math.PI * 2);
      return p;
    }, [DOT_SIZE]);

    // Theme-derived colors from dotGridConfig
    const baseColorHex = useMemo(
      () => (theme === "dark" ? dotGridConfig.darkBaseColor : dotGridConfig.lightBaseColor),
      [theme, dotGridConfig.darkBaseColor, dotGridConfig.lightBaseColor]
    );
    const activeColorHex = useMemo(
      () => (theme === "dark" ? dotGridConfig.darkActiveColor : dotGridConfig.lightActiveColor),
      [theme, dotGridConfig.darkActiveColor, dotGridConfig.lightActiveColor]
    );
    const baseRgb = useMemo(() => hexToRgb(baseColorHex), [baseColorHex]);
    const activeRgb = useMemo(() => hexToRgb(activeColorHex), [activeColorHex]);

    // Refs so draw/handlers can read latest values without stale closures
    const colorsRefLocal = useRef({ baseRgb, activeRgb, baseColorHex });
    colorsRefLocal.current = { baseRgb, activeRgb, baseColorHex };

    const configRef = useRef({
      DOT_SIZE, GAP, PROXIMITY, SPEED_TRIGGER, SHOCK_RADIUS,
      SHOCK_STRENGTH, MAX_SPEED, RESISTANCE, RETURN_DURATION, dotGap,
    });
    configRef.current = {
      DOT_SIZE, GAP, PROXIMITY, SPEED_TRIGGER, SHOCK_RADIUS,
      SHOCK_STRENGTH, MAX_SPEED, RESISTANCE, RETURN_DURATION, dotGap,
    };

    // Animation
    const rafId = useRef(0);
    const running = useRef(false);
    // Track last-drawn camera state so we can skip redraws when nothing changed
    const lastDrawnCamera = useRef({ x: -9999, y: -9999, z: -1 });

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !circlePath) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cam = cameraRef.current;
      const z = zoomRef.current;
      const cfg = configRef.current;
      const scaledGap = cfg.dotGap * z;

      // Grid offset for infinite tiling
      const rawOffsetX = -cam.x * z;
      const rawOffsetY = -cam.y * z;
      const offsetX = ((rawOffsetX % scaledGap) + scaledGap) % scaledGap;
      const offsetY = ((rawOffsetY % scaledGap) + scaledGap) % scaledGap;

      const startCol = Math.floor(cam.x / cfg.dotGap);
      const startRow = Math.floor(cam.y / cfg.dotGap);

      const { baseRgb: bRgb, activeRgb: aRgb, baseColorHex: bHex } = colorsRefLocal.current;
      const ptr = pointerRef.current;
      const proxSq = cfg.PROXIMITY * cfg.PROXIMITY;
      const pushed = pushedDots.current;

      let colIdx = 0;
      for (let sx = offsetX; sx <= w + scaledGap; sx += scaledGap) {
        let rowIdx = 0;
        const worldCol = startCol + colIdx;

        for (let sy = offsetY; sy <= h + scaledGap; sy += scaledGap) {
          const worldRow = startRow + rowIdx;

          const restX = sx;
          const restY = sy;

          const key = `${worldCol},${worldRow}`;
          const pushData = pushed.get(key);
          const ox = pushData ? pushData.xOffset * z : 0;
          const oy = pushData ? pushData.yOffset * z : 0;

          const drawX = restX + ox;
          const drawY = restY + oy;

          const dx = restX - ptr.x;
          const dy = restY - ptr.y;
          const dsq = dx * dx + dy * dy;

          let fillStyle = bHex;
          if (ptr.inCanvas && dsq <= proxSq) {
            const dist = Math.sqrt(dsq);
            const t = 1 - dist / cfg.PROXIMITY;
            const r = Math.round(bRgb.r + (aRgb.r - bRgb.r) * t);
            const g = Math.round(bRgb.g + (aRgb.g - bRgb.g) * t);
            const b = Math.round(bRgb.b + (aRgb.b - bRgb.b) * t);
            fillStyle = `rgb(${r},${g},${b})`;
          }

          ctx.save();
          ctx.translate(drawX, drawY);
          if (z !== 1) ctx.scale(z, z);
          ctx.fillStyle = fillStyle;
          ctx.fill(circlePath);
          ctx.restore();

          rowIdx++;
        }
        colIdx++;
      }
    }, [cameraRef, zoomRef, circlePath]);

    // Main loop — only redraws when camera moved or pushed dots are animating
    const tick = useCallback(() => {
      // Skip entirely when tab is hidden — no CPU burn on backgrounded tabs.
      if (typeof document !== "undefined" && document.hidden) {
        rafId.current = requestAnimationFrame(tick);
        return;
      }

      const cam = cameraRef.current;
      const z = zoomRef.current;
      const last = lastDrawnCamera.current;
      const pushed = pushedDots.current;
      const hasPushed = pushed.size > 0;
      const ptr = pointerRef.current;

      // Skip draw if camera hasn't moved, no pushed dots, and pointer isn't near canvas
      const cameraMoved =
        Math.abs(cam.x - last.x) > 0.01 ||
        Math.abs(cam.y - last.y) > 0.01 ||
        Math.abs(z - last.z) > 0.0001;

      if (cameraMoved || hasPushed || ptr.inCanvas) {
        draw();
        last.x = cam.x;
        last.y = cam.y;
        last.z = z;
      }

      // Clean up finished push animations
      for (const [key, data] of pushed) {
        if (!data._inertiaApplied && Math.abs(data.xOffset) < 0.01 && Math.abs(data.yOffset) < 0.01) {
          pushed.delete(key);
        }
      }

      rafId.current = requestAnimationFrame(tick);
    }, [draw, cameraRef, zoomRef]);

    // Lifecycle
    useEffect(() => {
      if (!running.current) {
        running.current = true;
        draw();
        rafId.current = requestAnimationFrame(tick);
      }
      return () => {
        running.current = false;
        cancelAnimationFrame(rafId.current);
      };
    }, [tick, draw]);

    // Redraw once when returning to the tab so the grid is correct before the next real frame.
    useEffect(() => {
      const onVisible = () => {
        if (!document.hidden) draw();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }, [draw]);

    useEffect(() => {
      draw();
    }, [theme, draw]);

    useEffect(() => {
      const handleResize = () => draw();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [draw]);

    // ── Mouse tracking + InertiaPlugin physics push ──
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;

      const handleMove = (e: MouseEvent) => {
        const now = performance.now();
        const pr = pointerRef.current;
        const rect = canvas.getBoundingClientRect();
        const cfg = configRef.current;

        const dt = pr.lastTime ? now - pr.lastTime : 16;
        const dxScreen = e.clientX - pr.lastX;
        const dyScreen = e.clientY - pr.lastY;

        let vx = (dxScreen / dt) * 1000;
        let vy = (dyScreen / dt) * 1000;
        let speed = Math.hypot(vx, vy);
        if (speed > cfg.MAX_SPEED) {
          const scale = cfg.MAX_SPEED / speed;
          vx *= scale;
          vy *= scale;
          speed = cfg.MAX_SPEED;
        }

        pr.lastTime = now;
        pr.lastX = e.clientX;
        pr.lastY = e.clientY;
        pr.vx = vx;
        pr.vy = vy;
        pr.speed = speed;
        pr.x = e.clientX - rect.left;
        pr.y = e.clientY - rect.top;
        pr.inCanvas = true;

        // Push dots on fast movement using InertiaPlugin
        if (speed > cfg.SPEED_TRIGGER) {
          const cam = cameraRef.current;
          const z = zoomRef.current;
          const scaledGap = cfg.dotGap * z;

          const rawOffsetX = -cam.x * z;
          const rawOffsetY = -cam.y * z;
          const offsetX = ((rawOffsetX % scaledGap) + scaledGap) % scaledGap;
          const offsetY = ((rawOffsetY % scaledGap) + scaledGap) % scaledGap;
          const startCol = Math.floor(cam.x / cfg.dotGap);
          const startRow = Math.floor(cam.y / cfg.dotGap);

          const pushed = pushedDots.current;

          let colIdx = 0;
          for (let sx = offsetX; sx <= rect.width + scaledGap; sx += scaledGap) {
            let rowIdx = 0;
            const worldCol = startCol + colIdx;

            for (let sy = offsetY; sy <= rect.height + scaledGap; sy += scaledGap) {
              const worldRow = startRow + rowIdx;
              const dist = Math.hypot(sx - pr.x, sy - pr.y);

              if (dist < cfg.PROXIMITY && !pushed.get(`${worldCol},${worldRow}`)?._inertiaApplied) {
                const key = `${worldCol},${worldRow}`;
                let data = pushed.get(key);

                if (!data) {
                  data = { xOffset: 0, yOffset: 0, _inertiaApplied: false };
                  pushed.set(key, data);
                }

                data._inertiaApplied = true;
                gsap.killTweensOf(data);

                // Exact React Bits formula: raw displacement + tiny velocity influence
                const pushX = (sx - pr.x) + vx * 0.005;
                const pushY = (sy - pr.y) + vy * 0.005;

                gsap.to(data, {
                  inertia: {
                    xOffset: pushX,
                    yOffset: pushY,
                    resistance: cfg.RESISTANCE,
                  },
                  onComplete: () => {
                    gsap.to(data!, {
                      xOffset: 0,
                      yOffset: 0,
                      duration: configRef.current.RETURN_DURATION,
                      ease: "elastic.out(1,0.75)",
                    });
                    data!._inertiaApplied = false;
                  },
                });
              }
              rowIdx++;
            }
            colIdx++;
          }
        }
      };

      const handleClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const cfg = configRef.current;

        const cam = cameraRef.current;
        const z = zoomRef.current;
        const scaledGap = cfg.dotGap * z;

        const rawOffsetX = -cam.x * z;
        const rawOffsetY = -cam.y * z;
        const offsetX = ((rawOffsetX % scaledGap) + scaledGap) % scaledGap;
        const offsetY = ((rawOffsetY % scaledGap) + scaledGap) % scaledGap;
        const startCol = Math.floor(cam.x / cfg.dotGap);
        const startRow = Math.floor(cam.y / cfg.dotGap);

        const pushed = pushedDots.current;

        let colIdx = 0;
        for (let sx = offsetX; sx <= rect.width + scaledGap; sx += scaledGap) {
          let rowIdx = 0;
          const worldCol = startCol + colIdx;

          for (let sy = offsetY; sy <= rect.height + scaledGap; sy += scaledGap) {
            const worldRow = startRow + rowIdx;
            const dist = Math.hypot(sx - cx, sy - cy);

            if (dist < cfg.SHOCK_RADIUS && !pushed.get(`${worldCol},${worldRow}`)?._inertiaApplied) {
              const key = `${worldCol},${worldRow}`;
              let data = pushed.get(key);

              if (!data) {
                data = { xOffset: 0, yOffset: 0, _inertiaApplied: false };
                pushed.set(key, data);
              }

              data._inertiaApplied = true;
              gsap.killTweensOf(data);

              // Exact React Bits formula: raw displacement * shockStrength * falloff
              const falloff = Math.max(0, 1 - dist / cfg.SHOCK_RADIUS);
              const pushX = (sx - cx) * cfg.SHOCK_STRENGTH * falloff;
              const pushY = (sy - cy) * cfg.SHOCK_STRENGTH * falloff;

              gsap.to(data, {
                inertia: {
                  xOffset: pushX,
                  yOffset: pushY,
                  resistance: cfg.RESISTANCE,
                },
                onComplete: () => {
                  gsap.to(data!, {
                    xOffset: 0,
                    yOffset: 0,
                    duration: configRef.current.RETURN_DURATION,
                    ease: "elastic.out(1,0.75)",
                  });
                  data!._inertiaApplied = false;
                },
              });
            }
            rowIdx++;
          }
          colIdx++;
        }
      };

      const handleLeave = () => {
        pointerRef.current.inCanvas = false;
        pointerRef.current.x = -9999;
        pointerRef.current.y = -9999;
      };

      // Track drag to suppress click shockwave after dragging
      let mouseDownPos = { x: 0, y: 0 };
      const handleMouseDown = (e: MouseEvent) => {
        mouseDownPos = { x: e.clientX, y: e.clientY };
      };

      // Throttle mousemove to ~20fps for physics (draw runs at 60fps)
      let lastMoveCall = 0;
      const throttledMove = (e: MouseEvent) => {
        const now = performance.now();
        if (now - lastMoveCall >= 50) {
          lastMoveCall = now;
          handleMove(e);
        } else {
          // Still update pointer position for proximity color (just skip physics)
          const rect = canvas.getBoundingClientRect();
          pointerRef.current.x = e.clientX - rect.left;
          pointerRef.current.y = e.clientY - rect.top;
          pointerRef.current.inCanvas = true;
        }
      };

      const guardedClick = (e: MouseEvent) => {
        // Only fire shockwave for genuine clicks, not after drags
        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);
        if (dx > 5 || dy > 5) return;
        handleClick(e);
      };

      container.addEventListener("mousedown", handleMouseDown, { passive: true });
      container.addEventListener("mousemove", throttledMove, { passive: true });
      container.addEventListener("mouseleave", handleLeave);
      container.addEventListener("click", guardedClick);

      return () => {
        container.removeEventListener("mousedown", handleMouseDown);
        container.removeEventListener("mousemove", throttledMove);
        container.removeEventListener("mouseleave", handleLeave);
        container.removeEventListener("click", guardedClick);
      };
    }, [cameraRef, zoomRef]);

    return (
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />
    );
  }
);

BackgroundRippleEffect.displayName = "BackgroundRippleEffect";
