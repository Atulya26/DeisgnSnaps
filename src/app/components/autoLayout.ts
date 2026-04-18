import type { Project } from "./types";

/**
 * Auto-layout engine for the infinite canvas.
 *
 * Distributes projects in a clean masonry grid that works well with any
 * number of projects (1 to 100+). Cards have uniform width per column
 * with varied heights for visual interest.
 *
 * Key principles:
 *   - Column count adapts to project count (fewer projects = fewer columns)
 *   - Uniform card width within each column (no "floating" cards)
 *   - Height variety from a repeating pattern for visual rhythm
 *   - Shortest-column placement for balanced masonry
 *   - Deterministic — same input always produces the same output
 */

// ── Layout constants ──
// Tier 5: cards scaled up ~30% for a UI-showcase portfolio feel. Gaps
// scale proportionally so density stays similar at DEFAULT_ZOOM=0.60.
const CARD_WIDTH = 440;   // uniform card width — bigger, reads well at 60% zoom
const GAP_X = 140;        // horizontal gap between columns
const GAP_Y = 130;        // vertical gap between rows
const PADDING_LEFT = 80;  // left margin
const PADDING_TOP = 80;   // top margin
const MAX_COLS = 7;       // maximum number of columns

// Height presets — gives visual variety while keeping things tidy
const HEIGHT_PATTERN = [
  360, 440, 340, 500, 390, 340, 420, 470, 360, 390,
  440, 340, 500, 360, 420, 390, 470, 360, 440, 340,
];

/**
 * Determine optimal column count based on project count.
 * Aims for roughly 5-8 rows per column so the grid never looks too sparse.
 */
function getColumnCount(projectCount: number): number {
  if (projectCount <= 3) return projectCount;
  if (projectCount <= 8) return 3;
  if (projectCount <= 15) return 4;
  if (projectCount <= 24) return 5;
  if (projectCount <= 35) return 6;
  return MAX_COLS;
}

/**
 * Compute x, y, width, height for every project.
 * Uses a "shortest column" masonry approach with uniform-width cards.
 */
export function autoLayoutProjects(
  projects: Omit<Project, "x" | "y" | "width" | "height">[]
): Project[] {
  const count = projects.length;
  if (count === 0) return [];

  const cols = getColumnCount(count);

  // Track the bottom edge of each column
  const colHeights = new Array(cols).fill(PADDING_TOP);

  return projects.map((project, index) => {
    const height = HEIGHT_PATTERN[index % HEIGHT_PATTERN.length];

    // Find the shortest column
    let minCol = 0;
    let minHeight = colHeights[0];
    for (let c = 1; c < cols; c++) {
      if (colHeights[c] < minHeight) {
        minHeight = colHeights[c];
        minCol = c;
      }
    }

    const x = PADDING_LEFT + minCol * (CARD_WIDTH + GAP_X);
    const y = colHeights[minCol];

    // Update the column height (card height + gap)
    colHeights[minCol] = y + height + GAP_Y;

    return {
      ...project,
      x,
      y,
      width: CARD_WIDTH,
      height,
    } as Project;
  });
}

/** Tight bounding box of an already-laid-out project set. */
export function getLayoutBounds(projects: Project[]) {
  if (projects.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of projects) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x + p.width > maxX) maxX = p.x + p.width;
    if (p.y + p.height > maxY) maxY = p.y + p.height;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Initial camera position that centers the masonry in the visible canvas area
 * at the given zoom. Shared between `InfiniteCanvas` (seed refs) and
 * `BootSequence` (scatter-target calculation) so the boot handoff is pixel-
 * perfect on any viewport size.
 *
 * `topInset` accounts for a fixed overlay (e.g. translucent toolbar) sitting
 * on top of the canvas: viewport.height is the full container height, and
 * content is centered in the REMAINING visible area below the inset.
 */
export function computeInitialCamera(
  projects: Project[],
  viewport: { width: number; height: number },
  zoom: number,
  topInset: number = 0
) {
  if (projects.length === 0) return { x: -60, y: -40 };
  const { minX, minY, maxX, maxY } = getLayoutBounds(projects);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    x: centerX - viewport.width / (2 * zoom),
    // Place the content center at the midpoint of the visible area
    // (topInset .. viewport.height). Derivation: (centerY - cam.y) * zoom
    // should equal topInset + (viewport.height - topInset) / 2.
    y: centerY - (viewport.height + topInset) / (2 * zoom),
  };
}
