import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Dribbble,
  ExternalLink,
  FileText,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  Twitter,
} from "lucide-react";
import { BackgroundRippleEffect } from "./BackgroundRippleEffect";
import { useTheme } from "./ThemeContext";

interface ContactPageProps {
  open: boolean;
  onClose: () => void;
}

const contactActions = [
  {
    label: "Email",
    detail: "Say hello",
    href: "mailto:atulya2612@gmail.com",
    icon: Mail,
  },
  {
    label: "LinkedIn",
    detail: "Profile",
    href: "https://www.linkedin.com/in/atulya26?utm_source=share_via&utm_content=profile&utm_medium=member_ios",
    icon: Linkedin,
  },
  {
    label: "Dribbble",
    detail: "Shots",
    href: "https://dribbble.com/Atulya_26",
    icon: Dribbble,
  },
  {
    label: "Behance",
    detail: "Work",
    href: "https://www.behance.net/atulya_",
    icon: ExternalLink,
  },
  {
    label: "X",
    detail: "Notes",
    href: "https://x.com/atulya26at?s=21",
    icon: Twitter,
  },
  {
    label: "Medium",
    detail: "Writing",
    href: "https://medium.com/@Atulya_",
    icon: FileText,
  },
  {
    label: "GitHub",
    detail: "Personal",
    href: "https://github.com/Atulya26",
    icon: Github,
  },
  {
    label: "Innovaccer GitHub",
    detail: "Work",
    href: "https://github.com/atulya-innovaccer",
    icon: Github,
  },
];

const contributionCharts = [
  {
    label: "Personal",
    user: "Atulya26",
  },
  {
    label: "Innovaccer",
    user: "atulya-innovaccer",
  },
];

const focusAreas = [
  "Product systems",
  "Healthcare UX",
  "Dashboards",
  "Interface prototypes",
  "Design systems",
];

