import { useState, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "geist-icons";
import type { Project } from "./types";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { springs } from "./animationConfig";
import { useTheme } from "./ThemeContext";

interface PortfolioCardProps {
  project: Project;
  onOpen: (project: Project, rect: DOMRect) => void;
  skipAnimation?: boolean;
  index?: number;
}

export function PortfolioCard({ project, onOpen, skipAnimation, index = 0 }: PortfolioCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { theme, colors, animationConfig } = useTheme();

  const handleClick = () => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    onOpen(project, rect);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Format index as 2-digit number for visual label
  const displayNum = String(index + 1).padStart(2, "0");

  return (
    <motion.div
      ref={cardRef}
      role="button"
      tabIndex={0}
      className="absolute cursor-pointer"
      style={{
        left: project.x,
        top: project.y,
        width: project.width,
      }}
      initial={skipAnimation || prefersReduced ? false : { opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={skipAnimation || prefersReduced ? { duration: 0 } : {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.03, 0.6),
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        className="group relative overflow-hidden"
        style={{
          borderRadius: animationConfig.cardBorderRadius,
          backgroundColor: colors.cardBg,
          boxShadow: colors.cardShadow,
          border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)"}`,
        }}
        initial="idle"
        whileHover="hovered"
        animate="idle"
        whileTap={prefersReduced ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        variants={{
          idle: {
            y: 0,
            boxShadow: colors.cardShadow,
            borderColor: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
          },
          hovered: {
            y: -animationConfig.cardHoverLift,
            boxShadow: colors.cardShadowHover,
            borderColor: theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)",
          },
        }}
      >
        {/* Image */}
        <div
          className="relative overflow-hidden"
          style={{
            height: project.height,
            backgroundColor: colors.imageBg,
          }}
        >
          {/* Shimmer — pure-CSS animation (see styles/index.css). Avoids
              N infinite motion animations when cards replicate across tiles. */}
          {!imageLoaded && (
            <div
              className="portfolio-card-shimmer absolute inset-0"
              style={{ backgroundColor: colors.shimmer }}
            />
          )}

          <motion.div
            className="h-full w-full"
            variants={{
              idle: { scale: 1 },
              hovered: { scale: animationConfig.cardImageZoom },
            }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <ImageWithFallback
              src={project.imageUrl}
              alt={project.title}
              className="h-full w-full object-cover"
              decoding="async"
              loading={index < 8 ? "eager" : "lazy"}
              fetchPriority={index < 8 ? "high" : "low"}
              onLoad={() => setImageLoaded(true)}
              style={{ opacity: imageLoaded ? 1 : 0, transition: "opacity 0.5s ease" }}
            />
          </motion.div>

          {/* Hover overlay — subtle gradient at bottom */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            variants={{
              idle: { opacity: 0 },
              hovered: { opacity: 1 },
            }}
            transition={{ duration: 0.3 }}
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.12) 0%, transparent 40%)",
            }}
          />

          {/* Arrow icon — appears on hover, top-right */}
          <motion.div
            className="absolute right-3 top-3 flex items-center justify-center rounded-full"
            style={{
              width: 30,
              height: 30,
              backgroundColor: theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.65)",
              backdropFilter: "blur(8px)",
            }}
            variants={{
              idle: { opacity: 0, scale: 0.8, y: 4 },
              hovered: { opacity: 1, scale: 1, y: 0 },
            }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <ArrowUpRight size={14} color={colors.text} />
          </motion.div>
        </div>

        {/* Title bar */}
        <div
          className="flex items-center justify-between gap-3 px-4"
          style={{
            backgroundColor: colors.cardBg,
            paddingTop: 12,
            paddingBottom: 12,
          }}
        >
          {/* Project number + title */}
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span
              style={{
                fontSize: 10,
                fontWeight: 400,
                color: colors.textMuted,
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: "0.02em",
                flexShrink: 0,
                opacity: 0.6,
              }}
            >
              {displayNum}
            </span>
            <h3
              className="truncate"
              style={{
                fontSize: 14,
                color: colors.text,
                lineHeight: 1.3,
                fontWeight: 450,
                letterSpacing: "-0.015em",
              }}
            >
              {project.title}
            </h3>
          </div>

          {/* Category — if present, displayed as small uppercase label */}
          {project.category && (
            <span
              className="shrink-0"
              style={{
                fontSize: 10,
                fontWeight: 400,
                color: colors.textMuted,
                letterSpacing: "0.04em",
                textTransform: "uppercase" as const,
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {project.category}
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
