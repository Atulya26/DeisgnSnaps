import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowMove } from "geist-icons";
import type { Project } from "./types";
import { PortfolioCard, PortfolioCardReplica } from "./PortfolioCard";
import { ZoomControls } from "./ZoomControls";
import { useTheme } from "./ThemeContext";
import { BackgroundRippleEffect } from "./BackgroundRippleEffect";
import { computeInitialCamera } from "./autoLayout";

const TOOLBAR_OFFSET = 64; // must match Toolbar.tsx height — canvas pans under the translucent bar

interface InfiniteCanvasProps {
  projects: Project[];
  onOpenProject: (project: Project, rect: DOMRect) => void;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.4;
const DEFAULT_ZOOM = 0.60;
const ZOOM_STEP = 0.08;
const TILE_PADDING = 30;

// ── Physics tuning (Lenis-inspired smooth feel) ──
const MOMENTUM_FRICTION = 0.985;       // Gentler friction → longer, smoother coast (was 0.96)
const MOMENTUM_MIN_VELOCITY = 0.003;   // Lower stop threshold → momentum carries further
const WHEEL_LERP_MOUSE = 0.18;        // Snappier catch-up for discrete mouse wheel — reduces rubber-band feel on sustained scroll
const WHEEL_LERP_TRACKPAD = 0.55;     // Light smoothing for trackpad (was 0.45)
const SCROLL_IDLE_MS = 140;           // Restore pointer events this long after the last wheel tick
const ZOOM_LERP = 0.12;               // Slightly faster zoom response (was 0.10)
const SETTLE_THRESHOLD = 0.05;        // Tighter settle → less visible snap at end
const ZOOM_SETTLE_THRESHOLD = 0.0003; // Tighter zoom settle
const ZOOM_DISPLAY_THROTTLE = 60;     // More responsive zoom display (was 80)
const BASELINE_DT = 16.667;           // 60fps reference frame time
const DRAG_START_THRESHOLD = 4;

// ── Grid cell size (shared with BackgroundRippleEffect) ──
const GRID_CELL = 40;

function normalizeWheelDelta(e: WheelEvent): { x: number; y: number } {
  // deltaMode: 0=pixel, 1=line, 2=page
  const scale =
    e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
  return {
    x: e.deltaX * scale,
    y: e.deltaY * scale,
  };
}

function detectTrackpad(e: WheelEvent): boolean {
  // High-frequency, small deltas in pixel mode are usually trackpads.
  if (e.deltaMode !== 0) return false;
  const ax = Math.abs(e.deltaX);
  const ay = Math.abs(e.deltaY);
  if (ax === 0 && ay === 0) return false;
  return (
    (ay > 0 && ay < 40) ||
    (ax > 0 && ax < 40) ||
    (!Number.isInteger(e.deltaX) || !Number.isInteger(e.deltaY))
  );
}

function isInteractiveCanvasTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      [
        "[data-canvas-card='true']",
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "[role='button']",
        "[contenteditable='true']",
      ].join(",")
    )
  );
}

