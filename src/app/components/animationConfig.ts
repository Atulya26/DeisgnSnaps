// Shared animation presets for consistent, organic motion across the app.
// Springs model physical behavior — different weights for different element types.

export const springs = {
  // Large elements: modals, hero images, page transitions
  gentle: { type: "spring" as const, stiffness: 200, damping: 28, mass: 1 },
  // Small interactive elements: buttons, tags, navigation
  snappy: { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 },
  // Playful micro-interactions: hover lifts, card reveals
  bouncy: { type: "spring" as const, stiffness: 300, damping: 20, mass: 0.6 },
  // Canvas/zoom: fast settle, no overshoot
  smooth: { type: "spring" as const, stiffness: 150, damping: 25, mass: 1 },
};

// Duration-based easings for opacity-only fades (springs don't work well for pure opacity)
export const easings = {
  fade: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
  slowFade: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
};
