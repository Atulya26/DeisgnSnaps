import { useTheme } from "./ThemeContext";

/**
 * Expanding circle overlay for theme transitions.
 *
 * Phases:
 *   1. "expanding" — circle scales from 0 to full, covering viewport
 *   2. "holding"   — circle stays full while theme switches underneath (no flash)
 *   3. "fading"    — circle fades out, revealing the new theme
 */
export function ThemeTransition() {
  const { transition } = useTheme();

  if (transition.phase === "idle") return null;

  const maxX = Math.max(transition.x, window.innerWidth - transition.x);
  const maxY = Math.max(transition.y, window.innerHeight - transition.y);
  const radius = Math.sqrt(maxX * maxX + maxY * maxY);

  const bgColor = transition.toTheme === "dark" ? "#1A1A1A" : "#F7F6F3";

  // Determine styles based on phase
  let circleStyle: React.CSSProperties;

  if (transition.phase === "expanding") {
    circleStyle = {
      transform: "scale(0)",
      opacity: 1,
      animation: "theme-expand 0.4s cubic-bezier(0.4, 0, 0.15, 1) forwards",
    };
  } else if (transition.phase === "holding") {
    circleStyle = {
      transform: "scale(1)",
      opacity: 1,
    };
  } else {
    // fading
    circleStyle = {
      transform: "scale(1)",
      opacity: 1,
      animation: "theme-fade 0.4s ease-out forwards",
    };
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: transition.x,
          top: transition.y,
          width: radius * 2,
          height: radius * 2,
          marginLeft: -radius,
          marginTop: -radius,
          borderRadius: "50%",
          backgroundColor: bgColor,
          willChange: "transform, opacity",
          ...circleStyle,
        }}
      />

      <style>{`
        @keyframes theme-expand {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
        @keyframes theme-fade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
