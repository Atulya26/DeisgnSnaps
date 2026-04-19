import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Search, Sparkles, X } from "lucide-react";
import type { ProjectSearchEntry } from "../../content/schema";
import {
  loadPublicSearchIndex,
  prefetchPublicProjectDetail,
} from "../contentClient";
import type { CanvasProjectSummary } from "./types";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useTheme } from "./ThemeContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";

interface SearchDialogProps {
  open: boolean;
  projects: CanvasProjectSummary[];
  onClose: () => void;
  onSelectProject: (project: CanvasProjectSummary) => void;
}

interface SearchResult {
  entry: ProjectSearchEntry;
  score: number;
  reasons: string[];
  snippet: string;
}

const STOPWORDS = new Set([
  "and",
  "app",
  "are",
  "for",
  "from",
  "into",
  "just",
  "more",
  "page",
  "post",
  "shot",
  "that",
  "this",
  "with",
  "your",
  "dribbble",
  "design",
  "challenge",
  "daily",
]);

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildSnippet(source: string, terms: string[]) {
  const clean = source.replace(/\s+/g, " ").trim();
  if (!clean) return "Open to explore the full case study.";
  const lower = clean.toLowerCase();
  const matchIndex = terms.reduce((closest, term) => {
    const nextIndex = lower.indexOf(term.toLowerCase());
    if (nextIndex === -1) return closest;
    if (closest === -1) return nextIndex;
    return Math.min(closest, nextIndex);
  }, -1);

  if (matchIndex === -1) {
    return clean.length > 132 ? `${clean.slice(0, 132).trimEnd()}…` : clean;
  }

  const start = clamp(matchIndex - 48, 0, Math.max(0, clean.length - 132));
  const end = clamp(matchIndex + 96, start + 64, clean.length);
  const excerpt = clean.slice(start, end).trim();
  return `${start > 0 ? "… " : ""}${excerpt}${end < clean.length ? " …" : ""}`;
}

function deriveSuggestions(entries: ProjectSearchEntry[]) {
  const preferredTerms = [
    "Dashboard",
    "Website",
    "Weather",
    "Finance",
    "Mobile",
    "Landing",
    "Fashion",
    "HMI",
  ];
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const titleTokens = normalizeForSearch(entry.title).split(" ");
    const tagTokens = entry.tags.flatMap((tag) => normalizeForSearch(tag).split(" "));

    for (const token of titleTokens) {
      if (token.length < 3 || STOPWORDS.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 4);
    }

    for (const token of tagTokens) {
      if (token.length < 3 || STOPWORDS.has(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 5);
    }
  }

  const preferred = preferredTerms.filter((term) =>
    entries.some((entry) => normalizeForSearch(entry.searchText).includes(normalizeForSearch(term)))
  );

  const dynamic = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([token]) => titleCase(token));

  return uniqueStrings([...preferred, ...dynamic]).slice(0, 8);
}

function scoreEntry(entry: ProjectSearchEntry, query: string): SearchResult | null {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) {
    return {
      entry,
      score: Math.max(1, 1000 - entry.sortOrder),
      reasons: ["Featured"],
      snippet: buildSnippet(entry.description || entry.searchText, []),
    };
  }

  const terms = uniqueStrings(normalizedQuery.split(" ").filter(Boolean));
  if (terms.length === 0) return null;

  const title = normalizeForSearch(entry.title);
  const category = normalizeForSearch(entry.category);
  const tags = normalizeForSearch(entry.tags.join(" "));
  const description = normalizeForSearch(entry.description);
  const body = normalizeForSearch(entry.searchText);

  let score = 0;
  const reasons = new Set<string>();
  let matchedTerms = 0;

  if (title.startsWith(normalizedQuery)) {
    score += 220;
    reasons.add("Title");
  } else if (title.includes(normalizedQuery)) {
    score += 140;
    reasons.add("Title");
  }

  if (tags.includes(normalizedQuery)) {
    score += 110;
    reasons.add("Tags");
  }

  if (description.includes(normalizedQuery)) {
    score += 70;
    reasons.add("Description");
  }

  if (body.includes(normalizedQuery)) {
    score += 48;
    reasons.add("Text");
  }

  for (const term of terms) {
    let matched = false;

    if (title.includes(term)) {
      score += 44;
      reasons.add("Title");
      matched = true;
    }
    if (tags.includes(term)) {
      score += 30;
      reasons.add("Tags");
      matched = true;
    }
    if (category.includes(term)) {
      score += 20;
      reasons.add("Category");
      matched = true;
    }
    if (description.includes(term)) {
      score += 16;
      reasons.add("Description");
      matched = true;
    }
    if (body.includes(term)) {
      score += 9;
      reasons.add("Text");
      matched = true;
    }

    if (matched) matchedTerms += 1;
  }

  if (matchedTerms === terms.length) {
    score += 36;
  }

  if (score <= 0) return null;

  return {
    entry,
    score,
    reasons: [...reasons],
    snippet: buildSnippet(entry.description || entry.searchText, terms),
  };
}

