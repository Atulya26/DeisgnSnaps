# Context / Memory — Portfolio Canvas

This file documents ideation, design decisions, and iterations so the next context window or chat can continue without losing history.

---

## Project overview

- **App:** Infinite canvas portfolio (Studio Portfolio) — drag to pan, scroll to zoom, project cards in a masonry-style layout.
- **Admin:** Private admin panel (`/admin`) for managing projects, uploading images to R2, and writing content.
- **Stack:** React, Vite, Tailwind v4, `motion/react` (Framer Motion), GSAP, Lenis, Radix/shadcn-style UI.
- **Backend:** Cloudflare R2 (storage) + Cloudflare Worker (API for listing/uploading).
- **Key paths:** `src/app/`, `src/admin/`, `worker/`.

---

## 1. Card spacing and hover (initial UX pass)

**Problem:** Cards felt cramped; spacing uneven; on hover a "white box" appeared only at the bottom of the card and looked disconnected.

**Decisions:**
- Auto-layout masonry system (`autoLayout.ts`) for deterministic card positioning. No manual X/Y.
- Increased gaps (`GAP_X = 90`, `GAP_Y = 90`) for uniform spacing.
- **Hover:** Whole card lifts 5px, expanded shadow, image zoom (1.03x), "View →" pill slides in from the right. `whileTap={{ scale: 0.98 }}` for click feedback.

**Outcome:** Equal, increased spacing; cohesive card hover with multi-layered feedback.

---

## 2. Smoother scroll / 120fps-ready canvas

**Problem:** Pan and zoom felt janky; couldn't truly run at 120fps because every frame called `setCamera()` / `setZoom()` and triggered full React re-renders.

**Decisions:**
- **Ref-based camera:** `camera` and `zoom` live in refs; the transform is applied by writing directly to `transformGroupRef.current.style.transform`. No React state updates during pan/scroll/momentum.
- **React only when needed:** A separate "tile state" (`tileCamera`, `tileZoom`) updates only when **tile boundaries** change (for `visibleTiles`). Zoom display is throttled (~80ms).
- **Wheel smoothing:** Mouse wheel uses lerp toward a target; trackpad detected and applied directly for low latency.
- **Frame-rate independent momentum:** Friction applied as `friction^(dt / 16.667)`.
- **GPU hint:** Transform uses `translate3d(..., 0)` for compositing.
- **Lenis:** Integrated for smoother scrolling in `ProjectDetail` view.

**Outcome:** Smooth pan/zoom at display refresh rate; no React re-renders on the transform hot path.

---

## 3. Background: Dot Grid (Aceternity/React-Bits inspired)

**Problem:** User iterated through several background approaches — plain grid lines, canvas-drawn ripple, DOM-based Aceternity ripple effect (too laggy with 1600+ divs), hover trail squares, and finally settled on an interactive dot grid.

**Evolution:**
1. ~~Grid lines only~~ → ~~Canvas ripple with proximity lines~~ → ~~DOM cell grid (too laggy)~~ → ~~Canvas hover trail~~ → **Canvas dot grid with GSAP physics**

**Current implementation (`BackgroundRippleEffect.tsx`):**
- **Dots instead of lines:** Small dots (default 2px, gap 20px) filling the viewport, tiling infinitely with the camera via canvas.
- **Proximity color glow:** Dots near the mouse smoothly interpolate from `baseColor` to `activeColor` within a configurable `proximity` radius.
- **Fast-move physics push:** When mouse moves quickly (above `speedTrigger`), nearby dots get pushed away. GSAP animates a spring-back with `elastic.out(1, 0.75)`.
- **Click shockwave:** Clicking on the canvas background pushes dots outward in a radial burst (only on genuine clicks, not drags).
- **All canvas-rendered:** Zero DOM overhead. GSAP only animates the sparse set of currently-pushed dots (stored in a `Map<string, {xOffset, yOffset}>`).
- **Config via context:** All dot grid props (dotSize, gap, proximity, shockRadius, shockStrength, returnDuration, colors) are stored in `ThemeContext` and editable in real-time via the Theme Editor panel.
- **Theme-aware:** Dot base/active colors adapt to light/dark mode via `dotGridConfig.lightBaseColor`, `darkBaseColor`, etc.