function hexToRgba(hex: string, alpha: number) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ContactPage({ open, onClose }: ContactPageProps) {
  const { colors, theme, dotGridConfig } = useTheme();
  const pageRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);
  const cameraRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const accentColor =
    theme === "light" ? dotGridConfig.lightActiveColor : dotGridConfig.darkActiveColor;
  const chartColor = accentColor.replace("#", "");
  const surface = theme === "light" ? "rgba(255,255,255,0.84)" : "rgba(30,30,30,0.86)";
  const elevatedSurface = theme === "light" ? "rgba(255,255,255,0.94)" : "rgba(36,36,36,0.9)";
  const cardBorder = colors.borderLight;
  const animateOut = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    const page = pageRef.current;
    const animatedItems = [
      headerRef.current,
      heroRef.current,
      profileRef.current,
      actionsRef.current,
      chartsRef.current,
    ].filter(Boolean);

    if (!page || prefersReducedMotion) {
      onClose();
      return;
    }

    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(animatedItems, {
      opacity: 0,
      y: -10,
      scale: 0.992,
      duration: 0.26,
      stagger: 0.025,
      ease: "power2.out",
    });
    tl.to(page, { yPercent: 105, duration: 0.78, ease: "power4.inOut" }, 0.04);
  }, [onClose, prefersReducedMotion]);

  useEffect(() => {
    if (!open) return;
    isClosingRef.current = false;

    const page = pageRef.current;
    const sweep = sweepRef.current;
    const header = headerRef.current;
    const hero = heroRef.current;
    const profile = profileRef.current;
    const actions = actionsRef.current;
    const charts = chartsRef.current;
    if (!page || !sweep || !header || !hero || !profile || !actions || !charts) return;

    if (prefersReducedMotion) {
      gsap.set(page, { yPercent: 0, opacity: 1 });
      gsap.set([sweep, header, hero, profile, actions, charts], { clearProps: "all" });
      return;
    }

    const actionCards = gsap.utils.toArray<HTMLElement>("[data-contact-action]");
    const infoCards = gsap.utils.toArray<HTMLElement>("[data-contact-info]");
    const chartsCards = gsap.utils.toArray<HTMLElement>("[data-contact-chart]");
    const focusPills = gsap.utils.toArray<HTMLElement>("[data-contact-focus]");

    gsap.set(page, { yPercent: 100, opacity: 1 });
    gsap.set(sweep, { yPercent: 0 });
    gsap.set(header, { opacity: 0, y: -14 });
    gsap.set(hero, { opacity: 0, y: 28, filter: "blur(10px)" });
    gsap.set([profile, actions, charts], { opacity: 0, y: 22 });
    gsap.set([...actionCards, ...infoCards, ...chartsCards, ...focusPills], { opacity: 0, y: 16 });

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.to(page, { yPercent: 0, duration: 0.72, ease: "power4.inOut" }, 0);
    tl.to(sweep, { yPercent: -102, duration: 0.82, ease: "power4.inOut" }, 0.05);
    tl.to(header, { opacity: 1, y: 0, duration: 0.32 }, 0.48);
    tl.to(hero, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.58 }, 0.54);
    tl.to(profile, { opacity: 1, y: 0, duration: 0.38 }, 0.62);
    tl.to(infoCards, { opacity: 1, y: 0, duration: 0.34, stagger: 0.045 }, 0.7);
    tl.to(focusPills, { opacity: 1, y: 0, duration: 0.28, stagger: 0.035 }, 0.78);
    tl.to(actions, { opacity: 1, y: 0, duration: 0.38 }, 0.72);
    tl.to(actionCards, { opacity: 1, y: 0, duration: 0.3, stagger: 0.035 }, 0.82);
    tl.to(charts, { opacity: 1, y: 0, duration: 0.38 }, 0.92);
    tl.to(chartsCards, { opacity: 1, y: 0, duration: 0.34, stagger: 0.055 }, 1);

    return () => {
      tl.kill();
    };
  }, [open, prefersReducedMotion]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") animateOut();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [animateOut, open]);

  if (!open) return null;

  return (
    <div
      ref={pageRef}
      className="fixed inset-0 z-[110] overflow-y-auto lg:overflow-hidden"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <BackgroundRippleEffect cellSize={40} cameraRef={cameraRef} zoomRef={zoomRef} />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            theme === "light"
              ? `radial-gradient(circle at 22% 42%, ${hexToRgba(accentColor, 0.09)}, transparent 28%),
                 linear-gradient(180deg, rgba(255,255,255,0.76), rgba(255,255,255,0.5))`
              : `radial-gradient(circle at 22% 42%, ${hexToRgba(accentColor, 0.11)}, transparent 30%),
                 linear-gradient(180deg, rgba(22,22,22,0.76), rgba(22,22,22,0.5))`,
        }}
      />

      <div
        ref={sweepRef}
        className="pointer-events-none fixed inset-0 z-[4]"
        style={{
          background:
            theme === "light"
              ? `linear-gradient(180deg, ${colors.bg} 0%, ${hexToRgba(accentColor, 0.88)} 100%)`
              : `linear-gradient(180deg, ${colors.bg} 0%, ${hexToRgba(accentColor, 0.72)} 100%)`,
          willChange: "transform",
        }}
      />

      <main className="relative z-[2] mx-auto flex min-h-dvh w-full max-w-[1360px] flex-col px-4 py-4 sm:px-6 lg:h-dvh lg:px-8 lg:py-5">
        <div ref={headerRef} className="flex shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            onClick={animateOut}
            className="group inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-transform active:scale-[0.96]"
            style={{
              backgroundColor: colors.bgAlpha,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <ArrowLeft
              size={16}
              className="transition-transform group-hover:-translate-x-0.5"
            />
            Back to home
          </button>

          <span
            className="rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em]"
            style={{
              color: colors.textMuted,
              backgroundColor: colors.bgAlpha,
              border: `1px solid ${colors.border}`,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            About
          </span>
        </div>

        <section className="grid flex-1 content-center gap-4 py-4 lg:min-h-0 lg:grid-cols-[minmax(380px,0.86fr)_minmax(560px,1.14fr)] lg:items-center lg:gap-5">
          <div className="grid min-h-0 gap-4">
            <div
              ref={heroRef}
              className="relative overflow-hidden rounded-[26px] p-5 sm:p-7 lg:p-8"
              style={{
                backgroundColor: surface,
                border: `1px solid ${cardBorder}`,
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
              }}
            >
              <div
                className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl"
                style={{ backgroundColor: hexToRgba(accentColor, theme === "light" ? 0.12 : 0.18) }}
              />

              <p
                className="mb-5 inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{
                  color: colors.text,
                  backgroundColor: hexToRgba(accentColor, theme === "light" ? 0.11 : 0.18),
                }}
              >
                Product Designer @ Innovaccer
              </p>

              <h1
                className="relative"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "60px",
                  fontWeight: 780,
                  letterSpacing: "-0.086em",
                  lineHeight: 0.83,
                  textWrap: "balance",
                }}
              >
                Atulya
              </h1>

              <p
                className="mt-5 max-w-[640px] text-pretty"
                style={{
                  color: colors.textSecondary,
                  fontSize: "clamp(18px, 1.8vw, 24px)",
                  lineHeight: 1.22,
                  letterSpacing: "-0.04em",
                }}
              >
                Product designer working across healthcare products, UX design, interaction
                design, visual experience, design systems, and building and executing AI first
                experiences for teams and million users.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {focusAreas.map((area) => (
                  <span
                    key={area}
                    data-contact-focus
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{
                      color: colors.textSecondary,
                      backgroundColor:
                        theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.055)",
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>

            <div ref={profileRef} className="grid gap-3 sm:grid-cols-2">
              <InfoCard
                icon={<BriefcaseBusiness size={17} />}
                label="Currently"
                value="Product Designer @ Innovaccer"
                accentColor={accentColor}
                borderColor={cardBorder}
                backgroundColor={elevatedSurface}
                textColor={colors.text}
                mutedColor={colors.textMuted}
              />
              <InfoCard
                icon={<GraduationCap size={17} />}
                label="Education"
                value="Masters in Interaction Design, B.Tech CSE"
                accentColor={accentColor}
                borderColor={cardBorder}
                backgroundColor={elevatedSurface}
                textColor={colors.text}
                mutedColor={colors.textMuted}
              />
            </div>
          </div>

          <div className="grid min-h-0 gap-4">
            <div
              ref={actionsRef}
              className="rounded-[26px] p-3 sm:p-4"
              style={{
                backgroundColor: surface,
                border: `1px solid ${cardBorder}`,
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
              }}
            >
              <div className="mb-3 flex items-end justify-between gap-3 px-1">
                <div>
                  <h2 className="text-base font-bold tracking-[-0.03em]">Contact points</h2>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    One-click buttons, no raw URLs.
                  </p>
                </div>
                <span
                  className="hidden rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] sm:inline-flex"
                  style={{
                    color: accentColor,
                    backgroundColor: hexToRgba(accentColor, theme === "light" ? 0.1 : 0.16),
                  }}
                >
                  connect
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {contactActions.map(({ label, detail, href, icon: Icon }) => (
                  <a
                    key={label}
                    data-contact-action
                    href={href}
                    target={href.startsWith("mailto:") ? undefined : "_blank"}
                    rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
                    className="group flex min-h-[88px] flex-col justify-between rounded-[16px] px-3 py-3 transition-transform hover:-translate-y-0.5 active:scale-[0.96]"
                    style={{
                      backgroundColor: elevatedSurface,
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                    }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-[11px]"
                        style={{
                          color: accentColor,
                          backgroundColor: hexToRgba(accentColor, theme === "light" ? 0.1 : 0.16),
                        }}
                      >
                        <Icon size={15} />
                      </span>
                      <ExternalLink
                        size={12}
                        className="opacity-30 transition-opacity group-hover:opacity-80"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold tracking-[-0.03em]">
                        {label}
                      </span>
                      <span className="block truncate text-xs" style={{ color: colors.textMuted }}>
                        {detail}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div
              ref={chartsRef}
              className="min-h-0 rounded-[26px] p-3 sm:p-4"
              style={{
                backgroundColor: surface,
                border: `1px solid ${cardBorder}`,
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
              }}
            >
              <div className="mb-3 flex items-end justify-between gap-3 px-1">
                <div>
                  <h2 className="text-base font-bold tracking-[-0.03em]">GitHub activity</h2>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    Personal and Innovaccer contribution traces.
                  </p>
                </div>
                <Github size={18} color={accentColor} />
              </div>

              <div className="grid min-h-0 gap-3 lg:grid-cols-2">
                {contributionCharts.map((chart) => (
                  <div
                    key={chart.user}
                    data-contact-chart
                    className="flex min-h-0 flex-col rounded-[18px] p-3"
                    style={{
                      backgroundColor: elevatedSurface,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold">
                      <span style={{ color: colors.text }}>{chart.label}</span>
                      <span style={{ color: colors.textMuted }}>@{chart.user}</span>
                    </div>
                    <div
                      className="flex min-h-[96px] items-center overflow-hidden rounded-[13px] bg-white px-2 py-2"
                      style={{
                        outline: "1px solid rgba(0,0,0,0.1)",
                      }}
                    >
                      <img
                        src={`https://ghchart.rshah.org/${chartColor}/${chart.user}`}
                        alt={`${chart.label} contribution chart`}
                        className="block h-auto w-full"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

interface InfoCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  accentColor: string;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
}

function InfoCard({
  icon,
  label,
  value,
  accentColor,
  borderColor,
  backgroundColor,
  textColor,
  mutedColor,
}: InfoCardProps) {
  return (
    <div
      data-contact-info
      className="rounded-[20px] p-4"
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div className="mb-3" style={{ color: accentColor }}>
        {icon}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: mutedColor }}>
        {label}
      </div>
      <div
        className="mt-2 text-sm font-bold leading-snug tracking-[-0.03em] sm:text-base"
        style={{ color: textColor }}
      >
        {value}
      </div>
    </div>
  );
}
