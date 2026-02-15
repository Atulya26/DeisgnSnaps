import { motion } from "motion/react";
import { Plus, Minus, Fullscreen } from "geist-icons";
import { useTheme } from "./ThemeContext";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  minZoom: number;
  maxZoom: number;
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  minZoom,
  maxZoom,
}: ZoomControlsProps) {
  const percentage = Math.round(zoom * 100);
  const { colors, theme } = useTheme();

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-40 flex items-center gap-0.5 rounded-full px-1 py-1"
      style={{
        backgroundColor: colors.surface,
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        boxShadow: theme === "light"
          ? "0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)"
          : "0 2px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.9 }}
    >
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        className="flex items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95 disabled:opacity-25"
        style={{ width: 30, height: 30 }}
        aria-label="Zoom out"
      >
        <Minus size={13} color={colors.textSecondary} />
      </button>

      <button
        onClick={onReset}
        className="flex items-center justify-center rounded-full px-1 transition-all hover:opacity-70 active:scale-95"
        style={{
          height: 30,
          minWidth: 44,
          fontSize: 11,
          color: colors.textMuted,
          letterSpacing: "0.02em",
          fontFamily: "'Geist Mono', monospace",
          fontWeight: 400,
        }}
        aria-label="Reset zoom"
        title="Reset zoom"
      >
        {percentage}%
      </button>

      <button
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        className="flex items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95 disabled:opacity-25"
        style={{ width: 30, height: 30 }}
        aria-label="Zoom in"
      >
        <Plus size={13} color={colors.textSecondary} />
      </button>

      <div
        style={{
          width: 1,
          height: 14,
          backgroundColor: colors.borderLight,
          margin: "0 2px",
        }}
      />

      <button
        onClick={onReset}
        className="flex items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95"
        style={{ width: 30, height: 30 }}
        aria-label="Fit to view"
        title="Fit to view"
      >
        <Fullscreen size={12} color={colors.textMuted} />
      </button>
    </motion.div>
  );
}
