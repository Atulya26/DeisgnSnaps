import type {
  AdminProjectDocument,
  MediaAsset,
  ProjectDocument,
  ProjectIndexFile,
  ProjectSearchIndexFile,
} from "../../src/content/schema";
import { getJsonFile } from "./github";
import type { GitHubRepoConfig } from "./github";

const ADMIN_INDEX_PATH = "content/admin/index.json";
const ADMIN_PROJECTS_ROOT = "content/admin/projects";
const PUBLIC_INDEX_PATH = "public/content/projects/index.json";
const PUBLIC_PROJECTS_ROOT = "public/content/projects";
const PUBLIC_SEARCH_INDEX_PATH = "public/content/projects/search-index.json";

type RepoWrite =
  | { path: string; content: string; encoding: "utf-8" }
  | { path: string; delete: true };

export function getRepoFilePathFromPublicUrl(publicUrl: string) {
  return `public/${publicUrl.replace(/^\/+/, "")}`;
}

export function getAdminProjectPath(slug: string) {
  return `${ADMIN_PROJECTS_ROOT}/${slug}.json`;
}

export function getPublicProjectPath(slug: string) {
  return `${PUBLIC_PROJECTS_ROOT}/${slug}.json`;
}

export async function readAdminIndex(token: string, repo: GitHubRepoConfig) {
  const data = await getJsonFile<ProjectIndexFile<AdminProjectDocument & { createdAt: string }>>(token, repo, ADMIN_INDEX_PATH);
  return data?.projects ?? [];
}

export async function readPublicIndex(token: string, repo: GitHubRepoConfig) {
  const data = await getJsonFile<ProjectIndexFile>(token, repo, PUBLIC_INDEX_PATH);
  return data?.projects ?? [];
}

export async function readAdminProjectBySlug(
  token: string,
  repo: GitHubRepoConfig,
  slug: string
) {
  return getJsonFile<AdminProjectDocument>(token, repo, getAdminProjectPath(slug));
}

function toTextFile(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueById(items: MediaAsset[]) {
  const seen = new Set<string>();
  const output: MediaAsset[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    output.push(item);
  }
  return output;
}

export function normalizeProjectForWrite(
  project: AdminProjectDocument,
  options: { touch?: boolean } = {}
): AdminProjectDocument {
  const now = new Date().toISOString();
  const nextUpdatedAt = options.touch === false ? project.updatedAt || now : now;
  const galleryAssets = uniqueById(project.assets.filter((asset) => asset.role === "gallery"));
  const selectedCover = project.assets.find((asset) => asset.id === project.coverAssetId) ?? galleryAssets[0] ?? null;
  const selectedCard = project.assets.find((asset) => asset.id === project.cardAssetId) ?? selectedCover ?? null;
  const assetBase = `/portfolio/projects/${project.slug}`;

  const cardAsset: MediaAsset = {
    id: "card",
    kind: "image",
    role: "card",
    src: `${assetBase}/card.webp`,
  };
  const coverAsset: MediaAsset = {
    id: "cover",
    kind: "image",
    role: "cover",
    src: `${assetBase}/cover.webp`,
  };

  const nextAssets: MediaAsset[] = [cardAsset, coverAsset, ...galleryAssets];
  const nextGallery: MediaAsset[] = [coverAsset, ...galleryAssets];

  return {
    ...project,
    cardImageUrl: cardAsset.src,
    coverImageUrl: coverAsset.src,
    gallery: nextGallery,
    assets: nextAssets,
    coverAssetId: selectedCover?.id ?? "cover",
    cardAssetId: selectedCard?.id ?? selectedCover?.id ?? "card",
    blocks: project.blocks.filter((block) => {
      if (block.type === "text") return true;
      return nextAssets.some((asset) => asset.id === block.assetId);
    }),
    updatedAt: nextUpdatedAt,
    createdAt: project.createdAt || now,
  };
}

export function buildPublicProject(project: AdminProjectDocument): ProjectDocument {
  return {
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
    description: project.description,
    tags: project.tags,
    gallery: project.gallery,
    blocks: project.blocks,
    updatedAt: project.updatedAt,
  };
}

export function buildSearchIndexFile(
  projects: AdminProjectDocument[]
): ProjectSearchIndexFile {
  const publishedProjects = projects
    .filter((project) => project.status === "published")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    generatedAt: new Date().toISOString(),
    projects: publishedProjects.map((project) => ({
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
      description: project.description,
      tags: project.tags,
      searchText: [
        project.title,
        project.category,
        project.year,
        project.description,
        ...project.tags,
        ...project.blocks
          .filter((block) => block.type === "text")
          .map((block) => stripHtmlToText(block.html)),
      ]
        .filter(Boolean)
        .join("\n")
        .trim(),
    })),
  };
}

export function buildAdminIndexFile(projects: AdminProjectDocument[]) {
  return {
    projects: projects
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((project) => ({
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
        updatedAt: project.updatedAt,
        createdAt: project.createdAt,
      })),
  };
}

export function buildPublicIndexFile(projects: AdminProjectDocument[]) {
  return {
    projects: projects
      .filter((project) => project.status === "published")
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((project) => ({
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
      })),
  };
}

export function buildProjectWriteSet(projects: AdminProjectDocument[]) {
  return [
    {
      path: ADMIN_INDEX_PATH,
      content: toTextFile(buildAdminIndexFile(projects)),
      encoding: "utf-8" as const,
    },
    {
      path: PUBLIC_INDEX_PATH,
      content: toTextFile(buildPublicIndexFile(projects)),
      encoding: "utf-8" as const,
    },
    {
      path: PUBLIC_SEARCH_INDEX_PATH,
      content: toTextFile(buildSearchIndexFile(projects)),
      encoding: "utf-8" as const,
    },
    ...projects.flatMap((project) => {
      const publicDoc = buildPublicProject(project);
      const writes: RepoWrite[] = [
        {
          path: getAdminProjectPath(project.slug),
          content: toTextFile(project),
          encoding: "utf-8" as const,
        },
      ];

      if (project.status === "published") {
        writes.push({
          path: getPublicProjectPath(project.slug),
          content: toTextFile(publicDoc),
          encoding: "utf-8" as const,
        });
      } else {
        writes.push({
          path: getPublicProjectPath(project.slug),
          delete: true as const,
        });
      }

      return writes;
    }),
  ];
}

export function buildSingleProjectWriteSet(
  allProjects: AdminProjectDocument[],
  project: AdminProjectDocument
) : RepoWrite[] {
  return [
    {
      path: ADMIN_INDEX_PATH,
      content: toTextFile(buildAdminIndexFile(allProjects)),
      encoding: "utf-8" as const,
    },
    {
      path: PUBLIC_INDEX_PATH,
      content: toTextFile(buildPublicIndexFile(allProjects)),
      encoding: "utf-8" as const,
    },
    {
      path: PUBLIC_SEARCH_INDEX_PATH,
      content: toTextFile(buildSearchIndexFile(allProjects)),
      encoding: "utf-8" as const,
    },
    {
      path: getAdminProjectPath(project.slug),
      content: toTextFile(project),
      encoding: "utf-8" as const,
    },
    project.status === "published"
      ? {
          path: getPublicProjectPath(project.slug),
          content: toTextFile(buildPublicProject(project)),
          encoding: "utf-8" as const,
        }
      : {
          path: getPublicProjectPath(project.slug),
          delete: true as const,
        },
  ];
}
