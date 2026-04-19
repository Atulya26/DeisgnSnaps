import type { Project } from "./types";

// Shared card footprint used by the infinite canvas, layout bounds, and
// lightweight replica tiles. This needs to reflect the actual rendered
// home-card chrome, not just the image area.
export const HOME_CARD_TITLE_BAR_HEIGHT = 64;

export function getHomeCardRenderedHeight(project: Pick<Project, "height">) {
  return project.height + HOME_CARD_TITLE_BAR_HEIGHT;
}
