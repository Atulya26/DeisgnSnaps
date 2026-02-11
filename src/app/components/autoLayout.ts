import type { Project } from "./types";

/**
 * Auto-layout engine for the infinite canvas.
 *
 * Distributes projects in an evenly-spaced masonry grid with varied card sizes.
 * Equal-weighted spacing: column gaps and row gaps are visually balanced.
 * Deterministic — same input always produces the same output.
 */

// ── Layout constants ──
const GAP_X = 90;  // horizontal gap between columns
const GAP_Y = 90;  // vertical gap between rows — equal to horizontal for uniform feel
const PADDING_LEFT = 30; // left margin — kept small so tile seams look seamless
const PADDING_TOP = 30;  // top margin — kept small so tile seams look seamless
const COLS = 7;    // number of columns

// Card size presets — gives visual variety
const CARD_SIZES: { width: number; height: number }[] = [
  { width: 380, height: 280 },
  { width: 340, height: 400 },
  { width: 420, height: 300 },
  { width: 360, height: 260 },
  { width: 400, height: 290 },
  { width: 340, height: 250 },
  { width: 370, height: 280 },
  { width: 360, height: 420 },
  { width: 380, height: 280 },
  { width: 320, height: 390 },
  { width: 400, height: 300 },
  { width: 350, height: 420 },
];

// Deterministic size based on index
function seededSize(index: number): { width: number; height: number } {
  return CARD_SIZES[index % CARD_SIZES.length];
}

// Each column's center is spaced evenly; cards are centered within their column.
// Column center spacing = max card width (420) + GAP_X
const COL_CENTER_SPACING = 420 + GAP_X;

/**
 * Compute x, y, width, height for every project.
 * Uses a "shortest column" masonry approach with cards centered in their column.
 */
export function autoLayoutProjects(
  projects: Omit<Project, "x" | "y" | "width" | "height">[]
): Project[] {
  // Track the bottom edge of each column
  const colHeights = new Array(COLS).fill(PADDING_TOP);

  return projects.map((project, index) => {
    const size = seededSize(index);

    // Find the shortest column
    let minCol = 0;
    let minHeight = colHeights[0];
    for (let c = 1; c < COLS; c++) {
      if (colHeights[c] < minHeight) {
        minHeight = colHeights[c];
        minCol = c;
      }
    }

    // Center the card within its column slot
    const colCenterX = PADDING_LEFT + (420 / 2) + minCol * COL_CENTER_SPACING;
    const x = colCenterX - size.width / 2;
    const y = colHeights[minCol];

    // Update the column height (card height + title bar ~48px + vertical gap)
    colHeights[minCol] = y + size.height + 48 + GAP_Y;

    return {
      ...project,
      x,
      y,
      width: size.width,
      height: size.height,
    } as Project;
  });
}