**Key constants (defaults):**
- `dotSize: 2`, `gap: 20`, `proximity: 110`, `speedTrigger: 100`, `shockRadius: 100`, `shockStrength: 7`, `returnDuration: 2`
- Light: base `#c8c8c8`, active `#1a51f4`
- Dark: base `#404040`, active `#6e8eff`

---

## 4. Dark Mode & Theme System

**Decisions:**
- **ThemeContext:** Manages `theme` (light/dark), `colors` (merged defaults + overrides), `dotGridConfig`, and live override setters.
- **Circle wipe transition:** `ThemeTransition.tsx` — 3-phase animation (expanding circle, hold while theme switches, fade out).
- **Color overrides:** `lightOverrides` and `darkOverrides` in context allow real-time editing without modifying defaults.
- **`hexToBgAlpha` helper:** Auto-recomputes `bgAlpha` when `bg` is overridden.
- Default dark bg: `#1A1A1A`. All components read from `colors.*` for theme awareness.

**Key theme colors:**
- `bg`, `bgAlpha`, `cardBg`, `text`, `textSecondary`, `textMuted`, `border`, `borderLight`, `shimmer`, `imageBg`, `gridLine`, `rippleColor`

---

## 5. Theme Editor Panel

**Goal:** Real-time visual editor for the entire theme system — dot grid physics, dot colors, and theme colors for both light and dark modes.

**Implementation (`ThemeEditor.tsx`):**
- **Toggle:** Sliders icon button in the toolbar (right of dark mode toggle).
- **Slide-in panel:** Animates from the right, sits below toolbar (`top: 70px`, full remaining height), `z-50`, rounded top-left corner.
- **3 tabs:**
  - **Dot Grid:** Sliders for dotSize, gap, proximity, speedTrigger, shockRadius, shockStrength, returnDuration. Color pickers for light/dark base and active colors.
  - **Light Mode:** Color pickers for background, card BG, image BG, text, secondary, muted, shimmer.
  - **Dark Mode:** Same color controls for dark theme.
- **Reset button:** Restores all configs and color overrides to defaults in one click.
- **All changes are live** — sliders and color pickers update the canvas/cards instantly via context.

**Architecture:**
- `ThemeContext` exports `DotGridConfig`, `defaultDotGridConfig`, `defaultLightColors`, `defaultDarkColors`.
- `BackgroundRippleEffect` reads config from `configRef` (ref-based so rAF callbacks always see latest values).
- Toolbar renders the ThemeEditor as a sibling (outside `<header>`) via React fragment.

---

## 6. Admin Panel & R2 Integration

**Goal:** Create an admin interface to manage projects, upload images, and write content without touching code.

**Decisions:**
- **Architecture:** `src/admin/` folder with separate routes (`/admin/*`). Uses **Cloudflare R2** for storage and a **Cloudflare Worker** (`worker/`) as the API (list/upload/delete).
- **Auto-layout System:** Removed manual X/Y positioning. Added `autoLayoutProjects` utility that arranges projects in a deterministic masonry grid (7 columns, varied aspect ratios).
- **Dribbble-style Editor:** Two-column layout. Left: Title only (syncs to R2 folder name) + delete button. Right: **Content Blocks** (stack of images and rich text blocks).
- **Direct Upload:** "Upload Image" button in admin creates a folder in R2 (based on project title) and PUTs the file via the worker.
- **Settings Lock:** Settings page protected by a session-based PIN (`2612`).
- **Project Merging:** `App.tsx` merges hardcoded projects with admin-published projects (stored in localStorage/R2).

**Outcome:** Full CMS capability. Projects can be created, images uploaded, and layout is automatic.

---

## 7. Detail View & Gallery Updates

**Problem:** Detail view only showed one image; user wanted Dribbble-style "post" view with multiple large images and text.

