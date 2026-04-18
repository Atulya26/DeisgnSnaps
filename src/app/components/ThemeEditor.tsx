import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CrossSmall, ChevronDown, RotateCounterClockwise, Copy, Play } from "geist-icons";
import {
  useTheme,
  defaultDotGridConfig,
  defaultLightColors,
  defaultDarkColors,
  defaultAnimationConfig,
} from "./ThemeContext";

// ─── Enhanced Slider ───
function DialSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const { colors, theme } = useTheme();
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = ((value - min) / (max - min)) * 100;
  const displayValue = step < 1 ? value.toFixed(2) : step < 10 ? value.toFixed(1) : String(value);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const updateFromPointer = (clientX: number) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const raw = min + ratio * (max - min);
        const snapped = Math.round(raw / step) * step;
        const clamped = Math.max(min, Math.min(max, snapped));
        onChange(Number(clamped.toFixed(10)));
      };
      updateFromPointer(e.clientX);

      const onMove = (ev: PointerEvent) => updateFromPointer(ev.clientX);
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [min, max, step, onChange]
  );

  const accentColor = theme === "light" ? "#1a1a1a" : "#ffffff";
  const trackBg = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
  const fillBg = theme === "light" ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)";

  return (
    <div
      className="group/slider flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
      style={{
        backgroundColor: hovering || dragging
          ? (theme === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)")
          : "transparent",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <span
        className="shrink-0 select-none text-[11px]"
        style={{ color: colors.textSecondary, width: 90 }}
      >
        {label}
      </span>

      <div
        ref={trackRef}
        className="relative h-[6px] flex-1 cursor-pointer rounded-full"
        style={{ backgroundColor: trackBg }}
        onPointerDown={handlePointerDown}
      >
        {/* Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: fillBg, width: `${pct}%` }}
          layout
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />

        {/* Thumb */}
        <motion.div
          className="absolute top-1/2"
          style={{
            left: `${pct}%`,
            width: 14,
            height: 14,
            marginLeft: -7,
            marginTop: -7,
            borderRadius: "50%",
            backgroundColor: accentColor,
            boxShadow: dragging
              ? `0 0 0 4px ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)"}, 0 2px 8px rgba(0,0,0,0.15)`
              : `0 1px 3px rgba(0,0,0,0.2)`,
          }}
          animate={{
            scale: dragging ? 1.3 : hovering ? 1.1 : 1,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />

        {/* Tooltip on drag */}
        <AnimatePresence>
          {dragging && (
            <motion.div
              className="pointer-events-none absolute select-none font-mono text-[10px] font-medium"
              style={{
                left: `${pct}%`,
                bottom: 18,
                transform: "translateX(-50%)",
                backgroundColor: accentColor,
                color: theme === "light" ? "#fff" : "#000",
                padding: "2px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
              }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
            >
              {displayValue}{suffix}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <span
        className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums"
        style={{ color: colors.text }}
      >
        {displayValue}{suffix}
      </span>
    </div>
  );
}

// ─── Color Picker Row (enhanced) ───
function ColorPickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors, theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="group/color flex items-center gap-3 rounded-md px-2 py-1.5">
      <span
        className="shrink-0 text-[11px]"
        style={{ color: colors.textSecondary, width: 90 }}
      >
        {label}
      </span>
      <div className="flex flex-1 items-center gap-2">
        <div className="relative">
          <div
            className="h-6 w-6 rounded-md border"
            style={{
              backgroundColor: value,
              borderColor: theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
            }}
          />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="w-[68px] rounded-md px-1.5 py-0.5 font-mono text-[11px] transition-colors"
          style={{
            backgroundColor: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
            color: colors.text,
            border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
          }}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover/color:opacity-60 hover:!opacity-100"
          title="Copy hex"
        >
          {copied ? (
            <motion.span
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="text-[9px]"
              style={{ color: colors.textMuted }}
            >
              ✓
            </motion.span>
          ) : (
            <Copy size={10} color={colors.textMuted} />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Collapsible Folder ───
function Folder({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { colors, theme } = useTheme();

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors"
        style={{
          color: colors.text,
        }}
      >
        <motion.div
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <ChevronDown size={12} color={colors.textMuted} />
        </motion.div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: colors.textMuted }}>
          {label}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, opacity: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div
              className="ml-2 border-l pl-2 pb-1"
              style={{ borderColor: theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)" }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Spring Curve Visualizer ───
function SpringCurvePreview({
  stiffness,
  damping,
  mass,
}: {
  stiffness: number;
  damping: number;
  mass: number;
}) {
  const { colors, theme } = useTheme();

  const points = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const omega0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    const totalTime = 2.5;
    const steps = 120;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * totalTime;
      let y: number;

      if (zeta < 1) {
        const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
        y = 1 - Math.exp(-zeta * omega0 * t) * (Math.cos(omegaD * t) + (zeta * omega0 / omegaD) * Math.sin(omegaD * t));
      } else if (zeta === 1) {
        y = 1 - (1 + omega0 * t) * Math.exp(-omega0 * t);
      } else {
        const s1 = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
        const s2 = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
        y = 1 - (s1 * Math.exp(s2 * t) - s2 * Math.exp(s1 * t)) / (s1 - s2);
      }
      pts.push({ x: i / steps, y: Math.max(0, Math.min(1.3, y)) });
    }
    return pts;
  }, [stiffness, damping, mass]);

  const svgWidth = 260;
  const svgHeight = 100;
  const padX = 0;
  const padY = 8;
  const plotW = svgWidth - padX * 2;
  const plotH = svgHeight - padY * 2;

  const pathD = points
    .map((p, i) => {
      const x = padX + p.x * plotW;
      const y = padY + plotH - (p.y / 1.3) * plotH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const gridColor = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const curveColor = theme === "light" ? "#1a1a1a" : "#ffffff";

  return (
    <div
      className="mx-2 mt-1 mb-2 overflow-hidden rounded-lg"
      style={{
        backgroundColor: theme === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={`h-${frac}`}
            x1={padX}
            y1={padY + plotH - (frac / 1.3) * plotH}
            x2={padX + plotW}
            y2={padY + plotH - (frac / 1.3) * plotH}
            stroke={gridColor}
            strokeWidth={1}
            strokeDasharray={frac === 1 ? "3 3" : "0"}
          />
        ))}

        {/* Curve */}
        <path d={pathD} fill="none" stroke={curveColor} strokeWidth={2} strokeLinecap="round" />

        {/* Endpoint dot */}
        {points.length > 0 && (
          <circle
            cx={padX + plotW}
            cy={padY + plotH - (points[points.length - 1].y / 1.3) * plotH}
            r={3}
            fill={curveColor}
          />
        )}
      </svg>
    </div>
  );
}

// ─── Action Button (Replay, etc.) ───
function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  const { colors, theme } = useTheme();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="mx-2 mt-1 mb-2 flex w-[calc(100%-16px)] items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium transition-colors"
      style={{
        backgroundColor: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
        color: colors.text,
        border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
      }}
      whileHover={{
        backgroundColor: theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)",
        scale: 1.01,
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {icon}
      {label}
    </motion.button>
  );
}

// ─── Tab Toggle (segmented) ───
type TabKey = "dots" | "colors" | "animation";

function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  const { colors, theme } = useTheme();
  const tabs: { key: TabKey; label: string }[] = [
    { key: "dots", label: "Dot Grid" },
    { key: "colors", label: "Colors" },
    { key: "animation", label: "Motion" },
  ];

  return (
    <div
      className="mx-3 mt-2 mb-1 flex rounded-lg p-0.5"
      style={{
        backgroundColor: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="relative flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
          style={{
            color: active === t.key ? colors.text : colors.textMuted,
          }}
        >
          {active === t.key && (
            <motion.div
              className="absolute inset-0 rounded-md"
              style={{
                backgroundColor: theme === "light" ? "#ffffff" : "rgba(255,255,255,0.1)",
                boxShadow: theme === "light"
                  ? "0 1px 3px rgba(0,0,0,0.08)"
                  : "0 1px 3px rgba(0,0,0,0.3)",
              }}
              layoutId="editor-tab-pill"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Preset Selector ───
function PresetSelector({
  onSelect,
}: {
  onSelect: (preset: string) => void;
}) {
  const { colors, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const presets = ["Default", "Playful", "Minimal", "Dramatic"];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors"
        style={{
          backgroundColor: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
          color: colors.textSecondary,
          border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
        }}
      >
        Presets
        <ChevronDown size={10} color={colors.textMuted} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute left-0 top-full z-50 mt-1 min-w-[120px] overflow-hidden rounded-lg"
            style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-[11px] transition-colors"
                style={{ color: colors.text }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor =
                    theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "transparent";
                }}
              >
                {p}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main ThemeEditor Panel ───
export function ThemeEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    theme,
    colors,
    dotGridConfig,
    setDotGridConfig,
    lightOverrides,
    darkOverrides,
    setLightOverrides,
    setDarkOverrides,
    animationConfig,
    setAnimationConfig,
    resetAll,
  } = useTheme();

  const [tab, setTab] = useState<TabKey>("dots");
  const [replayKey, setReplayKey] = useState(0);

  const handlePreset = (preset: string) => {
    switch (preset) {
      case "Playful":
        setAnimationConfig({
          cardHoverScale: 1.08,
          cardHoverLift: 8,
          cardBorderRadius: 20,
          cardImageZoom: 1.08,
          transitionStiffness: 300,
          transitionDamping: 15,
          transitionMass: 0.6,
          panelSpringDuration: 0.6,
          panelSpringBounce: 0.15,
        });
        break;
      case "Minimal":
        setAnimationConfig({
          cardHoverScale: 1.01,
          cardHoverLift: 2,
          cardBorderRadius: 8,
          cardImageZoom: 1.01,
          transitionStiffness: 400,
          transitionDamping: 35,
          transitionMass: 1,
          panelSpringDuration: 0.35,
          panelSpringBounce: 0,
        });
        break;
      case "Dramatic":
        setAnimationConfig({
          cardHoverScale: 1.06,
          cardHoverLift: 12,
          cardBorderRadius: 24,
          cardImageZoom: 1.12,
          transitionStiffness: 200,
          transitionDamping: 18,
          transitionMass: 0.8,
          panelSpringDuration: 0.8,
          panelSpringBounce: 0.2,
        });
        break;
      default:
        setAnimationConfig({ ...defaultAnimationConfig });
        break;
    }
  };

  const currentColorOverrides = theme === "light" ? lightOverrides : darkOverrides;
  const currentDefaults = theme === "light" ? defaultLightColors : defaultDarkColors;
  const setCurrentOverrides = theme === "light" ? setLightOverrides : setDarkOverrides;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed right-0 z-50 flex flex-col"
          style={{ width: 330, top: 70, height: "calc(100vh - 70px)" }}
          initial={{ x: 340, opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{
            type: "spring",
            visualDuration: animationConfig.panelSpringDuration,
            bounce: animationConfig.panelSpringBounce,
          }}
        >
          <div
            className="flex h-full flex-col overflow-hidden rounded-tl-2xl"
            style={{
              backgroundColor: colors.cardBg,
              borderLeft: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
              borderTop: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
              boxShadow: theme === "light"
                ? "-12px 0 40px rgba(0,0,0,0.08)"
                : "-12px 0 40px rgba(0,0,0,0.3)",
              backdropFilter: "blur(40px) saturate(1.2)",
            }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-4"
              style={{
                height: 52,
                borderBottom: `1px solid ${theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"}`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-[13px] font-semibold tracking-tight"
                  style={{ color: colors.text }}
                >
                  Theme Editor
                </span>
                <PresetSelector onSelect={handlePreset} />
              </div>
              <div className="flex items-center gap-1.5">
                <motion.button
                  type="button"
                  onClick={resetAll}
                  className="flex h-7 items-center justify-center gap-1 rounded-md px-2 text-[10px] font-medium uppercase tracking-wide"
                  style={{
                    color: colors.textMuted,
                    border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <RotateCounterClockwise size={10} color={colors.textMuted} />
                  Reset
                </motion.button>
                <motion.button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                  }}
                  whileHover={{ scale: 1.05, backgroundColor: theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)" }}
                  whileTap={{ scale: 0.92 }}
                >
                  <CrossSmall size={14} color={colors.textSecondary} />
                </motion.button>
              </div>
            </div>

            {/* Tab Bar */}
            <TabBar active={tab} onChange={setTab} />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "thin" }}>
              <AnimatePresence mode="wait">
                {/* ── Dot Grid Tab ── */}
                {tab === "dots" && (
                  <motion.div
                    key="dots"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Folder label="Grid">
                      <DialSlider
                        label="Dot Size"
                        value={dotGridConfig.dotSize}
                        min={1} max={8} step={1}
                        onChange={(v) => setDotGridConfig({ dotSize: v })}
                        suffix="px"
                      />
                      <DialSlider
                        label="Gap"
                        value={dotGridConfig.gap}
                        min={8} max={60} step={1}
                        onChange={(v) => setDotGridConfig({ gap: v })}
                        suffix="px"
                      />
                    </Folder>

                    <Folder label="Interaction">
                      <DialSlider
                        label="Proximity"
                        value={dotGridConfig.proximity}
                        min={30} max={300} step={5}
                        onChange={(v) => setDotGridConfig({ proximity: v })}
                        suffix="px"
                      />
                      <DialSlider
                        label="Speed Trigger"
                        value={dotGridConfig.speedTrigger}
                        min={20} max={500} step={10}
                        onChange={(v) => setDotGridConfig({ speedTrigger: v })}
                      />
                      <DialSlider
                        label="Shock Radius"
                        value={dotGridConfig.shockRadius}
                        min={30} max={300} step={5}
                        onChange={(v) => setDotGridConfig({ shockRadius: v })}
                        suffix="px"
                      />
                      <DialSlider
                        label="Shock Force"
                        value={dotGridConfig.shockStrength}
                        min={1} max={20} step={1}
                        onChange={(v) => setDotGridConfig({ shockStrength: v })}
                      />
                      <DialSlider
                        label="Resistance"
                        value={dotGridConfig.resistance}
                        min={100} max={3000} step={50}
                        onChange={(v) => setDotGridConfig({ resistance: v })}
                      />
                      <DialSlider
                        label="Return Time"
                        value={dotGridConfig.returnDuration}
                        min={0.2} max={5} step={0.1}
                        onChange={(v) => setDotGridConfig({ returnDuration: v })}
                        suffix="s"
                      />
                    </Folder>

                    <Folder label="Dot Colors">
                      <ColorPickerRow
                        label="Light Base"
                        value={dotGridConfig.lightBaseColor}
                        onChange={(v) => setDotGridConfig({ lightBaseColor: v })}
                      />
                      <ColorPickerRow
                        label="Light Active"
                        value={dotGridConfig.lightActiveColor}
                        onChange={(v) => setDotGridConfig({ lightActiveColor: v })}
                      />
                      <ColorPickerRow
                        label="Dark Base"
                        value={dotGridConfig.darkBaseColor}
                        onChange={(v) => setDotGridConfig({ darkBaseColor: v })}
                      />
                      <ColorPickerRow
                        label="Dark Active"
                        value={dotGridConfig.darkActiveColor}
                        onChange={(v) => setDotGridConfig({ darkActiveColor: v })}
                      />
                    </Folder>
                  </motion.div>
                )}

                {/* ── Colors Tab ── */}
                {tab === "colors" && (
                  <motion.div
                    key="colors"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-md px-2 py-1" style={{
                      backgroundColor: theme === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
                    }}>
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: theme === "light" ? "#f59e0b" : "#818cf8" }}
                      />
                      <span className="text-[10px] font-medium" style={{ color: colors.textMuted }}>
                        Editing {theme === "light" ? "Light" : "Dark"} Mode — toggle theme to edit the other
                      </span>
                    </div>

                    <Folder label="Background">
                      <ColorPickerRow
                        label="Background"
                        value={currentColorOverrides.bg ?? currentDefaults.bg}
                        onChange={(v) => setCurrentOverrides({ bg: v })}
                      />
                    </Folder>

                    <Folder label="Cards">
                      <ColorPickerRow
                        label="Card BG"
                        value={currentColorOverrides.cardBg ?? currentDefaults.cardBg}
                        onChange={(v) => setCurrentOverrides({ cardBg: v })}
                      />
                      <ColorPickerRow
                        label="Image BG"
                        value={currentColorOverrides.imageBg ?? currentDefaults.imageBg}
                        onChange={(v) => setCurrentOverrides({ imageBg: v })}
                      />
                    </Folder>

                    <Folder label="Typography">
                      <ColorPickerRow
                        label="Text"
                        value={currentColorOverrides.text ?? currentDefaults.text}
                        onChange={(v) => setCurrentOverrides({ text: v })}
                      />
                      <ColorPickerRow
                        label="Secondary"
                        value={currentColorOverrides.textSecondary ?? currentDefaults.textSecondary}
                        onChange={(v) => setCurrentOverrides({ textSecondary: v })}
                      />
                      <ColorPickerRow
                        label="Muted"
                        value={currentColorOverrides.textMuted ?? currentDefaults.textMuted}
                        onChange={(v) => setCurrentOverrides({ textMuted: v })}
                      />
                    </Folder>

                    <Folder label="Surfaces">
                      <ColorPickerRow
                        label="Shimmer"
                        value={currentColorOverrides.shimmer ?? currentDefaults.shimmer}
                        onChange={(v) => setCurrentOverrides({ shimmer: v })}
                      />
                    </Folder>
                  </motion.div>
                )}

                {/* ── Animation Tab ── */}
                {tab === "animation" && (
                  <motion.div
                    key="animation"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Folder label="Transition Spring">
                      <SpringCurvePreview
                        stiffness={animationConfig.transitionStiffness}
                        damping={animationConfig.transitionDamping}
                        mass={animationConfig.transitionMass}
                      />
                      <DialSlider
                        label="Stiffness"
                        value={animationConfig.transitionStiffness}
                        min={50} max={600} step={10}
                        onChange={(v) => setAnimationConfig({ transitionStiffness: v })}
                      />
                      <DialSlider
                        label="Damping"
                        value={animationConfig.transitionDamping}
                        min={5} max={60} step={1}
                        onChange={(v) => setAnimationConfig({ transitionDamping: v })}
                      />
                      <DialSlider
                        label="Mass"
                        value={animationConfig.transitionMass}
                        min={0.1} max={3} step={0.1}
                        onChange={(v) => setAnimationConfig({ transitionMass: v })}
                      />
                    </Folder>

                    <Folder label="Card Hover">
                      {/* Live preview card */}
                      <div className="mx-2 mt-1 mb-2">
                        <motion.div
                          key={replayKey}
                          className="overflow-hidden"
                          style={{
                            borderRadius: animationConfig.cardBorderRadius,
                            backgroundColor: theme === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
                          }}
                          initial="idle"
                          whileHover="hovered"
                        >
                          <motion.div
                            className="flex items-center justify-center"
                            style={{ height: 64 }}
                            variants={{
                              idle: { scale: 1, y: 0 },
                              hovered: {
                                scale: animationConfig.cardHoverScale,
                                y: -animationConfig.cardHoverLift,
                              },
                            }}
                            transition={{
                              type: "spring",
                              stiffness: animationConfig.transitionStiffness,
                              damping: animationConfig.transitionDamping,
                              mass: animationConfig.transitionMass,
                            }}
                          >
                            <span className="text-[10px] font-medium" style={{ color: colors.textMuted }}>
                              Hover me to preview
                            </span>
                          </motion.div>
                        </motion.div>
                      </div>

                      <DialSlider
                        label="Hover Scale"
                        value={animationConfig.cardHoverScale}
                        min={1} max={1.2} step={0.01}
                        onChange={(v) => setAnimationConfig({ cardHoverScale: v })}
                        suffix="×"
                      />
                      <DialSlider
                        label="Hover Lift"
                        value={animationConfig.cardHoverLift}
                        min={0} max={20} step={1}
                        onChange={(v) => setAnimationConfig({ cardHoverLift: v })}
                        suffix="px"
                      />
                      <DialSlider
                        label="Image Zoom"
                        value={animationConfig.cardImageZoom}
                        min={1} max={1.2} step={0.01}
                        onChange={(v) => setAnimationConfig({ cardImageZoom: v })}
                        suffix="×"
                      />
                      <DialSlider
                        label="Border Radius"
                        value={animationConfig.cardBorderRadius}
                        min={0} max={32} step={1}
                        onChange={(v) => setAnimationConfig({ cardBorderRadius: v })}
                        suffix="px"
                      />
                    </Folder>

                    <Folder label="Panel Spring">
                      <DialSlider
                        label="Duration"
                        value={animationConfig.panelSpringDuration}
                        min={0.1} max={1.5} step={0.05}
                        onChange={(v) => setAnimationConfig({ panelSpringDuration: v })}
                        suffix="s"
                      />
                      <DialSlider
                        label="Bounce"
                        value={animationConfig.panelSpringBounce}
                        min={0} max={0.5} step={0.01}
                        onChange={(v) => setAnimationConfig({ panelSpringBounce: v })}
                      />
                    </Folder>

                    <ActionButton
                      label="Replay Entrance"
                      icon={<Play size={12} color={colors.text} />}
                      onClick={() => setReplayKey((k) => k + 1)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div
              className="flex shrink-0 items-center justify-between px-4"
              style={{
                height: 40,
                borderTop: `1px solid ${theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"}`,
              }}
            >
              <span className="text-[10px] font-medium" style={{ color: colors.textMuted }}>
                {theme === "light" ? "☀ Light" : "● Dark"} Mode
              </span>
              <span className="font-mono text-[9px]" style={{ color: colors.textMuted, opacity: 0.6 }}>
                All changes are live
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
