import { useState, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
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

// Hover variants — propagated from parent to children
const imageVariants = {
  idle: { scale: 1 },
  hovered: { scale: 1.03 },
};

const viewVariants = {
  idle: { opacity: 0, x: 4 },
  hovered: { opacity: 1, x: 0 },
};

export function PortfolioCard({ project, onOpen, skipAnimation, index = 0 }: PortfolioCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { colors } = useTheme();

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
      }}
      initial={skipAnimation || prefersReduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={skipAnimation || prefersReduced ? { duration: 0 } : {
        ...springs.bouncy,
        delay: Math.min(index * 0.025, 0.5),
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        className="relative overflow-hidden"
        style={{
          borderRadius: 16,
          backgroundColor: colors.cardBg,
          boxShadow: colors.cardShadow,
        }}
        initial="idle"
        whileHover="hovered"
        animate="idle"
        whileTap={prefersReduced ? undefined : { scale: 0.98 }}
        transition={springs.snappy}
        variants={{
          idle: {
            y: 0,
            boxShadow: colors.cardShadow,
          },
          hovered: {
            y: -5,
            boxShadow: colors.cardShadowHover,
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
          {/* Shimmer placeholder */}
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: colors.shimmer }} />
          )}
          <motion.div
            className="h-full w-full"
            variants={imageVariants}
            transition={springs.smooth}
          >
            <ImageWithFallback
              src={project.imageUrl}
              alt={project.title}
              className="h-full w-full object-cover"
              onLoad={() => setImageLoaded(true)}
              style={{ opacity: imageLoaded ? 1 : 0, transition: "opacity 0.4s ease" }}
            />
          </motion.div>
        </div>

        {/* Title bar — larger, with View + arrow on hover */}
        <motion.div
          className="flex items-center justify-between gap-3 px-4 py-3.5"
          style={{ backgroundColor: colors.cardBg }}
          transition={springs.snappy}
        >
          <h3
            className="truncate"
            style={{
              fontSize: 15,
              color: colors.text,
              lineHeight: 1.35,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {project.title}
          </h3>

          {/* View + arrow — slides in on hover */}
          <motion.div
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5"
            style={{
              fontSize: 12,
              color: colors.text,
              borderColor: colors.borderLight,
              fontWeight: 450,
            }}
            variants={viewVariants}
            transition={springs.snappy}
          >
            <span>View</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
