#!/usr/bin/env node

const DRIBBBLE_API_BASE = "https://api.dribbble.com/v2";
const MAX_TAGS = 12;
const DEFAULT_REQUEST_DELAY_MS = 125;
const DEFAULT_ASSET_CONCURRENCY = 4;
const GENERIC_TAGS = new Set([
  "app",
  "apps",
  "application",
  "branding",
  "clean",
  "concept",
  "dashboard",
  "design",
  "figma",
  "homepage",
  "illustration",
  "interface",
  "landing",
  "minimal",
  "mobile",
  "modern",
  "page",
  "product",
  "product design",
  "saas",
  "ui",
  "uiux",
  "ux",
  "uxui",
  "web",
  "website",
  "website design",
]);

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function getBooleanEnv(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function getNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normaliseBaseUrl(url) {
  return url.replace(/\/$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "asset";
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toParagraphHtml(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const paragraphs = trimmed.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.map((part) => `<p>${escapeHtml(part)}</p>`).join("");
}

function titleCase(input) {
  return input
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function pickCategory(shots) {
  const tags = unique(shots.flatMap((shot) => shot.tags ?? []));
  const candidate = tags.find((tag) => !GENERIC_TAGS.has(tag.toLowerCase()));
  return candidate ? titleCase(candidate) : "Digital Design";
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function extFromContentType(contentType) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    case "image/svg+xml":
      return "svg";
    case "image/bmp":
      return "bmp";
    default:
      return "";
  }
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function guessExtension(url, contentType) {
  return extFromContentType(contentType) || extFromUrl(url) || "jpg";
}

function parseErrorBody(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error) return parsed.error;
    if (parsed?.message) return parsed.message;
  } catch {
    // Ignore JSON parsing failures.
  }
  return text.trim() || "Unknown request error";
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse JSON response from ${response.url}`);
  }
}

async function ensureOk(response, context) {
  if (response.ok) return response;
  const body = parseErrorBody(await response.text());
  throw new Error(`${context} failed (${response.status}): ${body}`);
}

function getImageCandidates(shot) {
  const out = [];
  const cover = shot.images?.hidpi || shot.images?.normal || shot.images?.teaser || "";
  if (cover) {
    out.push({
      sourceUrl: cover,
      caption: shot.title,
      sourceType: "cover",
      shotId: shot.id,
      shotTitle: shot.title,
      rank: 0,
    });
  }

  for (const [index, attachment] of (shot.attachments ?? []).entries()) {
    if (!attachment?.url) continue;
    out.push({
      sourceUrl: attachment.url,
      caption: shot.title,
      sourceType: "attachment",
      shotId: shot.id,
      shotTitle: shot.title,
      rank: index + 1,
    });
  }

  return out;
}

function sortShots(shots) {
  return [...shots].sort((a, b) => {
    const aTime = new Date(a.published_at || a.updated_at || 0).getTime();
    const bTime = new Date(b.published_at || b.updated_at || 0).getTime();
    return aTime - bTime;
  });
}

function buildImportedGroups(shots, projectsById) {
  const groups = new Map();

  for (const shot of sortShots(shots)) {
    const projectRef = shot.projects?.[0];
    const projectMeta = projectRef ? (projectsById.get(projectRef.id) || projectRef) : null;
    const groupKey = projectMeta ? `project:${projectMeta.id}` : `shot:${shot.id}`;

    if (!groups.has(groupKey)) {
      const sourceId = projectMeta ? String(projectMeta.id) : String(shot.id);
      groups.set(groupKey, {
        key: groupKey,
        sourceType: projectMeta ? "project" : "shot",
        sourceId,
        title: projectMeta?.name || shot.title,
        descriptionHtml: projectMeta?.description || shot.description || "",
        shots: [],
      });
    }

    groups.get(groupKey).shots.push(shot);
  }

  return [...groups.values()];
}

function buildTextBlocks(group) {
  const blocks = [];
  const overview = stripHtml(group.descriptionHtml || "");
  if (group.sourceType === "project" && overview) {
    blocks.push({
      type: "text",
      id: `text-overview-${group.sourceId}`,
      content: `<h2>Overview</h2>${toParagraphHtml(overview)}`,
    });
  }

  if (group.sourceType === "project") {
    for (const shot of group.shots) {
      const description = stripHtml(shot.description || "");
      if (!description) continue;
      if (description === overview) continue;
      blocks.push({
        type: "text",
        id: `text-shot-${shot.id}`,
        content: `<h2>${escapeHtml(shot.title)}</h2>${toParagraphHtml(description)}`,
      });
    }
  }

  return blocks;
}

function createAdminProjectSkeleton(group, existingProject, uploadedAssets, status) {
  const firstShot = group.shots[0];
  const title = group.title.trim() || firstShot.title.trim();
  const description = stripHtml(group.descriptionHtml || firstShot.description || "");
  const tags = unique(group.shots.flatMap((shot) => shot.tags ?? [])).slice(0, MAX_TAGS);
  const coverImage = uploadedAssets[0]?.url || existingProject?.coverImageKey || "";
  const year = firstShot?.published_at
    ? String(new Date(firstShot.published_at).getUTCFullYear())
    : new Date().getUTCFullYear().toString();
  const textBlocks = buildTextBlocks(group);
  const imageBlocks = uploadedAssets.map((asset, index) => ({
    type: "image",
    id: `image-${group.sourceId}-${String(index + 1).padStart(2, "0")}`,
    url: asset.url,
    key: asset.key,
    caption: asset.caption,
  }));
  const adminId = group.sourceType === "project"
    ? `dribbble-project-${group.sourceId}`
    : `dribbble-shot-${group.sourceId}`;
  const storagePath = `projects/${adminId}/`;
  const richContent = textBlocks.map((block) => block.content).join("\n\n");

  return {
    id: adminId,
    storagePath,
    title,
    category: pickCategory(group.shots),
    year,
    description,
    tags,
    richContent,
    coverImageKey: coverImage,
    images: uploadedAssets.map(({ key, url, size, lastModified }) => ({
      key,
      name: key.split("/").pop() || key,
      url,
      size,
      lastModified,
    })),
    contentBlocks: [...imageBlocks, ...textBlocks],
    x: existingProject?.x ?? 0,
    y: existingProject?.y ?? 0,
    width: existingProject?.width ?? 0,
    height: existingProject?.height ?? 0,
    status,
    createdAt: existingProject?.createdAt || firstShot?.published_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const dribbbleToken = getRequiredEnv("DRIBBBLE_ACCESS_TOKEN");
  const portfolioApiBase = normaliseBaseUrl(
    getOptionalEnv("PORTFOLIO_API_BASE_URL") ||
    getOptionalEnv("VITE_API_BASE_URL") ||
    "http://127.0.0.1:8787"
  );
  const importStatus = getOptionalEnv("DRIBBBLE_IMPORT_STATUS", "published") === "draft"
    ? "draft"
    : "published";
  const requestDelayMs = getNumberEnv("DRIBBBLE_REQUEST_DELAY_MS", DEFAULT_REQUEST_DELAY_MS);
  const assetConcurrency = getNumberEnv("DRIBBBLE_ASSET_CONCURRENCY", DEFAULT_ASSET_CONCURRENCY);
  const pruneMissingImports = getBooleanEnv("DRIBBBLE_SYNC_PRUNE", true);
  const cleanProjectAssets = getBooleanEnv("DRIBBBLE_SYNC_CLEAN_ASSETS", true);
  const dryRun = getBooleanEnv("DRIBBBLE_SYNC_DRY_RUN", false);

  const adminEmail = dryRun ? "" : getRequiredEnv("PORTFOLIO_ADMIN_EMAIL");
  const adminPassword = dryRun ? "" : getRequiredEnv("PORTFOLIO_ADMIN_PASSWORD");

  const dribbbleHeaders = {
    Authorization: `Bearer ${dribbbleToken}`,
    Accept: "application/json",
    "User-Agent": "cnvasportfolio-dribbble-sync",
  };

  let adminCookie = "";

  async function adminRequest(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (adminCookie) headers.set("cookie", adminCookie);
    const response = await fetch(`${portfolioApiBase}${path}`, {
      ...init,
      headers,
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      adminCookie = setCookie.split(";")[0];
    }

    return response;
  }

  async function dribbbleRequest(path) {
    await sleep(requestDelayMs);
    const response = await fetch(path.startsWith("http") ? path : `${DRIBBBLE_API_BASE}${path}`, {
      headers: dribbbleHeaders,
    });
    return ensureOk(response, `Dribbble request ${path}`);
  }

  async function fetchDribbbleCollection(path) {
    const out = [];
    let page = 1;
    while (true) {
      const separator = path.includes("?") ? "&" : "?";
      const response = await dribbbleRequest(`${path}${separator}page=${page}&per_page=100`);
      const data = await parseJson(response);
      if (!Array.isArray(data) || data.length === 0) break;
      out.push(...data);
      if (data.length < 100) break;
      page += 1;
    }
    return out;
  }

  console.log("Fetching Dribbble projects...");
  const dribbbleProjects = await fetchDribbbleCollection("/user/projects");
  const projectsById = new Map(dribbbleProjects.map((project) => [project.id, project]));

  console.log("Fetching Dribbble shots...");
  const rawShots = await fetchDribbbleCollection("/user/shots");
  const publishedShots = rawShots.filter((shot) => Boolean(shot?.published_at));
  const groups = buildImportedGroups(publishedShots, projectsById);

  console.log(`Discovered ${publishedShots.length} published shots across ${groups.length} import groups.`);

  if (groups.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  if (!dryRun) {
    console.log("Logging into portfolio admin API...");
    const loginResponse = await adminRequest("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    await ensureOk(loginResponse, "Admin login");
  }

  const existingProjects = dryRun
    ? []
    : ((await parseJson(await ensureOk(await adminRequest("/api/admin/projects"), "Fetch admin projects")))?.projects ?? []);
  const existingProjectsById = new Map(existingProjects.map((project) => [project.id, project]));

  async function deletePrefix(prefix) {
    const response = await adminRequest(`/api/admin/assets?prefix=${encodeURIComponent(prefix)}`, {
      method: "DELETE",
    });
    await ensureOk(response, `Delete existing assets for ${prefix}`);
  }

  async function uploadRemoteAsset(adminId, asset, assetIndex) {
    const response = await fetch(asset.sourceUrl);
    await ensureOk(response, `Download asset ${asset.sourceUrl}`);

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = guessExtension(asset.sourceUrl, contentType);
    const shotSlug = slugify(asset.shotTitle);
    const basename = asset.sourceType === "cover"
      ? `${String(assetIndex + 1).padStart(2, "0")}-${shotSlug}-cover.${extension}`
      : `${String(assetIndex + 1).padStart(2, "0")}-${shotSlug}-detail-${asset.rank}.${extension}`;
    const key = `projects/${adminId}/${basename}`;

    const buffer = await response.arrayBuffer();
    const form = new FormData();
    form.set("key", key);
    form.set("file", new Blob([buffer], { type: contentType }), basename);

    const uploadResponse = await adminRequest("/api/admin/upload", {
      method: "POST",
      body: form,
    });
    const uploaded = await parseJson(await ensureOk(uploadResponse, `Upload ${basename}`));

    return {
      key: uploaded.key,
      url: uploaded.url,
      caption: asset.caption,
      size: buffer.byteLength,
      lastModified: new Date().toISOString(),
    };
  }

  const nextImportedIds = new Set();

  for (const [groupIndex, group] of groups.entries()) {
    const adminId = group.sourceType === "project"
      ? `dribbble-project-${group.sourceId}`
      : `dribbble-shot-${group.sourceId}`;
    const existingProject = existingProjectsById.get(adminId);
    nextImportedIds.add(adminId);

    console.log(`[${groupIndex + 1}/${groups.length}] Syncing ${group.title} (${adminId})...`);

    const rawAssets = unique(
      group.shots.flatMap((shot) => getImageCandidates(shot).map((asset) => JSON.stringify(asset)))
    ).map((asset) => JSON.parse(asset));

    if (rawAssets.length === 0) {
      console.warn(`Skipping ${group.title} because no importable images were found.`);
      continue;
    }

    if (dryRun) {
      console.log(`  Dry run: would import ${rawAssets.length} images.`);
      continue;
    }

    if (cleanProjectAssets) {
      await deletePrefix(`projects/${adminId}/`);
    }

    const uploadedAssets = await mapWithConcurrency(rawAssets, assetConcurrency, (asset, index) =>
      uploadRemoteAsset(adminId, asset, index)
    );

    const adminProject = createAdminProjectSkeleton(group, existingProject, uploadedAssets, importStatus);
    const saveResponse = await adminRequest(`/api/admin/projects/${adminProject.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project: adminProject }),
    });
    await ensureOk(saveResponse, `Save project ${adminProject.id}`);
  }

  if (!dryRun && pruneMissingImports) {
    const staleImports = existingProjects
      .filter((project) => project.id.startsWith("dribbble-") && !nextImportedIds.has(project.id));

    for (const staleProject of staleImports) {
      console.log(`Removing stale imported project ${staleProject.id}...`);
      await deletePrefix(staleProject.storagePath);
      const deleteResponse = await adminRequest(`/api/admin/projects/${staleProject.id}`, {
        method: "DELETE",
      });
      await ensureOk(deleteResponse, `Delete project ${staleProject.id}`);
    }
  }

  console.log(
    dryRun
      ? `Dry run complete. ${groups.length} groups were prepared for import.`
      : `Dribbble sync complete. Imported ${nextImportedIds.size} groups as ${importStatus} projects.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
