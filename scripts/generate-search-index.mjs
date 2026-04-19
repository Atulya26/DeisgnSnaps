#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const projectsRoot = path.join(repoRoot, "public", "content", "projects");
const outputPath = path.join(projectsRoot, "search-index.json");

function stripHtmlToText(html) {
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

async function main() {
  const filenames = (await readdir(projectsRoot))
    .filter((filename) => filename.endsWith(".json"))
    .filter((filename) => filename !== "index.json" && filename !== "search-index.json")
    .sort();

  const projects = [];

  for (const filename of filenames) {
    const filePath = path.join(projectsRoot, filename);
    const raw = await readFile(filePath, "utf8");
    const project = JSON.parse(raw);

    if (project.status !== "published") continue;

    const blockText = (project.blocks ?? [])
      .filter((block) => block.type === "text")
      .map((block) => stripHtmlToText(block.html))
      .filter(Boolean);

    projects.push({
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
        project.description,
        ...(project.tags ?? []),
        ...blockText,
      ]
        .filter(Boolean)
        .join("\n")
        .trim(),
    });
  }

  projects.sort((a, b) => a.sortOrder - b.sortOrder);

  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        projects,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`Generated search index for ${projects.length} projects.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
