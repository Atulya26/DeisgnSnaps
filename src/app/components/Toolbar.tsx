import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun, SettingsSliders } from "geist-icons";
import { springs } from "./animationConfig";
import { useTheme } from "./ThemeContext";
import { ThemeEditor } from "./ThemeEditor";

interface ToolbarProps {
  projectCount: number;
}

export function Toolbar({ projectCount }: ToolbarProps) {
  const { theme, colors, toggleTheme } = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
    <motion.header
      className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between"
      style={{
        height: 70,
        paddingLeft: 28,
        paddingRight: 24,
        backgroundColor: colors.bgAlpha,
        backdropFilter: "blur(28px) saturate(1.5)",
        WebkitBackdropFilter: "blur(28px) saturate(1.5)",
        borderBottom: `1px solid ${colors.border}`,
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
    >
      {/* Left: Logo + brand */}
      <div className="flex items-center gap-4">
        <motion.span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 22,
            fontWeight: 400,
            color: colors.text,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          Atulya
        </motion.span>
        <motion.span
          style={{
            fontSize: 11,
            fontWeight: 400,
            color: colors.textMuted,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            fontFamily: "'Inter', sans-serif",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.45 }}
        >
          {projectCount} Works
        </motion.span>
      </div>

      {/* Right: Nav + controls */}
      <div className="flex items-center gap-1">
        {/* Nav links — uppercase editorial style */}
        {["About", "Contact"].map((label, i) => (
          <motion.button
            key={label}
            type="button"
            className="relative rounded-full px-4 py-1.5 transition-colors"
            style={{
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              color: colors.textSecondary,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
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
    <ThemeEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  );
}
