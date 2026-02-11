import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeContext";

/**
 * Custom cursor: default system pointer remains visible,
 * with a trailing circle ring (stroke-only) that follows the mouse.
 * Ring color adapts to current theme.
 */
export function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100 });
  const smoothPos = useRef({ x: -100, y: -100 });
  const visible = useRef(false);
  const rafRef = useRef(0);
  const isPointer = useRef(false);
  const isPressed = useRef(false);
  const { theme } = useTheme();

  // Store theme in a ref so the rAF loop reads the latest value
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    if (
      "ontouchstart" in window &&
      !window.matchMedia("(pointer: fine)").matches
    ) {
      return;
    }

    const handleMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };

      if (!visible.current) {
        visible.current = true;
        smoothPos.current = { x: e.clientX, y: e.clientY };
      }

      const target = e.target as HTMLElement;
      const clickable = target.closest(
        "a, button, [role='button'], input, textarea, select, [tabindex]"
      );
      isPointer.current = !!clickable;
    };

    const handleLeave = () => {
      visible.current = false;
    };

    const handleDown = () => {
      isPressed.current = true;
    };

    const handleUp = () => {
      isPressed.current = false;
    };

    const tick = () => {
      const sp = smoothPos.current;
      const p = pos.current;

      sp.x += (p.x - sp.x) * 0.12;
      sp.y += (p.y - sp.y) * 0.12;

      const ring = ringRef.current;
      if (ring) {
        ring.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, -50%)`;
        ring.style.opacity = visible.current ? "1" : "0";

        let size: number;
        if (isPressed.current) {
          size = 24;
        } else if (isPointer.current) {
          size = 56;
        } else {
          size = 36;
        }
        ring.style.width = `${size}px`;
        ring.style.height = `${size}px`;

        // Adapt ring color to theme
        const isDark = themeRef.current === "dark";
        const baseColor = isDark ? "rgba(255, 255, 255," : "rgba(26, 26, 26,";
        ring.style.borderColor = isPointer.current
          ? `${baseColor}0.5)`
          : `${baseColor}0.25)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("mouseup", handleUp);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("mouseup", handleUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={ringRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "1.5px solid rgba(26, 26, 26, 0.25)",
        backgroundColor: "transparent",
        pointerEvents: "none",
        zIndex: 9999,
        opacity: 0,
        transition:
          "width 0.25s cubic-bezier(0.16,1,0.3,1), height 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease, opacity 0.2s ease",
        willChange: "transform",
      }}
    />
  );
}
