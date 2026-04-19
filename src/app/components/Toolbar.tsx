import { Suspense, lazy, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun, SettingsSliders } from "geist-icons";
import { Search } from "lucide-react";
import { springs } from "./animationConfig";
import { useTheme } from "./ThemeContext";

const LazyThemeEditor = lazy(async () => {
  const mod = await import("./ThemeEditor");
  return { default: mod.ThemeEditor };
});

interface ToolbarProps {
  /** Accepted but unused — kept for API stability with App.tsx. */
  projectCount?: number;
  onOpenSearch?: () => void;
  onPrefetchSearch?: () => void;
}

export function Toolbar({ onOpenSearch, onPrefetchSearch }: ToolbarProps) {
  const { theme, colors, toggleTheme, dotGridConfig } = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const accentColor =
    theme === "light" ? dotGridConfig.lightActiveColor : dotGridConfig.darkActiveColor;

  return (
    <>
    <motion.header
      className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between"
      style={{
        height: 64,
        paddingLeft: 24,
        paddingRight: 18,
        backgroundColor: colors.bgAlpha,
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        borderBottom: `1px solid ${colors.border}`,
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
    >
      {/* Left: Wordmark only */}
      <div className="flex items-center">
        <motion.span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          Atulya
        </motion.span>
      </div>

      {/* Right: Nav + controls */}
      <div className="flex items-center gap-1">
        <motion.button
          type="button"
          onClick={onOpenSearch}
          onMouseEnter={onPrefetchSearch}
          onFocus={onPrefetchSearch}
          className="mr-2 hidden items-center gap-3 rounded-full px-4 py-2 transition-all md:flex"
          style={{
            backgroundColor: theme === "light" ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.055)",
            border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)"}`,
          }}
          whileHover={{
            backgroundColor: theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)",
            y: -1,
          }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.36 }}
          aria-label="Open search"
          title="Search (F)"
        >
          <Search size={15} color={accentColor} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              color: colors.textSecondary,
              letterSpacing: "-0.01em",
            }}
          >
            Search archive
          </span>
          <span
            className="rounded-full px-2 py-1"
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              color: colors.textMuted,
              backgroundColor: theme === "light" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.26)",
              border: `1px solid ${colors.border}`,
            }}
          >
            F
          </span>
        </motion.button>

        {/* Nav links — uppercase editorial style */}
        {["About", "Contact"].map((label, i) => (
          <motion.button
            key={label}
            type="button"
            className="relative rounded-full px-5 py-2 transition-colors"
            style={{
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              color: colors.textSecondary,
              letterSpacing: "-0.005em",
            }}
            whileHover={{
              color: colors.text,
              backgroundColor: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.08 }}
          >
            {label}
          </motion.button>
        ))}

        <motion.button
          type="button"
          onClick={onOpenSearch}
          onMouseEnter={onPrefetchSearch}
          onFocus={onPrefetchSearch}
          className="flex items-center justify-center rounded-full transition-all active:scale-95 md:hidden"
          style={{
            width: 34,
            height: 34,
            backgroundColor: "transparent",
          }}
          whileHover={{
            backgroundColor: theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.56 }}
          aria-label="Open search"
          title="Search"
        >
          <Search size={15} color={colors.text} />
        </motion.button>

        {/* Divider */}
        <div
          className="mx-2"
          style={{
            width: 1,
            height: 18,
            backgroundColor: colors.borderLight,
          }}
        />

        {/* Theme toggle — refined pill */}
        <motion.button
          type="button"
          onClick={(e) => toggleTheme(e)}
          className="flex items-center justify-center rounded-full transition-all active:scale-95"
          style={{
            width: 34,
            height: 34,
            backgroundColor: "transparent",
          }}
          whileHover={{
            backgroundColor: theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          <AnimatePresence mode="wait">
            {theme === "light" ? (
              <motion.div
                key="moon"
                initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
                transition={{ duration: 0.25 }}
              >
                <Moon size={15} color={colors.text} />
              </motion.div>
            ) : (
              <motion.div
                key="sun"
                initial={{ opacity: 0, rotate: 30, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: -30, scale: 0.8 }}
                transition={{ duration: 0.25 }}
              >
                <Sun size={15} color={colors.text} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Editor toggle */}
        <motion.button
          type="button"
          onClick={() => setEditorOpen((o) => !o)}
          className="flex items-center justify-center rounded-full transition-all active:scale-95"
          style={{
            width: 34,
            height: 34,
            backgroundColor: editorOpen
              ? (theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)")
              : "transparent",
          }}
          whileHover={{
            backgroundColor: theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.75 }}
          aria-label="Toggle theme editor"
          title="Theme Editor"
        >
          <SettingsSliders size={15} color={colors.text} />
        </motion.button>
      </div>
    </motion.header>

    {/* Theme Editor Panel */}
    {editorOpen && (
      <Suspense fallback={null}>
        <LazyThemeEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
      </Suspense>
    )}
    </>
  );
}
