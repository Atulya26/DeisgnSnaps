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
const CARD_WIDTH = 340;   // uniform card width — clean grid
const GAP_X = 120;        // horizontal gap between columns — generous breathing room
const GAP_Y = 110;        // vertical gap between rows — generous breathing room
const PADDING_LEFT = 60;  // left margin
const PADDING_TOP = 60;   // top margin
const MAX_COLS = 7;       // maximum number of columns

// Height presets — gives visual variety while keeping things tidy
const HEIGHT_PATTERN = [
  280, 340, 260, 380, 300, 260, 320, 360, 280, 300,
  340, 260, 380, 280, 320, 300, 360, 280, 340, 260,
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