**Decisions:**
- **Stack Layout:** Vertical stack of **Content Blocks** (images + rich text).
- **Full-width Images:** All images render full-width (max 900px), preserving natural aspect ratio.
- **Lenis smooth scroll:** Initialized on the scrollable container with `lerp: 0.08`.
- **Background texture:** Diagonal line pattern behind content, with padded margins where controls (close, nav arrows) sit.
- **Theme-aware:** All colors adapt to light/dark mode.

**Outcome:** Project detail view feels like a rich case study or blog post.

---

## 8. Custom Cursor

- **Style:** Default system pointer + trailing circle ring (stroke-only, no fill).
- **Theme-aware:** Ring `borderColor` adapts (white-alpha in dark, black-alpha in light).
- **Implementation:** `CustomCursor.tsx` with JS-driven position tracking.

---

## 9. Toolbar

- Height: **70px** (increased 25% from original 56px).
- Contains: Logo, project count, About/Contact links, dark mode toggle (moon/sun), **Theme Editor toggle** (sliders icon).
- Theme-aware colors throughout.

---

## Current state summary

| Area | Current behavior |
|------|-------------------|
| **Canvas** | Ref-based camera/zoom; direct DOM transform; tile state for React; wheel smoothing; default zoom 0.60. |
| **Background** | Canvas-drawn dot grid with proximity glow + GSAP physics push. Configurable via Theme Editor. |
| **Layout** | **Auto-layout** (Masonry, 7 cols, `GAP_X=90`, `GAP_Y=90`); no manual X/Y needed. |
| **Theme** | Light/dark with circle wipe transition. Real-time Theme Editor panel for all colors + dot grid props. |
| **Admin** | Protected settings (PIN 2612); R2 integration (upload/list); Dribbble-style block editor. |
| **Backend** | Cloudflare Worker (`/folders`, `/upload`, `/file`) + R2 Bucket `portfolio-assets`. |
| **Detail View** | Vertical stack of full-width images and rich text blocks; Lenis smooth scroll; line texture background. |

---

## Key files and constants

- **BackgroundRippleEffect.tsx:** Canvas dot grid with GSAP spring physics, proximity glow, click shockwave. Reads `dotGridConfig` from ThemeContext.
- **ThemeContext.tsx:** Theme state, color defaults/overrides, `DotGridConfig`, `toggleTheme` with circle wipe, `resetAll`.
- **ThemeEditor.tsx:** Slide-in panel with 3 tabs (Dot Grid, Light Mode, Dark Mode). Sliders + color pickers.
- **ThemeTransition.tsx:** Expanding circle overlay for theme switch animation.
- **InfiniteCanvas.tsx:** Camera/zoom refs, `applyTransform()`, render loop, `BackgroundRippleEffect` integration.
- **autoLayout.ts:** Deterministic masonry layout engine (`COLS=7`, `GAP_X=90`, `GAP_Y=90`, `CARD_SIZES`).
- **Toolbar.tsx:** Top bar with theme toggle + Theme Editor toggle. Renders ThemeEditor as sibling outside header.
- **PortfolioCard.tsx:** Card with hover lift/shadow/zoom, "View →" pill, theme-aware colors.
- **ProjectDetail.tsx:** Content blocks stack, Lenis scroll, line texture background, padded margins.
- **ProjectEditorPage.tsx:** Admin editor with block reordering and R2 upload.
- **CustomCursor.tsx:** Trailing circle ring cursor.
- **worker/src/index.ts:** Cloudflare Worker API (GET/PUT/DELETE) for R2.
- **r2.ts:** Frontend service for communicating with the Worker.

---

## Conventions and constraints

- **UI skill** (if used): Tailwind defaults, `motion/react` for JS animation, GSAP for spring physics, `cn` for class logic.
- **Performance:** No React state updates on the pan/zoom hot path. Dot grid uses canvas + sparse Map for pushed dots.
- **R2:** Always use the Worker for R2 operations (no direct S3 SDK in frontend).
- **Images:** Uploads go to `project-name/` folders in R2.
- **Theme Editor:** All dot grid config and color overrides stored in ThemeContext; read via refs in animation loops for freshness.

---

*Last updated: Dot grid background with GSAP physics, real-time Theme Editor panel, dark mode with circle wipe transition.*
