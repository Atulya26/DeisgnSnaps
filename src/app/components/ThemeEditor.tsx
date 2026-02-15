import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CrossSmall } from "geist-icons";
import {
  useTheme,
  defaultDotGridConfig,
  defaultLightColors,
  defaultDarkColors,
} from "./ThemeContext";

// ── Slider row ──
function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <div className="flex items-center gap-3">
      <span
        className="shrink-0 text-[11px]"
        style={{ color: colors.textSecondary, width: 110 }}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, ${colors.textMuted} 0%, ${colors.textMuted} ${((value - min) / (max - min)) * 100}%, ${colors.border} ${((value - min) / (max - min)) * 100}%, ${colors.border} 100%)`,
        }}
      />
      <span
        className="w-10 text-right font-mono text-[11px]"
        style={{ color: colors.text }}
      >
        {Number.isInteger(step) ? value : value.toFixed(1)}
      </span>
    </div>
  );
}

// ── Color picker row ──
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <div className="flex items-center gap-3">
      <span
        className="shrink-0 text-[11px]"
        style={{ color: colors.textSecondary, width: 110 }}
      >
        {label}
      </span>
      <div className="flex flex-1 items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border-0 p-0"
          style={{
            backgroundColor: "transparent",
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="w-[72px] rounded px-1.5 py-0.5 font-mono text-[11px]"
          style={{
            backgroundColor: colors.border,
            color: colors.text,
            border: `1px solid ${colors.borderLight}`,
          }}
        />
      </div>
    </div>
  );
}

// ── Section header ──
function SectionHeader({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <h3
      className="mt-3 mb-2 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: colors.textMuted }}
    >
      {children}
    </h3>
  );
}

// ── Main Panel ──
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
    resetAll,
  } = useTheme();

  const [tab, setTab] = useState<"dots" | "light" | "dark">("dots");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed right-0 z-50 flex flex-col"
          style={{ width: 320, top: 70, height: "calc(100vh - 70px)" }}
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        >
          {/* Panel background */}
          <div
            className="flex h-full flex-col overflow-hidden rounded-tl-xl"
            style={{
              backgroundColor: colors.cardBg,
              borderLeft: `1px solid ${colors.borderLight}`,
              borderTop: `1px solid ${colors.borderLight}`,
              boxShadow: "-8px 0 30px rgba(0,0,0,0.12)",
            }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-4"
              style={{
                height: 52,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <span
                className="text-[13px] font-semibold"
                style={{ color: colors.text }}
              >
                Theme Editor
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-opacity hover:opacity-70"
                  style={{
                    color: colors.textMuted,
                    border: `1px solid ${colors.borderLight}`,
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: colors.border,
                  }}
                >
                  <CrossSmall size={14} color={colors.textSecondary} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div
              className="flex shrink-0 gap-0 px-4 pt-2"
              style={{ borderBottom: `1px solid ${colors.border}` }}
            >
              {(["dots", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="relative px-3 pb-2 text-[11px] font-medium capitalize transition-colors"
                  style={{
                    color: tab === t ? colors.text : colors.textMuted,
                  }}
                >
                  {t === "dots" ? "Dot Grid" : `${t} Mode`}
                  {tab === t && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ backgroundColor: colors.text }}
                      layoutId="tab-underline"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {/* ── Dot Grid Tab ── */}
              {tab === "dots" && (
                <div className="flex flex-col gap-2">
                  <SectionHeader>Grid</SectionHeader>
                  <SliderRow
                    label="Dot Size"
                    value={dotGridConfig.dotSize}
                    min={1}
                    max={8}
                    onChange={(v) => setDotGridConfig({ dotSize: v })}
                  />
                  <SliderRow
                    label="Gap"
                    value={dotGridConfig.gap}
                    min={8}
                    max={60}
                    onChange={(v) => setDotGridConfig({ gap: v })}
                  />

                  <SectionHeader>Interaction</SectionHeader>
                  <SliderRow
                    label="Proximity"
                    value={dotGridConfig.proximity}
                    min={30}
                    max={300}
                    onChange={(v) => setDotGridConfig({ proximity: v })}
                  />
                  <SliderRow
                    label="Speed Trigger"
                    value={dotGridConfig.speedTrigger}
                    min={20}
                    max={500}
                    onChange={(v) => setDotGridConfig({ speedTrigger: v })}
                  />
                  <SliderRow
                    label="Shock Radius"
                    value={dotGridConfig.shockRadius}
                    min={30}
                    max={300}
                    onChange={(v) => setDotGridConfig({ shockRadius: v })}
                  />
                  <SliderRow
                    label="Shock Strength"
                    value={dotGridConfig.shockStrength}
                    min={1}
                    max={20}
                    onChange={(v) => setDotGridConfig({ shockStrength: v })}
                  />
                  <SliderRow
                    label="Resistance"
                    value={dotGridConfig.resistance}
                    min={100}
                    max={3000}
                    step={50}
                    onChange={(v) => setDotGridConfig({ resistance: v })}
                  />
                  <SliderRow
                    label="Return Duration"
                    value={dotGridConfig.returnDuration}
                    min={0.2}
                    max={5}
                    step={0.1}
                    onChange={(v) => setDotGridConfig({ returnDuration: v })}
                  />

                  <SectionHeader>Dot Colors</SectionHeader>
                  <ColorRow
                    label="Light Base"
                    value={dotGridConfig.lightBaseColor}
                    onChange={(v) => setDotGridConfig({ lightBaseColor: v })}
                  />
                  <ColorRow
                    label="Light Active"
                    value={dotGridConfig.lightActiveColor}
                    onChange={(v) => setDotGridConfig({ lightActiveColor: v })}
                  />
                  <ColorRow
                    label="Dark Base"
                    value={dotGridConfig.darkBaseColor}
                    onChange={(v) => setDotGridConfig({ darkBaseColor: v })}
                  />
                  <ColorRow
                    label="Dark Active"
                    value={dotGridConfig.darkActiveColor}
                    onChange={(v) => setDotGridConfig({ darkActiveColor: v })}
                  />
                </div>
              )}

              {/* ── Light Mode Tab ── */}
              {tab === "light" && (
                <div className="flex flex-col gap-2">
                  <SectionHeader>Background</SectionHeader>
                  <ColorRow
                    label="Background"
                    value={lightOverrides.bg ?? defaultLightColors.bg}
                    onChange={(v) => setLightOverrides({ bg: v })}
                  />

                  <SectionHeader>Cards</SectionHeader>
                  <ColorRow
                    label="Card BG"
                    value={lightOverrides.cardBg ?? defaultLightColors.cardBg}
                    onChange={(v) => setLightOverrides({ cardBg: v })}
                  />
                  <ColorRow
                    label="Image BG"
                    value={lightOverrides.imageBg ?? defaultLightColors.imageBg}
                    onChange={(v) => setLightOverrides({ imageBg: v })}
                  />

                  <SectionHeader>Typography</SectionHeader>
                  <ColorRow
                    label="Text"
                    value={lightOverrides.text ?? defaultLightColors.text}
                    onChange={(v) => setLightOverrides({ text: v })}
                  />
                  <ColorRow
                    label="Secondary"
                    value={lightOverrides.textSecondary ?? defaultLightColors.textSecondary}
                    onChange={(v) => setLightOverrides({ textSecondary: v })}
                  />
                  <ColorRow
                    label="Muted"
                    value={lightOverrides.textMuted ?? defaultLightColors.textMuted}
                    onChange={(v) => setLightOverrides({ textMuted: v })}
                  />

                  <SectionHeader>Surfaces</SectionHeader>
                  <ColorRow
                    label="Shimmer"
                    value={lightOverrides.shimmer ?? defaultLightColors.shimmer}
                    onChange={(v) => setLightOverrides({ shimmer: v })}
                  />
                </div>
              )}

              {/* ── Dark Mode Tab ── */}
              {tab === "dark" && (
                <div className="flex flex-col gap-2">
                  <SectionHeader>Background</SectionHeader>
                  <ColorRow
                    label="Background"
                    value={darkOverrides.bg ?? defaultDarkColors.bg}
                    onChange={(v) => setDarkOverrides({ bg: v })}
                  />

                  <SectionHeader>Cards</SectionHeader>
                  <ColorRow
                    label="Card BG"
                    value={darkOverrides.cardBg ?? defaultDarkColors.cardBg}
                    onChange={(v) => setDarkOverrides({ cardBg: v })}
                  />
                  <ColorRow
                    label="Image BG"
                    value={darkOverrides.imageBg ?? defaultDarkColors.imageBg}
                    onChange={(v) => setDarkOverrides({ imageBg: v })}
                  />

                  <SectionHeader>Typography</SectionHeader>
                  <ColorRow
                    label="Text"
                    value={darkOverrides.text ?? defaultDarkColors.text}
                    onChange={(v) => setDarkOverrides({ text: v })}
                  />
                  <ColorRow
                    label="Secondary"
                    value={darkOverrides.textSecondary ?? defaultDarkColors.textSecondary}
                    onChange={(v) => setDarkOverrides({ textSecondary: v })}
                  />
                  <ColorRow
                    label="Muted"
                    value={darkOverrides.textMuted ?? defaultDarkColors.textMuted}
                    onChange={(v) => setDarkOverrides({ textMuted: v })}
                  />

                  <SectionHeader>Surfaces</SectionHeader>
                  <ColorRow
                    label="Shimmer"
                    value={darkOverrides.shimmer ?? defaultDarkColors.shimmer}
                    onChange={(v) => setDarkOverrides({ shimmer: v })}
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
