"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useTheme } from "./ThemeContext";

interface RipplePulse {
  x: number;
  y: number;
  startTime: number;
  durationMs: number;
  strength: number;
  radius: number;
}

function hexToRgb(hex: string) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export const BackgroundRippleEffect = React.memo(function BackgroundRippleEffect({
  cellSize = 40,
  cameraRef,
  zoomRef,
}: {
  cellSize?: number;
  cameraRef: React.MutableRefObject<{ x: number; y: number }>;
  zoomRef: React.MutableRefObject<number>;
}) {
  const { theme, dotGridConfig } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({
    x: -9999,
    y: -9999,
    inCanvas: false,
  });
  const pointerSampleRef = useRef({
    x: -9999,
    y: -9999,
    time: 0,
  });
  const ripplesRef = useRef<RipplePulse[]>([]);
  const lastRippleAtRef = useRef(0);
  const lastDrawnRef = useRef({
    x: Number.NaN,
    y: Number.NaN,
    z: Number.NaN,
    px: Number.NaN,
    py: Number.NaN,
    inCanvas: false,
    rippleCount: -1,
  });
  const rafIdRef = useRef(0);

  const dotSize = dotGridConfig.dotSize;
  const proximity = dotGridConfig.proximity;
  const speedTrigger = dotGridConfig.speedTrigger;
  const shockRadius = dotGridConfig.shockRadius;
  const shockStrength = dotGridConfig.shockStrength;
  const maxSpeed = Math.max(speedTrigger + 1, dotGridConfig.maxSpeed);
  const resistance = dotGridConfig.resistance;
  const returnDurationMs = dotGridConfig.returnDuration * 1000;
  const baseColorHex =
    theme === "dark" ? dotGridConfig.darkBaseColor : dotGridConfig.lightBaseColor;
  const activeColorHex =
    theme === "dark" ? dotGridConfig.darkActiveColor : dotGridConfig.lightActiveColor;
  const baseRgb = useMemo(() => hexToRgb(baseColorHex), [baseColorHex]);
  const activeRgb = useMemo(() => hexToRgb(activeColorHex), [activeColorHex]);
  const dotGap = Math.max(cellSize, dotGridConfig.gap + dotSize);

  const circlePath = useMemo(() => {
    if (typeof window === "undefined") return null;
    const path = new Path2D();
    path.arc(0, 0, dotSize / 2, 0, Math.PI * 2);
    return path;
  }, [dotSize]);

  const pruneRipples = useCallback((now: number) => {
    ripplesRef.current = ripplesRef.current.filter(
      (ripple) => now - ripple.startTime < ripple.durationMs
    );
  }, []);

  const spawnRipple = useCallback(
    (x: number, y: number, strength: number) => {
      const now = performance.now();
      const normalizedStrength = clamp(strength, 0.2, 1.6);
      ripplesRef.current = [
        ...ripplesRef.current.slice(-2),
        {
          x,
          y,
          startTime: now,
          durationMs: returnDurationMs,
          strength: normalizedStrength,
          radius: shockRadius,
        },
      ];
      lastRippleAtRef.current = now;
    },
    [returnDurationMs, shockRadius]
  );

  const draw = useCallback((now = performance.now()) => {
    const canvas = canvasRef.current;
    if (!canvas || !circlePath) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cam = cameraRef.current;
    const zoom = zoomRef.current;
    const scaledGap = dotGap * zoom;

    const rawOffsetX = -cam.x * zoom;
    const rawOffsetY = -cam.y * zoom;
    const offsetX = ((rawOffsetX % scaledGap) + scaledGap) % scaledGap;
    const offsetY = ((rawOffsetY % scaledGap) + scaledGap) % scaledGap;

    const pointer = pointerRef.current;
    const proximitySq = proximity * proximity;
    const baseTransformScale = dpr * zoom;
    const rippleWaveWidth = Math.max(dotGap * 0.8, shockRadius * 0.18);
    const resistanceFactor = clamp(1 - resistance / 3600, 0.22, 1);

    pruneRipples(now);
    const activeRipples = ripplesRef.current;

    for (let screenX = offsetX; screenX <= width + scaledGap; screenX += scaledGap) {
      for (let screenY = offsetY; screenY <= height + scaledGap; screenY += scaledGap) {
        const dx = screenX - pointer.x;
        const dy = screenY - pointer.y;
        const distanceSq = dx * dx + dy * dy;

        let colorMix = 0;
        let displacementX = 0;
        let displacementY = 0;
        let sizeBoost = 0;

        if (pointer.inCanvas && distanceSq <= proximitySq) {
          const distance = Math.sqrt(distanceSq);
          const hoverStrength = Math.pow(1 - distance / proximity, 1.35);
          colorMix = Math.max(colorMix, hoverStrength);
          sizeBoost = Math.max(sizeBoost, hoverStrength * 0.42);
        }

        for (const ripple of activeRipples) {
          const progress = clamp((now - ripple.startTime) / ripple.durationMs, 0, 1);
          if (progress >= 1) continue;

          const rippleDx = screenX - ripple.x;
          const rippleDy = screenY - ripple.y;
          const rippleDistance = Math.hypot(rippleDx, rippleDy);
          const rippleRadius = ripple.radius * easeOutCubic(progress);
          const ringDelta = Math.abs(rippleDistance - rippleRadius);
          if (ringDelta > rippleWaveWidth) continue;

          const ringStrength = 1 - ringDelta / rippleWaveWidth;
          const envelope = 1 - progress;
          const pulse = ringStrength * ringStrength * envelope * ripple.strength * resistanceFactor;
          const centerGlowRadius = rippleWaveWidth * 0.68;
          const centerGlow =
            rippleDistance <= centerGlowRadius
              ? Math.pow(1 - rippleDistance / centerGlowRadius, 2) *
                envelope *
                ripple.strength *
                0.45
              : 0;

          colorMix = Math.max(colorMix, pulse * 1.15, centerGlow);
          sizeBoost = Math.max(
            sizeBoost,
            pulse * (0.52 + shockStrength * 0.055) + centerGlow * 0.35
          );

          if (rippleDistance > 0.001) {
            const displacement =
              pulse * Math.min(9, 1.1 + shockStrength * 0.42);
            displacementX += (rippleDx / rippleDistance) * displacement;
            displacementY += (rippleDy / rippleDistance) * displacement;
          }
        }

        const mix = clamp(colorMix, 0, 1);
        const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * mix);
        const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * mix);
        const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * mix);
        const scaleBoost = 1 + clamp(sizeBoost, 0, 1.15);
        ctx.setTransform(
          baseTransformScale * scaleBoost,
          0,
          0,
          baseTransformScale * scaleBoost,
          (screenX + displacementX) * dpr,
          (screenY + displacementY) * dpr
        );
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill(circlePath);
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [
    activeRgb.b,
    activeRgb.g,
    activeRgb.r,
    baseRgb.b,
    baseRgb.g,
    baseRgb.r,
    cameraRef,
    circlePath,
    dotGap,
    proximity,
    pruneRipples,
    resistance,
    shockRadius,
    shockStrength,
    zoomRef,
  ]);

  const tick = useCallback(() => {
    if (typeof document !== "undefined" && document.hidden) {
      rafIdRef.current = requestAnimationFrame(tick);
      return;
    }

    const cam = cameraRef.current;
    const zoom = zoomRef.current;
    const pointer = pointerRef.current;
    const last = lastDrawnRef.current;
    const now = performance.now();

    pruneRipples(now);
    const rippleCount = ripplesRef.current.length;

    const cameraMoved =
      Math.abs(cam.x - last.x) > 0.01 ||
      Math.abs(cam.y - last.y) > 0.01 ||
      Math.abs(zoom - last.z) > 0.0001;
    const pointerMoved =
      Math.abs(pointer.x - last.px) > 0.5 ||
      Math.abs(pointer.y - last.py) > 0.5 ||
      pointer.inCanvas !== last.inCanvas;
    const ripplesActive = rippleCount > 0;

    if (cameraMoved || pointerMoved || ripplesActive || rippleCount !== last.rippleCount) {
      draw(now);
      last.x = cam.x;
      last.y = cam.y;
      last.z = zoom;
      last.px = pointer.x;
      last.py = pointer.y;
      last.inCanvas = pointer.inCanvas;
      last.rippleCount = rippleCount;
    }

    rafIdRef.current = requestAnimationFrame(tick);
  }, [cameraRef, draw, pruneRipples, zoomRef]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    rafIdRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [tick]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        draw();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const handleMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nextX = event.clientX - rect.left;
      const nextY = event.clientY - rect.top;
      const now = performance.now();
      const previous = pointerSampleRef.current;

      if (previous.time > 0) {
        const dt = Math.max(16, now - previous.time);
        const dx = nextX - previous.x;
        const dy = nextY - previous.y;
        const speed = (Math.hypot(dx, dy) / dt) * 1000;
        const normalizedSpeed = clamp(
          (speed - speedTrigger) / (maxSpeed - speedTrigger),
          0,
          1
        );
        const cooldown = clamp(230 - resistance * 0.04, 70, 230);

        if (
          normalizedSpeed > 0.12 &&
          now - lastRippleAtRef.current >= cooldown
        ) {
          spawnRipple(nextX, nextY, 0.75 + normalizedSpeed);
        }
      }

      pointerSampleRef.current = {
        x: nextX,
        y: nextY,
        time: now,
      };

      pointerRef.current.x = nextX;
      pointerRef.current.y = nextY;
      pointerRef.current.inCanvas = true;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointerRef.current.x = x;
      pointerRef.current.y = y;
      pointerRef.current.inCanvas = true;
      pointerSampleRef.current = {
        x,
        y,
        time: performance.now(),
      };
      spawnRipple(x, y, 1.25 + shockStrength * 0.06);
    };

    const handleLeave = () => {
      pointerRef.current.x = -9999;
      pointerRef.current.y = -9999;
      pointerRef.current.inCanvas = false;
      pointerSampleRef.current = {
        x: -9999,
        y: -9999,
        time: 0,
      };
    };

    container.addEventListener("pointermove", handleMove, { passive: true });
    container.addEventListener("pointerdown", handlePointerDown, { passive: true });
    container.addEventListener("pointerleave", handleLeave);
    container.addEventListener("pointercancel", handleLeave);
    return () => {
      container.removeEventListener("pointermove", handleMove);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointerleave", handleLeave);
      container.removeEventListener("pointercancel", handleLeave);
    };
  }, [maxSpeed, resistance, shockStrength, spawnRipple, speedTrigger]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{ width: "100%", height: "100%" }}
    />
  );
});