export function InfiniteCanvas({
  projects,
  onOpenProject,
}: InfiniteCanvasProps) {
  const { colors } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const transformGroupRef = useRef<HTMLDivElement>(null);

  // ── Initial camera: centered on the masonry bounds so ultrawide/4K screens
  //     don't leave a big empty band. Computed once from the first `projects`
  //     snapshot — panning is unaffected when admin entries resolve later.
  //     topInset = TOOLBAR_OFFSET because the canvas extends under the
  //     translucent toolbar; content should center in the visible area. ──
  const initialCameraSeed = useMemo(
    () => {
      if (typeof window === "undefined") return { x: -60, y: -40 };
      return computeInitialCamera(
        projects,
        { width: window.innerWidth, height: window.innerHeight },
        DEFAULT_ZOOM,
        TOOLBAR_OFFSET
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Camera & zoom live in refs (never trigger React re-renders) ──
  const camera = useRef({ ...initialCameraSeed });
  const zoom = useRef(DEFAULT_ZOOM);

  // Smooth targets — input handlers write here, render loop lerps toward them
  const targetCamera = useRef({ ...initialCameraSeed });
  const targetZoom = useRef(DEFAULT_ZOOM);

  // ── Drag state ──
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cameraStart = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const dragVisualsActive = useRef(false);

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
  const [tileCamera, setTileCamera] = useState(initialCameraSeed);
  const [tileZoom, setTileZoom] = useState(DEFAULT_ZOOM);
  const [displayZoom, setDisplayZoom] = useState(DEFAULT_ZOOM);
  const lastDisplayZoomUpdate = useRef(0);
  const prevTileKey = useRef("");

  const [showHint, setShowHint] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  // isDragging cursor is handled via direct DOM manipulation (no React re-render)
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

      // Consume deferred tile sync (from drag mousemove) inside the rAF frame
      if (tileSyncPending.current) {
        tileSyncPending.current = false;
        needsNextFrame = true; // Keep loop alive during drag
      }
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

  // ── Drag visual state — direct DOM manipulation, zero React renders ──
  const setDragVisuals = useCallback((dragging: boolean) => {
    const el = containerRef.current;
    if (el) el.style.cursor = dragging ? "grabbing" : "grab";
    // Disable pointer-events on cards while dragging to avoid hover compositing
    const tg = transformGroupRef.current;
    if (tg) tg.style.pointerEvents = dragging ? "none" : "";
    dragVisualsActive.current = dragging;
  }, []);

  // ── Dismiss hint ──
  const markInteracted = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      setShowHint(false);
    }
  }, [hasInteracted]);

  // ──────────── Mouse Drag ────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (isInteractiveCanvasTarget(e.target)) return;
      cancelMomentum();
      cancelWheelSmoothing();
      isDragging.current = true;
      hasDragged.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      cameraStart.current = { ...camera.current };
      lastMoveTime.current = performance.now();
      lastMovePos.current = { x: e.clientX, y: e.clientY };
      // Capture pointer to prevent missed moves (especially near edges/iframes)
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [cancelMomentum, cancelWheelSmoothing]
  );

  // Track whether tile sync is needed (set during drag, consumed by rAF)
  const tileSyncPending = useRef(false);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const z = zoom.current;
      const dx = (e.clientX - dragStart.current.x) / z;
      const dy = (e.clientY - dragStart.current.y) / z;

      if (Math.abs(dx) > DRAG_START_THRESHOLD || Math.abs(dy) > DRAG_START_THRESHOLD) {
        hasDragged.current = true;
        if (!dragVisualsActive.current) {
          setDragVisuals(true);
        }
      }

      // Direct camera update — 1:1 tracking, no smoothing
      camera.current.x = cameraStart.current.x - dx;
      camera.current.y = cameraStart.current.y - dy;
      targetCamera.current.x = camera.current.x;
      targetCamera.current.y = camera.current.y;

      // Apply transform directly (compositor-only, no React)
      applyTransform();

      // DEFERRED tile sync: mark pending instead of calling immediately.
      // This avoids React re-renders mid-drag which cause jitter.
      // The render loop (or next rAF) will pick this up.
      tileSyncPending.current = true;
      ensureLoop(); // Ensure the render loop runs to consume the pending sync

      // Track velocity for momentum (smoothed to avoid spikes)
      const now = performance.now();
      const dt = now - lastMoveTime.current;
      if (dt > 0) {
        const vx = -(e.clientX - lastMovePos.current.x) / (dt * z);
        const vy = -(e.clientY - lastMovePos.current.y) / (dt * z);
        // Exponential smoothing — reduces velocity spikes from high-DPI mice
        velocity.current.x = velocity.current.x * 0.6 + vx * 0.4;
        velocity.current.y = velocity.current.y * 0.6 + vy * 0.4;
      }
      lastMoveTime.current = now;
      lastMovePos.current = { x: e.clientX, y: e.clientY };

      markInteracted();
    };

    const handlePointerUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (dragVisualsActive.current) {
        setDragVisuals(false);
      }

      // Flush any pending tile sync now that drag is over
      if (tileSyncPending.current) {
        tileSyncPending.current = false;
        syncTiles();
      }

      // Start momentum if velocity is meaningful
      const vel = velocity.current;
      if (Math.abs(vel.x) > 0.015 || Math.abs(vel.y) > 0.015) {
        hasMomentum.current = true;
        ensureLoop();
      }

      setTimeout(() => {
        hasDragged.current = false;
      }, 10);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [markInteracted, ensureLoop, applyTransform, syncTiles, setDragVisuals]);

  // ── Scroll-lock: while the wheel is actively firing, cards must NOT
  //     receive hover/pointer events. Without this, a mouse that happens
  //     to sit over a card during a long scroll triggers whileHover, which
  //     animates boxShadow/borderColor/y and competes with the transform
  //     on the compositor — that's the jitter. Same trick drag already
  //     uses in setDragVisuals, extended to continuous wheel activity. ──
  const scrollIdleTimer = useRef<number | null>(null);
  const isScrollActive = useRef(false);
  const setScrollActive = useCallback((active: boolean) => {
    if (active === isScrollActive.current) return;
    isScrollActive.current = active;
    const tg = transformGroupRef.current;
    if (tg) tg.style.pointerEvents = active ? "none" : "";
  }, []);

  const resetInteractionState = useCallback(() => {
    isDragging.current = false;
    hasDragged.current = false;
    dragStart.current = { x: 0, y: 0 };
    cameraStart.current = { ...camera.current };
    velocity.current = { x: 0, y: 0 };
    hasMomentum.current = false;
    isWheelSmoothing.current = false;
    targetCamera.current = { ...camera.current };
    targetZoom.current = zoom.current;
    if (scrollIdleTimer.current !== null) {
      window.clearTimeout(scrollIdleTimer.current);
      scrollIdleTimer.current = null;
    }
    setScrollActive(false);
    if (dragVisualsActive.current) {
      setDragVisuals(false);
    } else if (transformGroupRef.current) {
      transformGroupRef.current.style.pointerEvents = "";
    }
  }, [setDragVisuals, setScrollActive]);

  // ──────────── Wheel: Scroll = Pan, Ctrl/Cmd+Scroll = Zoom ────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelMomentum();
      markInteracted();

      // Lock out hover compositing for the duration of this scroll burst.
      setScrollActive(true);
      if (scrollIdleTimer.current !== null) {
        window.clearTimeout(scrollIdleTimer.current);
      }
      scrollIdleTimer.current = window.setTimeout(() => {
        setScrollActive(false);
        scrollIdleTimer.current = null;
      }, SCROLL_IDLE_MS);

      const z = zoom.current;

      const isTrackpad = detectTrackpad(e);
      const { x: deltaX, y: deltaY } = normalizeWheelDelta(e);
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

        const delta = -deltaY * 0.0026;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta));

        // Set targets — render loop will smoothly interpolate
        targetZoom.current = newZoom;
        targetCamera.current.x = worldX - cursorX / newZoom;
        targetCamera.current.y = worldY - cursorY / newZoom;

        // For trackpad pinch, apply directly for immediate response.
        if (isTrackpad) {
          zoom.current = newZoom;
          camera.current.x = targetCamera.current.x;
          camera.current.y = targetCamera.current.y;
          applyTransform();
          tileSyncPending.current = true;
        }
      } else {
        // ── Pan ──
        const panSpeed = 1 / z;
        targetCamera.current.x += deltaX * panSpeed;
        targetCamera.current.y += deltaY * panSpeed;

        // Trackpad: direct 1:1 movement for best latency.
        if (isTrackpad) {
          camera.current.x = targetCamera.current.x;
          camera.current.y = targetCamera.current.y;
          applyTransform();
          tileSyncPending.current = true;
        }
      }

      // Keep smoothing for mouse wheel only; trackpad stays immediate.
      isWheelSmoothing.current = !isTrackpad;
      ensureLoop();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (scrollIdleTimer.current !== null) {
        window.clearTimeout(scrollIdleTimer.current);
        scrollIdleTimer.current = null;
      }
      setScrollActive(false);
    };
  }, [markInteracted, cancelMomentum, ensureLoop, applyTransform, syncTiles, setScrollActive]);

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
        setDragVisuals(true);
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

        if (Math.abs(dx) > DRAG_START_THRESHOLD || Math.abs(dy) > DRAG_START_THRESHOLD) {
          hasDragged.current = true;
          if (!dragVisualsActive.current) {
            setDragVisuals(true);
          }
        }

        camera.current.x = cameraStart.current.x - dx;
        camera.current.y = cameraStart.current.y - dy;
        targetCamera.current.x = camera.current.x;
        targetCamera.current.y = camera.current.y;

        applyTransform();
        // Defer tile sync to rAF (same as mouse drag)
        tileSyncPending.current = true;
        ensureLoop();

        // Track velocity (smoothed)
        const now = performance.now();
        const dt = now - lastMoveTime.current;
        if (dt > 0) {
          const vx = -(e.touches[0].clientX - lastMovePos.current.x) / (dt * z);
          const vy = -(e.touches[0].clientY - lastMovePos.current.y) / (dt * z);
          velocity.current.x = velocity.current.x * 0.6 + vx * 0.4;
          velocity.current.y = velocity.current.y * 0.6 + vy * 0.4;
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
        if (dragVisualsActive.current) {
          setDragVisuals(false);
        }

        // Flush pending tile sync
        if (tileSyncPending.current) {
          tileSyncPending.current = false;
          syncTiles();
        }

        const vel = velocity.current;
        if (Math.abs(vel.x) > 0.015 || Math.abs(vel.y) > 0.015) {
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
  }, [markInteracted, cancelMomentum, cancelWheelSmoothing, ensureLoop, applyTransform, syncTiles, setDragVisuals]);

  useEffect(() => {
    const handleWindowFocus = () => {
      resetInteractionState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetInteractionState();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [resetInteractionState]);

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
      resetInteractionState();
    };
  }, [applyTransform, resetInteractionState]);

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
        cursor: "grab",
      }}
      onPointerDown={handlePointerDown}
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
          transform: `scale(${DEFAULT_ZOOM}) translate3d(${-initialCameraSeed.x}px, ${-initialCameraSeed.y}px, 0)`,
          transformOrigin: "0 0",
          willChange: "transform",
          contain: "layout style",
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
                contain: "strict",
              }}
            >
              {projects.map((project, i) => (
                isOriginTile ? (
                  <PortfolioCard
                    key={`${project.id}-${tile.key}`}
                    project={project}
                    onOpen={handleCardOpen}
                    skipAnimation={false}
                    index={i}
                  />
                ) : (
                  <PortfolioCardReplica
                    key={`${project.id}-${tile.key}`}
                    project={project}
                  />
                )
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

      {/* Hint overlay — refined editorial style */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            className="fixed bottom-7 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full px-5 py-2.5"
            style={{
              backgroundColor: "rgba(18,18,18,0.88)",
              backdropFilter: "blur(24px) saturate(1.5)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 1.2 }}
          >
            <motion.div
              animate={prefersReduced ? undefined : { x: [0, 4, 0, -4, 0], y: [0, -2, 0, 2, 0] }}
              transition={prefersReduced ? undefined : {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ArrowMove size={14} color="rgba(255,255,255,0.7)" />
            </motion.div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "nowrap",
                letterSpacing: "0.01em",
              }}
            >
              Drag to explore
            </span>
            <div
              style={{
                width: 1,
                height: 10,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "rgba(255,255,255,0.45)",
                whiteSpace: "nowrap",
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: "0.01em",
              }}
            >
              Scroll to pan
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
