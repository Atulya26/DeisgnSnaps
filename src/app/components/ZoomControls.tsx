import { motion } from "motion/react";
import { Plus, Minus, Maximize2 } from "lucide-react";
import { springs } from "./animationConfig";
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
  const { colors } = useTheme();

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-40 flex items-center gap-1 rounded-full px-1 py-1"
      style={{
        backgroundColor: colors.surface,
        backdropFilter: "blur(20px)",
        boxShadow: colors.cardShadow,
      }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springs.smooth, delay: 0.8 }}
    >
      {/* Zoom out */}
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        className="flex items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95 disabled:opacity-30"
        style={{ width: 32, height: 32 }}
        aria-label="Zoom out"
      >
        <Minus size={14} color={colors.text} />
      </button>

      {/* Percentage - click to reset */}
      <button
        onClick={onReset}
        className="flex items-center justify-center rounded-full px-2 transition-all hover:opacity-70 active:scale-95"
        style={{
          height: 32,
          minWidth: 48,
          fontSize: 12,
          color: colors.textSecondary,
          letterSpacing: "-0.01em",
        }}
        aria-label="Reset zoom"
        title="Reset zoom"
      >
        {percentage}%
      </button>

      {/* Zoom in */}
      <button
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        className="flex items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95 disabled:opacity-30"
        style={{ width: 32, height: 32 }}
        aria-label="Zoom in"
      >
        <Plus size={14} color={colors.text} />
      </button>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 16,
          backgroundColor: colors.borderLight,
          margin: "0 2px",
        }}
      />

      {/* Fit to view */}
      <button
        onClick={onReset}
        className="flex items-center justify-center rounded-full transition-all hover:opacity-70 active:scale-95"
        style={{ width: 32, height: 32 }}
        aria-label="Fit to view"
        title="Fit to view"
      >
        <Maximize2 size={13} color={colors.textSecondary} />
      </button>
    </motion.div>
  );
}
