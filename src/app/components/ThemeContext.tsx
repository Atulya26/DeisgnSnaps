import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";

export type Theme = "light" | "dark";

export interface ThemeColors {
  bg: string;
  bgAlpha: string;
  surface: string;
  surfaceAlpha: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  cardBg: string;
  cardShadow: string;
  cardShadowHover: string;
  shimmer: string;
  imageBg: string;
  gridLine: string;
  /** Ripple line color near the cursor (rgb only, alpha applied separately) */
  rippleColor: { r: number; g: number; b: number };
}

/** Dot grid configuration */
export interface DotGridConfig {
  dotSize: number;
  gap: number;
  proximity: number;
  speedTrigger: number;
  shockRadius: number;
  shockStrength: number;
  maxSpeed: number;
  resistance: number;
  returnDuration: number;
  /** Dot base color per theme */
  lightBaseColor: string;
  lightActiveColor: string;
  darkBaseColor: string;
  darkActiveColor: string;
}

export const defaultDotGridConfig: DotGridConfig = {
  dotSize: 2,
  gap: 20,
  proximity: 110,
  speedTrigger: 100,
  shockRadius: 100,
  shockStrength: 7,
  maxSpeed: 5000,
  resistance: 1200,
  returnDuration: 2,
  lightBaseColor: "#c8c8c8",
  lightActiveColor: "#1a51f4",
  darkBaseColor: "#404040",
  darkActiveColor: "#6e8eff",
};

export const defaultLightColors: ThemeColors = {
  bg: "#F5F3EF",
  bgAlpha: "rgba(245, 243, 239, 0.85)",
  surface: "rgba(255,255,255,0.94)",
  surfaceAlpha: "rgba(255,255,255,0.92)",
  text: "#171717",
  textSecondary: "#636363",
  textMuted: "#999590",
  border: "rgba(0,0,0,0.05)",
  borderLight: "rgba(0,0,0,0.07)",
  cardBg: "#FEFEFE",
  cardShadow: "0 1px 2px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.04)",
  cardShadowHover: "0 8px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
  shimmer: "#E8E4DD",
  imageBg: "#EDEBE6",
  gridLine: "rgba(0,0,0,0.03)",
  rippleColor: { r: 100, g: 95, b: 88 },
};

export const defaultDarkColors: ThemeColors = {
  bg: "#161616",
  bgAlpha: "rgba(22, 22, 22, 0.88)",
  surface: "rgba(32,32,32,0.94)",
  surfaceAlpha: "rgba(32,32,32,0.92)",
  text: "#ECECEC",
  textSecondary: "#8E8E8E",
  textMuted: "#5C5C5C",
  border: "rgba(255,255,255,0.05)",
  borderLight: "rgba(255,255,255,0.07)",
  cardBg: "#1E1E1E",
  cardShadow: "0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)",
  cardShadowHover: "0 12px 40px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2)",
  shimmer: "#2A2A2A",
  imageBg: "#242424",
  gridLine: "rgba(255,255,255,0.035)",
  rippleColor: { r: 180, g: 180, b: 175 },
};

/** Helper: create bgAlpha from a hex bg color */
function hexToBgAlpha(hex: string, alpha = 0.82): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return `rgba(0,0,0,${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

interface TransitionState {
  phase: "idle" | "expanding" | "holding" | "fading";
  x: number;
  y: number;
  toTheme: Theme;
}

interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: (e?: React.MouseEvent) => void;
  transition: TransitionState;
  /** Dot grid config — live-editable */
  dotGridConfig: DotGridConfig;
  setDotGridConfig: (cfg: Partial<DotGridConfig>) => void;
  /** Color overrides */
  lightOverrides: Partial<ThemeColors>;
  darkOverrides: Partial<ThemeColors>;
  setLightOverrides: (o: Partial<ThemeColors>) => void;
  setDarkOverrides: (o: Partial<ThemeColors>) => void;
  /** Reset everything to defaults */
  resetAll: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  colors: defaultLightColors,
  toggleTheme: () => {},
  transition: { phase: "idle", x: 0, y: 0, toTheme: "light" },
  dotGridConfig: defaultDotGridConfig,
  setDotGridConfig: () => {},
  lightOverrides: {},
  darkOverrides: {},
  setLightOverrides: () => {},
  setDarkOverrides: () => {},
  resetAll: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [transition, setTransition] = useState<TransitionState>({
    phase: "idle",
    x: 0,
    y: 0,
    toTheme: "light",
  });
  const transitioning = useRef(false);

  // Editable configs
  const [dotGridConfig, setDotGridConfigState] = useState<DotGridConfig>(defaultDotGridConfig);
  const [lightOverrides, setLightOverridesState] = useState<Partial<ThemeColors>>({});
  const [darkOverrides, setDarkOverridesState] = useState<Partial<ThemeColors>>({});

  const setDotGridConfig = useCallback((cfg: Partial<DotGridConfig>) => {
    setDotGridConfigState((prev) => ({ ...prev, ...cfg }));
  }, []);

  const setLightOverrides = useCallback((o: Partial<ThemeColors>) => {
    setLightOverridesState((prev) => ({ ...prev, ...o }));
  }, []);

  const setDarkOverrides = useCallback((o: Partial<ThemeColors>) => {
    setDarkOverridesState((prev) => ({ ...prev, ...o }));
  }, []);

  const resetAll = useCallback(() => {
    setDotGridConfigState(defaultDotGridConfig);
    setLightOverridesState({});
    setDarkOverridesState({});
  }, []);

  const toggleTheme = useCallback(
    (e?: React.MouseEvent) => {
      if (transitioning.current) return;
      transitioning.current = true;

      const toTheme = theme === "light" ? "dark" : "light";

      let x = window.innerWidth / 2;
      let y = 28;
      if (e) {
        x = e.clientX;
        y = e.clientY;
      }

      setTransition({ phase: "expanding", x, y, toTheme });

      setTimeout(() => {
        setTransition({ phase: "holding", x, y, toTheme });
        setTheme(toTheme);
      }, 400);

      setTimeout(() => {
        setTransition({ phase: "fading", x, y, toTheme });
      }, 500);

      setTimeout(() => {
        setTransition({ phase: "idle", x: 0, y: 0, toTheme: "light" });
        transitioning.current = false;
      }, 900);
    },
    [theme]
  );

  // Merge defaults with overrides; recompute bgAlpha when bg changes
  const colors = useMemo(() => {
    const base = theme === "light" ? defaultLightColors : defaultDarkColors;
    const overrides = theme === "light" ? lightOverrides : darkOverrides;
    const merged = { ...base, ...overrides };

    // If bg was overridden, recompute bgAlpha
    if (overrides.bg) {
      merged.bgAlpha = hexToBgAlpha(overrides.bg, 0.82);
    }
    return merged;
  }, [theme, lightOverrides, darkOverrides]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors,
        toggleTheme,
        transition,
        dotGridConfig,
        setDotGridConfig,
        lightOverrides,
        darkOverrides,
        setLightOverrides,
        setDarkOverrides,
        resetAll,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
