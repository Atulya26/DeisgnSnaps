import { useState, useRef, memo } from "react";
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

function PortfolioCardImpl({ project, onOpen, skipAnimation, index = 0 }: PortfolioCardProps) {
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
        // NOTE: we intentionally do NOT use content-visibility:auto here.
        // Paint containment clips the card's hover box-shadow at the bottom.
        // Tile-level culling + React.memo already keep scroll smooth.
      }}
      initial={skipAnimation || prefersReduced ? false : { opacity: 0, y: 14, scale: 1.04 }}
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
              src={project.cardImageUrl}
              alt={project.title}
              className="h-full w-full object-cover"
              decoding="async"
              loading={index < 4 ? "eager" : "lazy"}
              // React's peer version here warns on camelCase `fetchPriority`;
              // lowercase is the valid HTML attr and passes through cleanly.
              {...({ fetchpriority: index < 4 ? "high" : "low" } as Record<string, string>)}
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
          className="flex items-center justify-between gap-4 px-6"
          style={{
            backgroundColor: colors.cardBg,
            paddingTop: 18,
            paddingBottom: 18,
          }}
        >
          {/* Title */}
          <h3
            className="truncate"
            style={{
              fontSize: 20,
              color: colors.text,
              lineHeight: 1.25,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {project.title}
          </h3>

          {/* Category — small caps, Inter */}
          {project.category && (
            <span
              className="shrink-0"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: colors.textMuted,
                letterSpacing: "-0.005em",
                fontFamily: "'Inter', sans-serif",
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

// memo: prevents every card from re-rendering when any sibling's image
// loads (setImageLoaded) or when InfiniteCanvas re-renders at tile-key
// boundaries. With ~50–200 cards mounted, this is a real scroll-time win.
export const PortfolioCard = memo(PortfolioCardImpl, (prev, next) => {
  return (
    prev.project === next.project &&
    prev.onOpen === next.onOpen &&
    prev.skipAnimation === next.skipAnimation &&
    prev.index === next.index
  );
});

interface PortfolioCardReplicaProps {
  project: Project;
}

function PortfolioCardReplicaImpl({ project }: PortfolioCardReplicaProps) {
  const { theme, colors, animationConfig } = useTheme();

  return (
    <div
      className="absolute"
      style={{
        left: project.x,
        top: project.y,
        width: project.width,
      }}
      aria-hidden="true"
    >
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: animationConfig.cardBorderRadius,
          backgroundColor: colors.cardBg,
          boxShadow: colors.cardShadow,
          border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)"}`,
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            height: project.height,
            backgroundColor: colors.imageBg,
          }}
        >
          <ImageWithFallback
            src={project.cardImageUrl}
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            {...({ fetchpriority: "low" } as Record<string, string>)}
          />
        </div>

        <div
          className="flex items-center justify-between gap-4 px-6"
          style={{
            backgroundColor: colors.cardBg,
            paddingTop: 18,
            paddingBottom: 18,
          }}
        >
          <h3
            className="truncate"
            style={{
              fontSize: 20,
              color: colors.text,
              lineHeight: 1.25,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {project.title}
          </h3>

          {project.category && (
            <span
              className="shrink-0"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: colors.textMuted,
                letterSpacing: "-0.005em",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {project.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const PortfolioCardReplica = memo(PortfolioCardReplicaImpl, (prev, next) => {
  return prev.project === next.project;
});
