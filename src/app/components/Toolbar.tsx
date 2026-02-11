import { useState } from "react";
import { motion } from "motion/react";
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
      className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-6"
      style={{
        height: 70,
        backgroundColor: colors.bgAlpha,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: `1px solid ${colors.border}`,
      }}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.smooth, delay: 0.2 }}
    >
      <div className="flex items-center gap-3">
        {/* Logo / Name */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28,
              height: 28,
              backgroundColor: theme === "light" ? "#1A1A1A" : "#F0F0F0",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill={theme === "light" ? "white" : "#1A1A1A"}/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill={theme === "light" ? "white" : "#1A1A1A"} opacity="0.5"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill={theme === "light" ? "white" : "#1A1A1A"} opacity="0.5"/>
              <rect x="8" y="8" width="5" height="5" rx="1" fill={theme === "light" ? "white" : "#1A1A1A"} opacity="0.3"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, color: colors.text }}>
            Studio Portfolio
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span style={{ fontSize: 13, color: colors.textMuted }}>
          {projectCount} projects
        </span>
        <div
          style={{
            width: 1,
            height: 16,
            backgroundColor: colors.borderLight,
          }}
        />
        <button
          type="button"
          style={{ fontSize: 13, color: colors.textSecondary }}
          className="transition-colors hover:opacity-80"
        >
          About
        </button>
        <button
          type="button"
          style={{ fontSize: 13, color: colors.textSecondary }}
          className="transition-colors hover:opacity-80"
        >
          Contact
        </button>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 16,
            backgroundColor: colors.borderLight,
          }}
        />

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={(e) => toggleTheme(e)}
          className="flex items-center justify-center rounded-full transition-all hover:opacity-80 active:scale-95"
          style={{
            width: 32,
            height: 32,
            backgroundColor: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
          }}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? (
            // Moon icon
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M14 8.5a6 6 0 0 1-7.5 5.8A6 6 0 0 1 4.2 2.5 6 6 0 0 0 14 8.5Z"
                stroke={colors.text}
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            // Sun icon
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke={colors.text} strokeWidth="1.3"/>
              <path
                d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7"
                stroke={colors.text}
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        {/* Theme editor toggle */}
        <button
          type="button"
          onClick={() => setEditorOpen((o) => !o)}
          className="flex items-center justify-center rounded-full transition-all hover:opacity-80 active:scale-95"
          style={{
            width: 32,
            height: 32,
            backgroundColor: editorOpen
              ? (theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)")
              : (theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)"),
          }}
          aria-label="Toggle theme editor"
          title="Theme Editor"
        >
          {/* Sliders / settings icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h3M9 4h5M2 8h7M13 8h1M2 12h1M7 12h7"
              stroke={colors.text}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <circle cx="7" cy="4" r="1.5" stroke={colors.text} strokeWidth="1.2"/>
            <circle cx="11" cy="8" r="1.5" stroke={colors.text} strokeWidth="1.2"/>
            <circle cx="5" cy="12" r="1.5" stroke={colors.text} strokeWidth="1.2"/>
          </svg>
        </button>
      </div>
    </motion.header>

    {/* Theme Editor Panel — rendered outside header so it can fill viewport height */}
    <ThemeEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  );
}
