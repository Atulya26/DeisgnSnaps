#!/usr/bin/env node

import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { chromium } from "playwright";

const DEFAULT_MAX_PAGES = 12;
const DEFAULT_DELAY_MS = 900;
const DEFAULT_ASSET_CONCURRENCY = 4;
const DEFAULT_GIF_DURATION_SEC = 4;
const DEFAULT_GIF_FPS = 12;
const DEFAULT_GIF_MAX_WIDTH = 960;
const DEFAULT_CARD_THUMB_WIDTH = 1200;
const DEFAULT_CARD_THUMB_QUALITY = 72;
const MAX_TAGS = 12;

const repoRoot = process.cwd();
const outputAssetsRoot = path.join(repoRoot, "public", "portfolio", "dribbble");
const outputDataFile = path.join(
  repoRoot,
  "src",
  "app",
  "components",
  "portfolioData.local.generated.ts"
);

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getBooleanEnv(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
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

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function isVideoUrl(url) {
  const ext = extFromUrl(url);
  return ["mp4", "mov", "webm", "m4v"].includes(ext);
}

function parseShotId(shotUrl) {
  const match = shotUrl.match(/\/shots\/(\d+)-/);
  return match?.[1] || slugify(shotUrl);
}

function pickCategory(tags) {
  return tags[0] || "Dribbble";
}

async function ensureOk(response, context) {
  if (response.ok) return response;
  const text = await response.text();
  throw new Error(`${context} failed (${response.status}): ${text.trim() || "Unknown error"}`);
}

async function downloadToFile(url, filePath, context) {
  const response = await fetch(url);
  await ensureOk(response, context);
  if (!response.body) {
    throw new Error(`${context} failed: response body was empty.`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(filePath));
  return response.headers.get("content-type") || "";
}

async function checkFfmpegAvailable() {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}

async function createGifFromVideo(inputPath, outputPath, { durationSec, fps, maxWidth }) {
  const filter = [
    `fps=${fps}`,
    `scale=w='if(gt(iw,${maxWidth}),${maxWidth},iw)':h=-1:flags=lanczos`,
    "split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
  ].join(",");

  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-v",
        "error",
        "-ss",
        "0",
        "-t",
        String(durationSec),
        "-i",
        inputPath,
        "-vf",
        filter,
        "-loop",
        "0",
        outputPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function createCardThumbnail(inputPath, outputPath, { maxWidth, quality }) {
  const filter = `scale=w='if(gt(iw,${maxWidth}),${maxWidth},iw)':h=-2:flags=lanczos`;

  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-v",
        "error",
        "-i",
        inputPath,
        "-vf",
        filter,
        "-frames:v",
        "1",
        "-c:v",
        "libwebp",
        "-compression_level",
        "6",
        "-quality",
        String(quality),
        outputPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
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

    const videos = Array.from(document.querySelectorAll("video")).map((video) => ({
      src: video.currentSrc || video.getAttribute("src") || "",
      poster: video.getAttribute("poster") || "",
    }));

    const metaImages = [
      document.querySelector("meta[property='og:image']")?.getAttribute("content") || "",
      document.querySelector("meta[name='twitter:image']")?.getAttribute("content") || "",
    ].filter(Boolean);

    return {
      title,
      publishedAt,
      descriptionLines,
      tags,
      images,
      imageLinks,
      videos,
      metaImages,
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
  candidates.push(...scraped.videos.map((video) => video.poster).filter(Boolean));
  candidates.push(...scraped.metaImages);

  return unique(
    candidates
      .map((url) => normaliseImageUrl(url))
      .filter((url) => url.includes("cdn.dribbble.com/userupload/"))
  );
}

function pickBestVideoCandidates(scraped) {
  return unique(
    scraped.videos
      .map((video) => normaliseImageUrl(video.src))
      .filter((url) => url.includes("cdn.dribbble.com/userupload/"))
      .filter((url) => isVideoUrl(url))
  );
}

function buildProjectRecord(shot, { cardImageUrl, coverImageUrl, galleryImageUrls, motionPreviewUrls }) {
  const galleryImages = unique([
    ...motionPreviewUrls,
    ...galleryImageUrls,
  ]);
  const textBlocks = shot.descriptionLines.length > 0
    ? [
        {
          type: "text",
          id: `text-description-${shot.id}`,
          content: `<h2>Overview</h2>${shot.descriptionLines
            .map((line) => `<p>${escapeHtml(line)}</p>`)
            .join("")}`,
        },
      ]
    : [];

  return {
    id: `dribbble-shot-${shot.id}`,
    title: shot.title,
    category: pickCategory(shot.tags),
    year: shot.publishedAt
      ? String(new Date(shot.publishedAt).getUTCFullYear())
      : String(new Date().getUTCFullYear()),
    imageUrl: cardImageUrl || coverImageUrl,
    coverImageUrl,
    description: shot.descriptionLines.join("\n\n"),
    tags: shot.tags,
    galleryImages,
    contentBlocks: textBlocks,
  };
}

function formatGeneratedModule(projects) {
  return `import type { Project } from "./types";

// Generated by \`npm run sync:dribbble:local\`. This keeps the public
// portfolio fully local-first for static hosting while the admin panel code
// remains in the repo for future use.
export const localPortfolioProjects: Omit<Project, "x" | "y" | "width" | "height">[] = ${JSON.stringify(
    projects,
    null,
    2
  )};
`;
}

async function resetOutputDirectory() {
  await mkdir(outputAssetsRoot, { recursive: true });
  const entries = await readdir(outputAssetsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".gitkeep") continue;
    await rm(path.join(outputAssetsRoot, entry.name), { recursive: true, force: true });
  }
}

async function main() {
  const profileUrl = getRequiredEnv("DRIBBBLE_PROFILE_URL");
  const maxPages = getNumberEnv("DRIBBBLE_MAX_PAGES", DEFAULT_MAX_PAGES);
  const delayMs = getNumberEnv("DRIBBBLE_PUBLIC_DELAY_MS", DEFAULT_DELAY_MS);
  const assetConcurrency = getNumberEnv("DRIBBBLE_ASSET_CONCURRENCY", DEFAULT_ASSET_CONCURRENCY);
  const gifDurationSec = getNumberEnv("DRIBBBLE_GIF_DURATION_SEC", DEFAULT_GIF_DURATION_SEC);
  const gifFps = getNumberEnv("DRIBBBLE_GIF_FPS", DEFAULT_GIF_FPS);
  const gifMaxWidth = getNumberEnv("DRIBBBLE_GIF_MAX_WIDTH", DEFAULT_GIF_MAX_WIDTH);
  const cardThumbWidth = getNumberEnv("DRIBBBLE_CARD_THUMB_WIDTH", DEFAULT_CARD_THUMB_WIDTH);
  const cardThumbQuality = getNumberEnv("DRIBBBLE_CARD_THUMB_QUALITY", DEFAULT_CARD_THUMB_QUALITY);
  const shouldGenerateGifs = getBooleanEnv("DRIBBBLE_GENERATE_GIFS", true);
  const cleanLocal = getBooleanEnv("DRIBBBLE_SYNC_CLEAN_LOCAL", true);
  const dryRun = getBooleanEnv("DRIBBBLE_SYNC_DRY_RUN", false);
  const ffmpegAvailable = await checkFfmpegAvailable();

  if (shouldGenerateGifs && !ffmpegAvailable) {
    console.warn("ffmpeg was not found. Video shots will import as still screenshots only.");
  }
  if (!ffmpegAvailable) {
    console.warn("ffmpeg was not found. Cover thumbnails will fall back to the original images.");
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

    if (shotLinks.length === 0) {
      throw new Error("No public shots were found on the profile page.");
    }

    const scrapedShots = [];
    for (const [index, shotUrl] of shotLinks.entries()) {
      console.log(`[${index + 1}/${shotLinks.length}] Scraping ${shotUrl}`);
      const scraped = await scrapeShot(page, shotUrl, delayMs);
      const images = pickBestImageCandidates(scraped);
      const videos = pickBestVideoCandidates(scraped);
      const shotId = parseShotId(shotUrl);

      if (!scraped.title || (images.length === 0 && videos.length === 0)) {
        console.warn(`Skipping ${shotUrl} because title or media content could not be resolved.`);
        continue;
      }

      scrapedShots.push({
        id: shotId,
        url: shotUrl,
        title: scraped.title,
        publishedAt: scraped.publishedAt,
        descriptionLines: scraped.descriptionLines,
        tags: unique(scraped.tags).slice(0, MAX_TAGS),
        images,
        videos,
      });
    }

    if (scrapedShots.length === 0) {
      throw new Error("No Dribbble shots could be scraped into a usable local dataset.");
    }

    if (dryRun) {
      console.log(`Dry run complete. Prepared ${scrapedShots.length} shots for local import.`);
      return;
    }

    if (cleanLocal) {
      await resetOutputDirectory();
    } else {
      await mkdir(outputAssetsRoot, { recursive: true });
    }

    const localProjects = [];

    for (const [index, shot] of scrapedShots.entries()) {
      console.log(`[${index + 1}/${scrapedShots.length}] Downloading ${shot.title}`);
      const shotDir = path.join(outputAssetsRoot, shot.id);
      await mkdir(shotDir, { recursive: true });

      const localImageAssets = await mapWithConcurrency(shot.images, assetConcurrency, async (imageUrl, imageIndex) => {
        const response = await fetch(imageUrl);
        await ensureOk(response, `Download asset ${imageUrl}`);
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const extension = guessExtension(imageUrl, contentType);
        const basename = `${String(imageIndex + 1).padStart(2, "0")}-${slugify(shot.title)}.${extension}`;
        const filePath = path.join(shotDir, basename);
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(filePath, buffer);
        return {
          filePath,
          publicPath: `/portfolio/dribbble/${shot.id}/${basename}`,
        };
      });

      const localGifAssets = [];

      if (ffmpegAvailable && shot.videos.length > 0) {
        for (const [videoIndex, videoUrl] of shot.videos.entries()) {
          const tempExtension = extFromUrl(videoUrl) || "mp4";
          const tempVideoPath = path.join(
            shotDir,
            `tmp-motion-${String(videoIndex + 1).padStart(2, "0")}.${tempExtension}`
          );
          const gifBasename = `${String(videoIndex + 1).padStart(2, "0")}-${slugify(shot.title)}-motion.gif`;
          const gifPath = path.join(shotDir, gifBasename);

          try {
            await downloadToFile(videoUrl, tempVideoPath, `Download video ${videoUrl}`);
            await createGifFromVideo(tempVideoPath, gifPath, {
              durationSec: gifDurationSec,
              fps: gifFps,
              maxWidth: gifMaxWidth,
            });
            localGifAssets.push(`/portfolio/dribbble/${shot.id}/${gifBasename}`);
          } catch (error) {
            console.warn(
              `GIF generation failed for ${shot.title} (${videoUrl}): ${error instanceof Error ? error.message : String(error)}`
            );
          } finally {
            await unlink(tempVideoPath).catch(() => {});
          }
        }
      }

      const coverImageAsset = localImageAssets[0];
      const galleryImageUrls = localImageAssets.slice(1).map((asset) => asset.publicPath);
      let cardImageUrl = coverImageAsset?.publicPath || "";

      if (ffmpegAvailable && coverImageAsset) {
        const thumbBasename = `00-card-${slugify(shot.title)}.webp`;
        const thumbFilePath = path.join(shotDir, thumbBasename);

        try {
          await createCardThumbnail(coverImageAsset.filePath, thumbFilePath, {
            maxWidth: cardThumbWidth,
            quality: cardThumbQuality,
          });
          cardImageUrl = `/portfolio/dribbble/${shot.id}/${thumbBasename}`;
        } catch (error) {
          console.warn(
            `Thumbnail generation failed for ${shot.title}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      localProjects.push(buildProjectRecord(shot, {
        cardImageUrl,
        coverImageUrl: coverImageAsset?.publicPath || cardImageUrl,
        galleryImageUrls,
        motionPreviewUrls: localGifAssets,
      }));
    }

    await writeFile(outputDataFile, formatGeneratedModule(localProjects), "utf8");
    console.log(`Local Dribbble sync complete. Wrote ${localProjects.length} projects to the repo.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
