import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { Project } from "./types";
import { PortfolioCard } from "./PortfolioCard";
import { ZoomControls } from "./ZoomControls";
import { springs } from "./animationConfig";
import { useTheme } from "./ThemeContext";
import { BackgroundRippleEffect } from "./BackgroundRippleEffect";

interface InfiniteCanvasProps {
  projects: Project[];
  onOpenProject: (project: Project, rect: DOMRect) => void;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.4;
const DEFAULT_ZOOM = 0.60;
const ZOOM_STEP = 0.08;
const TILE_PADDING = 30;

// ── Physics tuning ──
const MOMENTUM_FRICTION = 0.96;        // Per-frame friction at 60fps baseline (smoother deceleration)
const MOMENTUM_MIN_VELOCITY = 0.005;   // Stop threshold (px/ms) — longer coast
const WHEEL_LERP_MOUSE = 0.08;        // Smoother interpolation for discrete mouse wheel (Lenis-like)
const WHEEL_LERP_TRACKPAD = 0.45;     // Light smoothing for trackpad
const ZOOM_LERP = 0.10;               // Smoothing for animated zoom
const SETTLE_THRESHOLD = 0.1;         // Camera settle threshold (px)
const ZOOM_SETTLE_THRESHOLD = 0.0005; // Zoom settle threshold
const ZOOM_DISPLAY_THROTTLE = 80;     // ms between zoom UI updates
const BASELINE_DT = 16.667;           // 60fps reference frame time

// ── Grid cell size (shared with BackgroundRippleEffect) ──
const GRID_CELL = 40;

export function InfiniteCanvas({
  projects,
  onOpenProject,
}: InfiniteCanvasProps) {
  const { colors } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const transformGroupRef = useRef<HTMLDivElement>(null);

  // ── Camera & zoom live in refs (never trigger React re-renders) ──
  const camera = useRef({ x: -60, y: -40 });
  const zoom = useRef(DEFAULT_ZOOM);

  // Smooth targets — input handlers write here, render loop lerps toward them
  const targetCamera = useRef({ x: -60, y: -40 });
  const targetZoom = useRef(DEFAULT_ZOOM);

  // ── Drag state ──
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cameraStart = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  // ── Touch state ──
  const lastTouchDist = useRef(0);
  const lastTouchCenter = useRef({ x: 0, y: 0 });

  // ── Momentum state ──
  const velocity = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(0);
  const lastMovePos = useRef({ x: 0, y: 0 });
  const hasMomentum = useRef(false);

  // ── Wheel smoothing state ──
  const isWheelSmoothing = useRef(false);
  const wheelLerp = useRef(WHEEL_LERP_TRACKPAD);

  // ── Animated zoom state (for zoom buttons) ──
  const isZoomAnimating = useRef(false);
  const zoomAnimStart = useRef({ zoom: DEFAULT_ZOOM, camera: { x: 0, y: 0 }, time: 0 });
  const zoomAnimTarget = useRef({ zoom: DEFAULT_ZOOM, camera: { x: 0, y: 0 } });
  const ZOOM_ANIM_DURATION = 300;

  // ── Render loop ──
  const loopRef = useRef<number>(0);
  const loopRunning = useRef(false);
  const lastFrameTime = useRef(0);

  // ── React state: only for tile calculation & zoom display (updated sparingly) ──
  const [tileCamera, setTileCamera] = useState({ x: -60, y: -40 });
  const [tileZoom, setTileZoom] = useState(DEFAULT_ZOOM);
  const [displayZoom, setDisplayZoom] = useState(DEFAULT_ZOOM);
  const lastDisplayZoomUpdate = useRef(0);
  const prevTileKey = useRef("");

  const [showHint, setShowHint] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const prefersReduced = useReducedMotion();

  // ── Tile dimensions ──
  const tileW = useMemo(
    () => Math.max(...projects.map((p) => p.x + p.width)) + TILE_PADDING,
    [projects]
  );
  const tileH = useMemo(
    () => Math.max(...projects.map((p) => p.y + p.height)) + TILE_PADDING,
    [projects]
  );

  // ── Calculate visible tile key from current ref values ──
  const getTileKey = useCallback(
    (camX: number, camY: number, z: number) => {
      const el = containerRef.current;
      const viewW = (el?.clientWidth ?? window.innerWidth) / z;
      const viewH = (el?.clientHeight ?? window.innerHeight) / z;
      const startCol = Math.floor(camX / tileW);
      const endCol = Math.floor((camX + viewW) / tileW);
      const startRow = Math.floor(camY / tileH);
      const endRow = Math.floor((camY + viewH) / tileH);
      return `${startCol},${endCol},${startRow},${endRow}`;
    },
    [tileW, tileH]
  );

  // ── Visible tiles (driven by tileCamera/tileZoom state — rare re-renders) ──
  const visibleTiles = useMemo(() => {
    const el = containerRef.current;
    const viewW = (el?.clientWidth ?? window.innerWidth) / tileZoom;
    const viewH = (el?.clientHeight ?? window.innerHeight) / tileZoom;

    const startCol = Math.floor(tileCamera.x / tileW);
    const endCol = Math.floor((tileCamera.x + viewW) / tileW);
    const startRow = Math.floor(tileCamera.y / tileH);
    const endRow = Math.floor((tileCamera.y + viewH) / tileH);

    const tiles: { col: number; row: number; key: string }[] = [];
    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        tiles.push({ col, row, key: `${col}_${row}` });
      }
    }
    return tiles;
  }, [tileCamera.x, tileCamera.y, tileZoom, tileW, tileH]);

  // ── Direct DOM update — zero React overhead ──
  const applyTransform = useCallback(() => {
    const cam = camera.current;
    const z = zoom.current;

    if (transformGroupRef.current) {
      transformGroupRef.current.style.transform =
        `scale(${z}) translate3d(${-cam.x}px, ${-cam.y}px, 0)`;
    }
  }, []);

  // ── Sync tile state to React (only when tile boundaries change) ──
  const syncTiles = useCallback(() => {
    const cam = camera.current;
    const z = zoom.current;
    const key = getTileKey(cam.x, cam.y, z);

    if (key !== prevTileKey.current) {
      prevTileKey.current = key;
      setTileCamera({ x: cam.x, y: cam.y });
      setTileZoom(z);
    }

    // Throttled zoom display update
    const now = performance.now();
    if (now - lastDisplayZoomUpdate.current > ZOOM_DISPLAY_THROTTLE) {
      lastDisplayZoomUpdate.current = now;
      setDisplayZoom(z);
    }
  }, [getTileKey]);

  // ── Main render loop ──
  const renderLoop = useCallback(
    (timestamp: number) => {
      const prevTime = lastFrameTime.current || timestamp;
      const dt = Math.min(timestamp - prevTime, 50); // Cap to avoid spiral on tab-switch
      lastFrameTime.current = timestamp;

      let needsNextFrame = false;

      // ── 1. Wheel smoothing (when not dragging) ──
      if (isWheelSmoothing.current && !isDragging.current) {
        const lerp = wheelLerp.current;
        // Frame-rate independent lerp: 1 - (1 - lerp)^(dt / BASELINE_DT)
        const factor = 1 - Math.pow(1 - lerp, dt / BASELINE_DT);

        const dx = targetCamera.current.x - camera.current.x;
        const dy = targetCamera.current.y - camera.current.y;

        if (Math.abs(dx) > SETTLE_THRESHOLD || Math.abs(dy) > SETTLE_THRESHOLD) {
          camera.current.x += dx * factor;
          camera.current.y += dy * factor;
          needsNextFrame = true;
        } else {
          camera.current.x = targetCamera.current.x;
          camera.current.y = targetCamera.current.y;
          isWheelSmoothing.current = false;
        }
      }

      // ── 2. Momentum ──
      if (hasMomentum.current) {
        const vel = velocity.current;
        // Frame-rate independent friction: friction^(dt / BASELINE_DT)
        const frictionPow = Math.pow(MOMENTUM_FRICTION, dt / BASELINE_DT);

        vel.x *= frictionPow;
        vel.y *= frictionPow;

        if (Math.abs(vel.x) > MOMENTUM_MIN_VELOCITY || Math.abs(vel.y) > MOMENTUM_MIN_VELOCITY) {
          // velocity is in px/ms, multiply by dt for displacement
          camera.current.x += vel.x * dt;
          camera.current.y += vel.y * dt;
          // Keep target in sync so wheel smoothing doesn't fight momentum
          targetCamera.current.x = camera.current.x;
          targetCamera.current.y = camera.current.y;
          needsNextFrame = true;
        } else {
          hasMomentum.current = false;
        }
      }

      // ── 3. Animated zoom (for zoom buttons — ease-out curve) ──
      if (isZoomAnimating.current) {
        const anim = zoomAnimStart.current;
        const target = zoomAnimTarget.current;
        const elapsed = timestamp - anim.time;
        const t = Math.min(1, elapsed / ZOOM_ANIM_DURATION);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

        zoom.current = anim.zoom + (target.zoom - anim.zoom) * eased;
        camera.current.x = anim.camera.x + (target.camera.x - anim.camera.x) * eased;
        camera.current.y = anim.camera.y + (target.camera.y - anim.camera.y) * eased;

        targetCamera.current.x = camera.current.x;
        targetCamera.current.y = camera.current.y;
        targetZoom.current = zoom.current;

        if (t < 1) {
          needsNextFrame = true;
        } else {
          isZoomAnimating.current = false;
        }
      }

      // ── 4. Smooth zoom (for wheel zoom — lerp) ──
      if (!isZoomAnimating.current) {
        const dz = targetZoom.current - zoom.current;
        if (Math.abs(dz) > ZOOM_SETTLE_THRESHOLD) {
          const factor = 1 - Math.pow(1 - ZOOM_LERP, dt / BASELINE_DT);
          zoom.current += dz * factor;
          needsNextFrame = true;
        } else {
          zoom.current = targetZoom.current;
        }
      }

      // ── 5. Apply to DOM ──
      applyTransform();
      syncTiles();

      // ── 6. Continue or stop ──
      if (needsNextFrame) {
        loopRef.current = requestAnimationFrame(renderLoop);
      } else {
        loopRunning.current = false;
        // Final sync: ensure React state is fully up to date
        setTileCamera({ x: camera.current.x, y: camera.current.y });
        setTileZoom(zoom.current);
        setDisplayZoom(zoom.current);
      }
    },
    [applyTransform, syncTiles]
  );

  // ── Start the render loop if not already running ──
  const ensureLoop = useCallback(() => {
    if (!loopRunning.current) {
      loopRunning.current = true;
      lastFrameTime.current = 0;
      loopRef.current = requestAnimationFrame(renderLoop);
    }
  }, [renderLoop]);

  // ── Cancel momentum ──
  const cancelMomentum = useCallback(() => {
    hasMomentum.current = false;
    velocity.current = { x: 0, y: 0 };
  }, []);

  // ── Cancel wheel smoothing ──
  const cancelWheelSmoothing = useCallback(() => {
    isWheelSmoothing.current = false;
    targetCamera.current.x = camera.current.x;
    targetCamera.current.y = camera.current.y;
  }, []);

  // ── Dismiss hint ──
  const markInteracted = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      setShowHint(false);
    }
  }, [hasInteracted]);

  // ──────────── Mouse Drag ────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      cancelMomentum();
      cancelWheelSmoothing();
      isDragging.current = true;
      hasDragged.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      cameraStart.current = { ...camera.current };
      lastMoveTime.current = performance.now();
      lastMovePos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    },
    [cancelMomentum, cancelWheelSmoothing]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const z = zoom.current;
      const dx = (e.clientX - dragStart.current.x) / z;
      const dy = (e.clientY - dragStart.current.y) / z;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDragged.current = true;
      }

      // Direct camera update — 1:1 tracking, no smoothing
      camera.current.x = cameraStart.current.x - dx;
      camera.current.y = cameraStart.current.y - dy;
      targetCamera.current.x = camera.current.x;
      targetCamera.current.y = camera.current.y;

      // Apply directly to DOM for immediate feedback
      applyTransform();
      syncTiles();

      // Track velocity for momentum
      const now = performance.now();
      const dt = now - lastMoveTime.current;
      if (dt > 0) {
        // Velocity in world-space px/ms
        const vx = -(e.clientX - lastMovePos.current.x) / (dt * z);
        const vy = -(e.clientY - lastMovePos.current.y) / (dt * z);
        // Smooth velocity tracking to avoid spikes
        velocity.current.x = velocity.current.x * 0.5 + vx * 0.5;
        velocity.current.y = velocity.current.y * 0.5 + vy * 0.5;
      }
      lastMoveTime.current = now;
      lastMovePos.current = { x: e.clientX, y: e.clientY };

      markInteracted();
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // Start momentum if velocity is meaningful
      const vel = velocity.current;
      if (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02) {
        hasMomentum.current = true;
        ensureLoop();
      }

      setTimeout(() => {
        hasDragged.current = false;
      }, 10);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [markInteracted, ensureLoop, applyTransform, syncTiles]);

  // ──────────── Wheel: Scroll = Pan, Ctrl/Cmd+Scroll = Zoom ────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelMomentum();
      markInteracted();

      const z = zoom.current;

      // Detect trackpad vs mouse wheel: trackpad sends small fractional deltas
      const isTrackpad = Math.abs(e.deltaY) < 50 && !Number.isInteger(e.deltaY);
      wheelLerp.current = isTrackpad ? WHEEL_LERP_TRACKPAD : WHEEL_LERP_MOUSE;

      if (e.ctrlKey || e.metaKey) {
        // ── Zoom toward cursor ──
        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        // World position under cursor before zoom
        const cam = camera.current;
        const worldX = cam.x + cursorX / z;
        const worldY = cam.y + cursorY / z;

        const delta = -e.deltaY * 0.005;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta));

        // Set targets — render loop will smoothly interpolate
        targetZoom.current = newZoom;
        targetCamera.current.x = worldX - cursorX / newZoom;
        targetCamera.current.y = worldY - cursorY / newZoom;

        // For trackpad pinch, apply more directly for responsiveness
        if (isTrackpad) {
          zoom.current = newZoom;
          camera.current.x = targetCamera.current.x;
          camera.current.y = targetCamera.current.y;
        }
      } else {
        // ── Pan ──
        const panSpeed = 1 / z;
        targetCamera.current.x += e.deltaX * panSpeed;
        targetCamera.current.y += e.deltaY * panSpeed;

        // Trackpad: apply directly for low latency
        if (isTrackpad) {
          camera.current.x = targetCamera.current.x;
          camera.current.y = targetCamera.current.y;
          applyTransform();
          syncTiles();
        }
      }

      isWheelSmoothing.current = !isTrackpad;
      ensureLoop();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [markInteracted, cancelMomentum, ensureLoop, applyTransform, syncTiles]);

  // ──────────── Touch: Drag + Pinch Zoom ────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      cancelMomentum();
      cancelWheelSmoothing();
      markInteracted();
      if (e.touches.length === 1) {
        isDragging.current = true;
        hasDragged.current = false;
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        cameraStart.current = { ...camera.current };
        lastMoveTime.current = performance.now();
        lastMovePos.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else if (e.touches.length === 2) {
        isDragging.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist.current = Math.hypot(dx, dy);
        lastTouchCenter.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const z = zoom.current;
      const cam = camera.current;

      if (e.touches.length === 1 && isDragging.current) {
        const dx = (e.touches[0].clientX - dragStart.current.x) / z;
        const dy = (e.touches[0].clientY - dragStart.current.y) / z;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasDragged.current = true;
        }

        camera.current.x = cameraStart.current.x - dx;
        camera.current.y = cameraStart.current.y - dy;
        targetCamera.current.x = camera.current.x;
        targetCamera.current.y = camera.current.y;

        applyTransform();
        syncTiles();

        // Track velocity
        const now = performance.now();
        const dt = now - lastMoveTime.current;
        if (dt > 0) {
          const vx = -(e.touches[0].clientX - lastMovePos.current.x) / (dt * z);
          const vy = -(e.touches[0].clientY - lastMovePos.current.y) / (dt * z);
          velocity.current.x = velocity.current.x * 0.5 + vx * 0.5;
          velocity.current.y = velocity.current.y * 0.5 + vy * 0.5;
        }
        lastMoveTime.current = now;
        lastMovePos.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const center = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };

        if (lastTouchDist.current > 0) {
          const scale = dist / lastTouchDist.current;
          const rect = el.getBoundingClientRect();
          const cursorX = center.x - rect.left;
          const cursorY = center.y - rect.top;

          const worldX = cam.x + cursorX / z;
          const worldY = cam.y + cursorY / z;

          const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * scale));

          zoom.current = newZoom;
          camera.current.x = worldX - cursorX / newZoom;
          camera.current.y = worldY - cursorY / newZoom;
          targetCamera.current.x = camera.current.x;
          targetCamera.current.y = camera.current.y;
          targetZoom.current = newZoom;

          applyTransform();
          syncTiles();
        }

        lastTouchDist.current = dist;
        lastTouchCenter.current = center;
      }
    };

    const handleTouchEnd = () => {
      if (isDragging.current) {
        isDragging.current = false;
        const vel = velocity.current;
        if (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02) {
          hasMomentum.current = true;
          ensureLoop();
        }
      }
      lastTouchDist.current = 0;
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [markInteracted, cancelMomentum, cancelWheelSmoothing, ensureLoop, applyTransform, syncTiles]);

  // ──────────── Animated zoom (for buttons) ────────────
  const animateZoom = useCallback(
    (newZoom: number, newCamera: { x: number; y: number }) => {
      cancelMomentum();
      cancelWheelSmoothing();
      isZoomAnimating.current = true;
      zoomAnimStart.current = {
        zoom: zoom.current,
        camera: { ...camera.current },
        time: performance.now(),
      };
      zoomAnimTarget.current = { zoom: newZoom, camera: newCamera };
      targetZoom.current = newZoom;
      targetCamera.current = { ...newCamera };
      ensureLoop();
    },
    [cancelMomentum, cancelWheelSmoothing, ensureLoop]
  );

  const handleZoomIn = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const z = zoom.current;
    const cam = camera.current;
    const centerX = el.clientWidth / 2;
    const centerY = el.clientHeight / 2;
    const worldX = cam.x + centerX / z;
    const worldY = cam.y + centerY / z;
    const newZoom = Math.min(MAX_ZOOM, z + ZOOM_STEP);
    animateZoom(newZoom, {
      x: worldX - centerX / newZoom,
      y: worldY - centerY / newZoom,
    });
  }, [animateZoom]);

  const handleZoomOut = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const z = zoom.current;
    const cam = camera.current;
    const centerX = el.clientWidth / 2;
    const centerY = el.clientHeight / 2;
    const worldX = cam.x + centerX / z;
    const worldY = cam.y + centerY / z;
    const newZoom = Math.max(MIN_ZOOM, z - ZOOM_STEP);
    animateZoom(newZoom, {
      x: worldX - centerX / newZoom,
      y: worldY - centerY / newZoom,
    });
  }, [animateZoom]);

  const handleZoomReset = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const z = zoom.current;
    const cam = camera.current;
    const centerX = el.clientWidth / 2;
    const centerY = el.clientHeight / 2;
    const worldX = cam.x + centerX / z;
    const worldY = cam.y + centerY / z;
    animateZoom(DEFAULT_ZOOM, {
      x: worldX - centerX / DEFAULT_ZOOM,
      y: worldY - centerY / DEFAULT_ZOOM,
    });
  }, [animateZoom]);

  // ──────────── Keyboard zoom ────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "=" || e.key === "+") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleZoomIn();
        }
      } else if (e.key === "-") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleZoomOut();
        }
      } else if (e.key === "0") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleZoomReset();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  // ── Initial transform + cleanup ──
  useEffect(() => {
    applyTransform();
    return () => {
      cancelAnimationFrame(loopRef.current);
    };
  }, [applyTransform]);

  // Card click wrapper
  const handleCardOpen = useCallback(
    (project: Project, rect: DOMRect) => {
      if (hasDragged.current) return;
      cancelMomentum();
      onOpenProject(project, rect);
    },
    [onOpenProject, cancelMomentum]
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden"
      style={{
        backgroundColor: colors.bg,
        touchAction: "none",
        transition: "background-color 0.35s ease",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Background grid with mouse hover trail */}
      <BackgroundRippleEffect
        cellSize={GRID_CELL}
        cameraRef={camera}
        zoomRef={zoom}
      />

      {/* Transform group — updated via ref, never re-rendered by React during interaction */}
      <div
        ref={transformGroupRef}
        className="absolute left-0 top-0 z-[1]"
        style={{
          transform: `scale(${DEFAULT_ZOOM}) translate3d(${60}px, ${40}px, 0)`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {visibleTiles.map((tile) => {
          const isOriginTile = tile.col === 0 && tile.row === 0;
          return (
            <div
              key={tile.key}
              className="absolute"
              style={{
                left: tile.col * tileW,
                top: tile.row * tileH,
                width: tileW,
                height: tileH,
                contain: "layout style",
              }}
            >
              {projects.map((project, i) => (
                <PortfolioCard
                  key={`${project.id}-${tile.key}`}
                  project={project}
                  onOpen={handleCardOpen}
                  skipAnimation={!isOriginTile}
                  index={i}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Zoom controls */}
      <ZoomControls
        zoom={displayZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleZoomReset}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
      />

      {/* Hint overlay */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full px-5 py-2.5"
            style={{
              backgroundColor: "rgba(26,26,26,0.85)",
              backdropFilter: "blur(20px)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ ...springs.smooth, delay: 1.2 }}
          >
            <motion.div
              animate={prefersReduced ? undefined : { x: [0, 5, 0, -5, 0], y: [0, -3, 0, 3, 0] }}
              transition={prefersReduced ? undefined : {
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2V14M8 2L5 5M8 2L11 5M8 14L5 11M8 14L11 11M2 8H14M2 8L5 5M2 8L5 11M14 8L11 5M14 8L11 11"
                  stroke="white"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
            <span
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.9)",
                whiteSpace: "nowrap",
              }}
            >
              Drag to explore
            </span>
            <div
              style={{
                width: 1,
                height: 12,
                backgroundColor: "rgba(255,255,255,0.2)",
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.6)",
                whiteSpace: "nowrap",
              }}
            >
              &#8984;+Scroll to zoom
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
