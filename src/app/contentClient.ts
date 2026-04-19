import type {
  ProjectDocument,
  ProjectIndexEntry,
  ProjectSearchEntry,
  ProjectSearchIndexFile,
} from "../content/schema";

interface ProjectIndexResponse {
  projects: ProjectIndexEntry[];
}

const indexUrl = "/content/projects/index.json";
const searchIndexUrl = "/content/projects/search-index.json";
const detailCache = new Map<string, Promise<ProjectDocument> | ProjectDocument>();
let indexCache: Promise<ProjectIndexEntry[]> | null = null;
let searchIndexCache: Promise<ProjectSearchEntry[]> | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function loadPublicProjectIndex(): Promise<ProjectIndexEntry[]> {
  if (!indexCache) {
    indexCache = fetchJson<ProjectIndexResponse>(indexUrl).then((data) =>
      (data.projects ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
    );
  }
  return indexCache;
}

export async function loadPublicProjectDetail(slug: string): Promise<ProjectDocument> {
  const cached = detailCache.get(slug);
  if (cached) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const request = fetchJson<ProjectDocument>(`/content/projects/${slug}.json`).then((document) => {
    detailCache.set(slug, document);
    return document;
  });
  detailCache.set(slug, request);
  return request;
}

export function prefetchPublicProjectDetail(slug: string) {
  void loadPublicProjectDetail(slug).catch(() => {
    detailCache.delete(slug);
  });
}

export async function loadPublicSearchIndex(): Promise<ProjectSearchEntry[]> {
  if (!searchIndexCache) {
    searchIndexCache = fetchJson<ProjectSearchIndexFile>(searchIndexUrl).then((data) =>
      (data.projects ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
    );
  }
  return searchIndexCache;
}

export function prefetchPublicSearchIndex() {
  void loadPublicSearchIndex().catch(() => {
    searchIndexCache = null;
  });
}
