#!/usr/bin/env node

import { chromium } from "playwright";

const MAX_TAGS = 12;
const DEFAULT_MAX_PAGES = 12;
const DEFAULT_DELAY_MS = 900;
const DEFAULT_ASSET_CONCURRENCY = 4;

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
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

function toParagraphHtml(lines) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
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

function buildAdminProjectId(shotId) {
  return `dribbble-shot-${shotId}`;
}

function parseShotId(shotUrl) {
  const match = shotUrl.match(/\/shots\/(\d+)-/);
  return match?.[1] || shotUrl;
}

function normaliseImageUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

async function ensureOk(response, context) {
  if (response.ok) return response;
  const text = await response.text();
  throw new Error(`${context} failed (${response.status}): ${text.trim() || "Unknown error"}`);
}

async function parseJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 900;
      const timer = window.setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        const maxScroll = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );
        if (window.scrollY + window.innerHeight >= maxScroll - 40 || total > maxScroll + 2000) {
          window.clearInterval(timer);
          resolve();
        }
      }, 180);
    });
  });
}

async function collectProfileShotLinks(page, profileUrl, maxPages, delayMs) {
  const shotLinks = [];
  const seen = new Set();

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const url = pageNumber === 1 ? profileUrl : `${profileUrl}${profileUrl.includes("?") ? "&" : "?"}page=${pageNumber}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await sleep(delayMs);

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a.shot-thumbnail-link"))
        .map((anchor) => anchor.getAttribute("href"))
        .filter(Boolean)
        .map((href) => new URL(href, window.location.origin).toString())
    );

    const fresh = links.filter((link) => !seen.has(link));
    if (fresh.length === 0) break;

    for (const link of fresh) {
      seen.add(link);
      shotLinks.push(link);
    }
  }

  return shotLinks;
}

async function scrapeShot(page, shotUrl, delayMs) {
  await page.goto(shotUrl, { waitUntil: "networkidle" });
  await autoScroll(page);
  await sleep(delayMs);

  return page.evaluate(() => {
    const title = document.querySelector("h1")?.textContent?.trim() || "";
    const timeEl = document.querySelector("time[datetime]");
    const publishedAt = timeEl?.getAttribute("datetime") || "";
    const descriptionLines = Array.from(
      document.querySelectorAll(".content-block-container.shot-only .formatted-text.content-block p")
    )
      .map((node) => node.textContent?.trim() || "")
      .filter(Boolean);
    const tags = Array.from(document.querySelectorAll("a[href*='/tags/']"))
      .map((anchor) => anchor.textContent?.trim() || "")
      .filter(Boolean);

    const images = Array.from(
      document.querySelectorAll(".content-block-container.shot-only img.content-block")
    ).map((img) => ({
      src: img.getAttribute("src") || "",
      currentSrc: img.currentSrc || "",
      srcset: img.getAttribute("srcset") || "",
    }));

    const imageLinks = Array.from(
      document.querySelectorAll("a[href*='cdn.dribbble.com/userupload/']")
    )
      .map((anchor) => anchor.href)
      .filter(Boolean);

    return {
      title,
      publishedAt,
      descriptionLines,
      tags,
      images,
      imageLinks,
    };
  });
}

function pickBestImageCandidates(scraped) {
  const candidates = [];

  for (const image of scraped.images) {
    if (image.currentSrc) candidates.push(image.currentSrc);
    if (image.src) candidates.push(image.src);
    for (const chunk of image.srcset.split(",")) {
      const url = chunk.trim().split(/\s+/)[0];
      if (url) candidates.push(url);
    }
  }

  candidates.push(...scraped.imageLinks);

  return unique(
    candidates
      .map((url) => normaliseImageUrl(url))
      .filter((url) => url.includes("cdn.dribbble.com/userupload/"))
  );
}

function pickCategory(tags) {
  return tags[0] || "Dribbble";
}

function buildProjectRecord(shot, uploadedAssets, existingProject, status) {
  const adminId = buildAdminProjectId(shot.id);
  const description = shot.descriptionLines.join("\n\n");
  const textBlocks = description
    ? [{
        type: "text",
        id: `text-description-${shot.id}`,
        content: toParagraphHtml(shot.descriptionLines),
      }]
    : [];
  const imageBlocks = uploadedAssets.map((asset, index) => ({
    type: "image",
    id: `image-${shot.id}-${String(index + 1).padStart(2, "0")}`,
    url: asset.url,
    key: asset.key,
    caption: shot.title,
  }));

  return {
    id: adminId,
    storagePath: `projects/${adminId}/`,
    title: shot.title,
    category: pickCategory(shot.tags),
    year: shot.publishedAt
      ? String(new Date(shot.publishedAt).getUTCFullYear())
      : String(new Date().getUTCFullYear()),
    description,
    tags: shot.tags.slice(0, MAX_TAGS),
    richContent: textBlocks.map((block) => block.content).join("\n\n"),
    coverImageKey: uploadedAssets[0]?.url || existingProject?.coverImageKey || "",
    images: uploadedAssets.map((asset) => ({
      key: asset.key,
      name: asset.key.split("/").pop() || asset.key,
      url: asset.url,
      size: asset.size,
      lastModified: asset.lastModified,
    })),
    contentBlocks: [...imageBlocks, ...textBlocks],
    x: existingProject?.x ?? 0,
    y: existingProject?.y ?? 0,
    width: existingProject?.width ?? 0,
    height: existingProject?.height ?? 0,
    status,
    createdAt: existingProject?.createdAt || shot.publishedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const profileUrl = getRequiredEnv("DRIBBBLE_PROFILE_URL");
  const portfolioApiBase = normaliseBaseUrl(
    getOptionalEnv("PORTFOLIO_API_BASE_URL") ||
    getOptionalEnv("VITE_API_BASE_URL") ||
    "http://127.0.0.1:8787"
  );
  const importStatus = getOptionalEnv("DRIBBBLE_IMPORT_STATUS", "published") === "draft"
    ? "draft"
    : "published";
  const maxPages = getNumberEnv("DRIBBBLE_MAX_PAGES", DEFAULT_MAX_PAGES);
  const delayMs = getNumberEnv("DRIBBBLE_PUBLIC_DELAY_MS", DEFAULT_DELAY_MS);
  const assetConcurrency = getNumberEnv("DRIBBBLE_ASSET_CONCURRENCY", DEFAULT_ASSET_CONCURRENCY);
  const pruneMissingImports = getBooleanEnv("DRIBBBLE_SYNC_PRUNE", true);
  const cleanProjectAssets = getBooleanEnv("DRIBBBLE_SYNC_CLEAN_ASSETS", true);
  const dryRun = getBooleanEnv("DRIBBBLE_SYNC_DRY_RUN", false);
  const adminEmail = dryRun ? "" : getRequiredEnv("PORTFOLIO_ADMIN_EMAIL");
  const adminPassword = dryRun ? "" : getRequiredEnv("PORTFOLIO_ADMIN_PASSWORD");

  let adminCookie = "";

  async function adminRequest(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (adminCookie) headers.set("cookie", adminCookie);
    const response = await fetch(`${portfolioApiBase}${path}`, {
      ...init,
      headers,
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) adminCookie = setCookie.split(";")[0];
    return response;
  }

  async function deletePrefix(prefix) {
    const response = await adminRequest(`/api/admin/assets?prefix=${encodeURIComponent(prefix)}`, {
      method: "DELETE",
    });
    await ensureOk(response, `Delete assets under ${prefix}`);
  }

  async function uploadRemoteAsset(adminId, imageUrl, index, title) {
    const response = await fetch(imageUrl);
    await ensureOk(response, `Download asset ${imageUrl}`);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = guessExtension(imageUrl, contentType);
    const basename = `${String(index + 1).padStart(2, "0")}-${slugify(title)}.${extension}`;
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
      size: buffer.byteLength,
      lastModified: new Date().toISOString(),
    };
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 2200 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  });

  try {
    console.log("Collecting public shot links from Dribbble profile...");
    const shotLinks = await collectProfileShotLinks(page, profileUrl, maxPages, delayMs);
    console.log(`Found ${shotLinks.length} public shots.`);

    const scrapedShots = [];
    for (const [index, shotUrl] of shotLinks.entries()) {
      console.log(`[${index + 1}/${shotLinks.length}] Scraping ${shotUrl}`);
      const scraped = await scrapeShot(page, shotUrl, delayMs);
      const id = parseShotId(shotUrl);
      const images = pickBestImageCandidates(scraped);

      if (!scraped.title || images.length === 0) {
        console.warn(`Skipping ${shotUrl} because title or image content could not be resolved.`);
        continue;
      }

      scrapedShots.push({
        id,
        url: shotUrl,
        title: scraped.title,
        publishedAt: scraped.publishedAt,
        descriptionLines: scraped.descriptionLines,
        tags: unique(scraped.tags),
        images,
      });
    }

    if (scrapedShots.length === 0) {
      throw new Error("No public Dribbble shots could be scraped from the profile.");
    }

    if (dryRun) {
      console.log(`Dry run complete. Prepared ${scrapedShots.length} public shots for import.`);
      return;
    }

    console.log("Logging into portfolio admin API...");
    const loginResponse = await adminRequest("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    await ensureOk(loginResponse, "Admin login");

    const existingProjectsResponse = await adminRequest("/api/admin/projects");
    const existingProjects = ((await parseJson(await ensureOk(existingProjectsResponse, "Fetch admin projects")))?.projects ?? []);
    const existingById = new Map(existingProjects.map((project) => [project.id, project]));
    const importedIds = new Set();

    for (const [index, shot] of scrapedShots.entries()) {
      const adminId = buildAdminProjectId(shot.id);
      importedIds.add(adminId);
      console.log(`[${index + 1}/${scrapedShots.length}] Importing ${shot.title} -> ${adminId}`);

      if (cleanProjectAssets) {
        await deletePrefix(`projects/${adminId}/`);
      }

      const uploadedAssets = await mapWithConcurrency(
        shot.images,
        assetConcurrency,
        (imageUrl, imageIndex) => uploadRemoteAsset(adminId, imageUrl, imageIndex, shot.title)
      );

      const record = buildProjectRecord(shot, uploadedAssets, existingById.get(adminId), importStatus);
      const saveResponse = await adminRequest(`/api/admin/projects/${record.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: record }),
      });
      await ensureOk(saveResponse, `Save ${record.id}`);
    }

    if (pruneMissingImports) {
      const staleProjects = existingProjects.filter(
        (project) => project.id.startsWith("dribbble-shot-") && !importedIds.has(project.id)
      );

      for (const staleProject of staleProjects) {
        console.log(`Removing stale import ${staleProject.id}`);
        await deletePrefix(staleProject.storagePath);
        const deleteResponse = await adminRequest(`/api/admin/projects/${staleProject.id}`, {
          method: "DELETE",
        });
        await ensureOk(deleteResponse, `Delete ${staleProject.id}`);
      }
    }

    console.log(`Public Dribbble sync complete. Imported ${scrapedShots.length} shots.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