export function SearchDialog({
  open,
  projects,
  onClose,
  onSelectProject,
}: SearchDialogProps) {
  const { theme, colors, dotGridConfig } = useTheme();
  const [query, setQuery] = useState("");
  const [searchEntries, setSearchEntries] = useState<ProjectSearchEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const fallbackEntries = useMemo<ProjectSearchEntry[]>(
    () =>
      projects.map((project) => ({
        id: project.id,
        slug: project.slug,
        title: project.title,
        category: project.category,
        year: project.year,
        cardImageUrl: project.cardImageUrl,
        coverImageUrl: project.coverImageUrl,
        width: project.width,
        height: project.height,
        sortOrder: project.sortOrder,
        status: project.status,
        description: project.description ?? "",
        tags: project.tags ?? [],
        searchText: [
          project.title,
          project.category,
          project.year,
          project.description ?? "",
          ...(project.tags ?? []),
        ]
          .filter(Boolean)
          .join("\n")
          .trim(),
      })),
    [projects]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    loadPublicSearchIndex()
      .then((entries) => {
        if (cancelled) return;
        setSearchEntries(entries);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchEntries(fallbackEntries);
        setLoadError("Search index unavailable. Using lightweight search.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      cancelled = true;
    };
  }, [fallbackEntries, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const entries = searchEntries.length > 0 ? searchEntries : fallbackEntries;
  const suggestions = useMemo(() => deriveSuggestions(entries), [entries]);

  const results = useMemo(() => {
    const activeQuery = query.trim();
    const ranked = entries
      .map((entry) => scoreEntry(entry, activeQuery))
      .filter(Boolean) as SearchResult[];

    if (!activeQuery) {
      return ranked.slice(0, 10);
    }

    return ranked
      .sort((a, b) => b.score - a.score || a.entry.sortOrder - b.entry.sortOrder)
      .slice(0, 12);
  }, [entries, query]);

  useEffect(() => {
    setSelectedIndex((current) => {
      if (results.length === 0) return 0;
      return clamp(current, 0, results.length - 1);
    });
  }, [results]);

  const activeResult = results[selectedIndex] ?? null;

  useEffect(() => {
    if (!activeResult) return;
    prefetchPublicProjectDetail(activeResult.entry.slug);
  }, [activeResult]);

  const handleOpenResult = useCallback(
    (result: SearchResult | null) => {
      if (!result) return;
      const project = projectMap.get(result.entry.id);
      if (!project) return;
      onClose();
      onSelectProject(project);
    },
    [onClose, onSelectProject, projectMap]
  );

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) =>
          results.length === 0 ? 0 : (current + 1) % results.length
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) =>
          results.length === 0 ? 0 : (current - 1 + results.length) % results.length
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handleOpenResult(activeResult);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [activeResult, handleOpenResult, onClose, results.length]
  );

  useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(`[data-result-index="${selectedIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const accentColor =
    theme === "light" ? dotGridConfig.lightActiveColor : dotGridConfig.darkActiveColor;
  const overlayBg =
    theme === "light" ? "rgba(246, 246, 248, 0.58)" : "rgba(10, 10, 12, 0.58)";
  const dialogBg = theme === "light" ? colors.surface : colors.surfaceAlpha;
  const dialogBorder = colors.borderLight;
  const panelBg = theme === "light" ? "rgba(0,0,0,0.018)" : "rgba(255,255,255,0.03)";
  const panelBgHover = theme === "light" ? "rgba(0,0,0,0.032)" : "rgba(255,255,255,0.05)";
  const panelBorder = colors.border;
  const textPrimary = colors.text;
  const textSecondary = colors.textSecondary;
  const textMuted = colors.textMuted;
  const chipBg = theme === "light" ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.05)";
  const activeItemBg = theme === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)";
  const inputBg = theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.03)";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pb-4 pt-16 sm:px-6 sm:pt-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
            style={{
              backgroundColor: overlayBg,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
            aria-label="Close search"
          />

          <motion.div
            className="relative z-[1] flex h-[min(760px,calc(100dvh-5rem))] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl sm:h-[min(760px,calc(100dvh-7rem))]"
            initial={{ opacity: 0, y: 20, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              backgroundColor: dialogBg,
              border: `1px solid ${dialogBorder}`,
              boxShadow:
                theme === "light"
                  ? "0 30px 80px rgba(15,15,15,0.14), 0 8px 24px rgba(15,15,15,0.06)"
                  : "0 34px 96px rgba(0,0,0,0.34), 0 12px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b px-4 pb-4 pt-4 sm:px-5" style={{ borderColor: panelBorder }}>
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: chipBg,
                      border: `1px solid ${panelBorder}`,
                    }}
                  >
                    <Search size={16} color={accentColor} />
                  </div>
                  <div className="min-w-0">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        color: textPrimary,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      Search the archive
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: textSecondary,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      Titles, tags, descriptions, and case-study copy
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-lg"
                  aria-label="Close search"
                >
                  <X size={16} color={textSecondary} />
                </Button>
              </div>

              <div className="flex items-center gap-3"
                style={{
                  backgroundColor: inputBg,
                  border: `1px solid ${panelBorder}`,
                  borderRadius: 14,
                  padding: 10,
                }}
              >
                <Search size={18} color={accentColor} />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search projects, tags, moods, systems, interfaces..."
                  className="h-9 border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0"
                  style={{
                    color: textPrimary,
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: "-0.015em",
                  }}
                />
                <div className="hidden items-center gap-2 sm:flex">
                  <Badge
                    variant="outline"
                    className="rounded-md px-2.5 py-1 text-[11px]"
                    style={{
                      color: textSecondary,
                      borderColor: panelBorder,
                      backgroundColor: chipBg,
                    }}
                  >
                    F
                  </Badge>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setQuery(suggestion);
                      inputRef.current?.focus();
                    }}
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full px-3 text-[11px]"
                    style={{
                      backgroundColor: chipBg,
                      color: textSecondary,
                      borderColor: panelBorder,
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_292px]">
              <div className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r" style={{ borderColor: panelBorder }}>
                <div
                  className="flex items-center justify-between px-4 py-3 sm:px-5"
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      color: textPrimary,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {query.trim()
                      ? `${results.length} result${results.length === 1 ? "" : "s"}`
                      : "Curated matches"}
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{
                      fontSize: 11,
                      color: textMuted,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <Sparkles size={13} />
                    {entries.length} indexed projects
                  </div>
                </div>

                <Separator />

                <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                  {isLoading ? (
                    <div className="px-3 py-10" style={{ color: textSecondary }}>
                      Indexing the portfolio for search…
                    </div>
                  ) : results.length === 0 ? (
                    <div
                      className="rounded-[24px] px-5 py-10 text-center"
                      style={{
                        backgroundColor: panelBg,
                        border: `1px solid ${panelBorder}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: textPrimary,
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Nothing matched “{query.trim()}”
                      </div>
                      <div
                        className="mx-auto mt-2 max-w-[360px]"
                        style={{
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: textSecondary,
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Try a broader word like “Dashboard”, “Website”, “Finance”, or jump in from the suggestions above.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {results.map((result, index) => {
                        const isActive = index === selectedIndex;
                        return (
                          <button
                            key={result.entry.id}
                            type="button"
                            data-result-index={index}
                            onMouseEnter={() => setSelectedIndex(index)}
                            onFocus={() => setSelectedIndex(index)}
                            onClick={() => handleOpenResult(result)}
                            className="block w-full rounded-xl px-3 py-3 text-left transition-all"
                            style={{
                              backgroundColor: isActive ? activeItemBg : panelBg,
                              border: `1px solid ${isActive ? `${accentColor}33` : panelBorder}`,
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="hidden h-14 w-14 shrink-0 overflow-hidden rounded-lg border sm:block"
                                style={{ borderColor: panelBorder, backgroundColor: colors.imageBg }}
                              >
                                <ImageWithFallback
                                  src={result.entry.cardImageUrl}
                                  alt={result.entry.title}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                                style={{
                                  backgroundColor: isActive ? `${accentColor}22` : chipBg,
                                  color: isActive ? accentColor : textMuted,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  fontFamily: "'Inter', sans-serif",
                                }}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div
                                      className="truncate"
                                      style={{
                                        fontSize: 15,
                                        fontWeight: 600,
                                        letterSpacing: "-0.02em",
                                        color: textPrimary,
                                        fontFamily: "'Inter', sans-serif",
                                      }}
                                    >
                                      {result.entry.title}
                                    </div>
                                    <div
                                      className="mt-1"
                                      style={{
                                        fontSize: 11,
                                        color: textMuted,
                                        fontFamily: "'Inter', sans-serif",
                                      }}
                                    >
                                      {[result.entry.category, result.entry.year].filter(Boolean).join("  •  ") || "Project"}
                                    </div>
                                  </div>
                                  <ArrowUpRight size={14} color={isActive ? accentColor : textMuted} />
                                </div>

                                <p
                                  className="mt-1.5"
                                  style={{
                                    fontSize: 12,
                                    lineHeight: 1.5,
                                    color: textSecondary,
                                    fontFamily: "'Inter', sans-serif",
                                  }}
                                >
                                  {result.snippet}
                                </p>

                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                  {result.reasons.slice(0, 3).map((reason) => (
                                    <Badge
                                      key={reason}
                                      variant="outline"
                                      className="rounded-full px-2 py-0.5 text-[10px]"
                                      style={{
                                        backgroundColor: isActive ? `${accentColor}12` : "transparent",
                                        color: isActive ? accentColor : textMuted,
                                        borderColor: isActive ? `${accentColor}22` : panelBorder,
                                      }}
                                    >
                                      {reason}
                                    </Badge>
                                  ))}
                                  {result.entry.tags.slice(0, 2).map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="outline"
                                      className="rounded-full px-2 py-0.5 text-[10px]"
                                      style={{
                                        color: textMuted,
                                        borderColor: panelBorder,
                                        backgroundColor: "transparent",
                                      }}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden min-h-0 flex-col lg:flex">
                <div className="flex items-center justify-between px-4 py-3 sm:px-5">
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      color: textPrimary,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Preview
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: textMuted,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    Press Enter to open
                  </div>
                </div>

                <Separator />

                {activeResult ? (
                  <div className="flex min-h-0 flex-1 flex-col p-4">
                    <button
                      type="button"
                      onClick={() => handleOpenResult(activeResult)}
                      className="flex h-full flex-col overflow-hidden rounded-xl text-left transition-transform hover:-translate-y-0.5"
                      style={{
                        backgroundColor: panelBgHover,
                        border: `1px solid ${panelBorder}`,
                      }}
                    >
                      <div
                        className="relative aspect-[4/3] overflow-hidden"
                        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                        >
                          <ImageWithFallback
                            src={activeResult.entry.coverImageUrl ?? activeResult.entry.cardImageUrl}
                            alt={activeResult.entry.title}
                          className="h-full w-full object-cover"
                          loading="eager"
                          decoding="async"
                          {...({ fetchpriority: "high" } as Record<string, string>)}
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.42) 100%)",
                          }}
                        />
                      </div>

                      <div className="flex flex-1 flex-col px-4 py-4">
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: accentColor,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {query.trim() ? "Best Match" : "Spotlight"}
                        </div>

                        <div
                          className="mt-2"
                          style={{
                            fontSize: 18,
                            lineHeight: 1.06,
                            fontWeight: 650,
                            letterSpacing: "-0.04em",
                            color: textPrimary,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {activeResult.entry.title}
                        </div>

                        <div
                          className="mt-2"
                          style={{
                            fontSize: 11,
                            color: textMuted,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {[activeResult.entry.category, activeResult.entry.year]
                            .filter(Boolean)
                            .join("  •  ") || "Project"}
                        </div>

                        <p
                          className="mt-4"
                          style={{
                            fontSize: 12,
                            lineHeight: 1.55,
                            color: textSecondary,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {activeResult.snippet}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {activeResult.reasons.slice(0, 4).map((reason) => (
                            <Badge
                              key={reason}
                              variant="outline"
                              className="rounded-full px-2 py-0.5 text-[10px]"
                              style={{
                                backgroundColor: `${accentColor}12`,
                                borderColor: `${accentColor}22`,
                                color: accentColor,
                              }}
                            >
                              {reason}
                            </Badge>
                          ))}
                        </div>

                        <div
                          className="mt-auto flex items-center justify-between pt-6"
                          style={{
                            fontSize: 12,
                            color: textSecondary,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          <span>Open project</span>
                          <ArrowUpRight size={16} color={accentColor} />
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center px-6 text-center" style={{ color: textSecondary }}>
                    Start typing to search the archive.
                  </div>
                )}
              </div>
            </div>

            <div
              className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5"
              style={{ borderColor: panelBorder }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: textMuted,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Search across headings, tags, descriptions, and supporting copy.
              </div>
              <div className="flex items-center gap-2" style={{ color: textMuted }}>
                <Badge
                  variant="outline"
                  className="rounded-md px-2 py-0.5 text-[10px]"
                  style={{
                    borderColor: panelBorder,
                    backgroundColor: chipBg,
                  }}
                >
                  ↑↓
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md px-2 py-0.5 text-[10px]"
                  style={{
                    borderColor: panelBorder,
                    backgroundColor: chipBg,
                  }}
                >
                  Enter
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-md px-2 py-0.5 text-[10px]"
                  style={{
                    borderColor: panelBorder,
                    backgroundColor: chipBg,
                  }}
                >
                  Esc
                </Badge>
              </div>
            </div>

            {loadError && (
              <div
                className="px-5 pb-4 text-[11px] sm:px-6"
                style={{
                  color: textMuted,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {loadError}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
