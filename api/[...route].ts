import type { AdminProjectDocument } from "../src/content/schema.ts";
import {
  buildSearchIndexFile,
  buildProjectWriteSet,
  buildSingleProjectWriteSet,
  getAdminProjectPath,
  getRepoFilePathFromPublicUrl,
  normalizeProjectForWrite,
  readAdminIndex,
  readAdminProjectBySlug,
} from "./_lib/content.ts";
import {
  commitFiles,
  getBinaryFileBase64,
  githubRequest,
  listDirectory,
  type GitHubRepoConfig,
} from "./_lib/github.ts";
import {
  listLocalDirectory,
  readLocalAdminIndex,
  readLocalAdminProjectBySlug,
  readLocalBinaryBase64,
  writeLocalRepoFiles,
} from "./_lib/local.ts";
import {
  buildSessionCookie,
  buildStateCookie,
  clearSessionCookie,
  clearStateCookie,
  readSessionCookie,
  readStateCookie,
  signToken,
  verifyToken,
} from "./_lib/session.ts";

interface SessionPayload {
  login: string;
  avatarUrl?: string;
  name?: string;
  accessToken: string;
  exp: number;
}

interface StatePayload {
  nonce: string;
  exp: number;
}

const LOCAL_DEV_SECRET = "portfolio-local-dev-session";

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function redirect(location: string, headers?: Headers) {
  const nextHeaders = headers ?? new Headers();
  nextHeaders.set("Location", location);
  return new Response(null, { status: 302, headers: nextHeaders });
}

function secureCookieFor(request: Request) {
  return new URL(request.url).protocol === "https:";
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getAllowedUsers() {
  const raw = process.env.GITHUB_APP_ALLOWED_USERS ?? process.env.GITHUB_ALLOWED_USERS ?? "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function hasGitHubConfig() {
  return Boolean(
    process.env.GITHUB_APP_CLIENT_ID?.trim() &&
    process.env.GITHUB_APP_CLIENT_SECRET?.trim() &&
    process.env.GITHUB_REPO_OWNER?.trim() &&
    process.env.GITHUB_REPO_NAME?.trim() &&
    process.env.SESSION_SECRET?.trim()
  );
}

function isLocalDevMode(request: Request) {
  const hostname = new URL(request.url).hostname;
  return (hostname === "127.0.0.1" || hostname === "localhost") && !hasGitHubConfig();
}

function getRepoConfig(): GitHubRepoConfig {
  return {
    owner: getRequiredEnv("GITHUB_REPO_OWNER"),
    repo: getRequiredEnv("GITHUB_REPO_NAME"),
    branch: process.env.GITHUB_REPO_BRANCH?.trim() || "main",
  };
}

async function readSession(request: Request) {
  const token = readSessionCookie(request);
  if (!token) return null;
  const payload = await verifyToken<SessionPayload>(token, getRequiredEnv("SESSION_SECRET"));
  if (!payload || payload.exp <= Date.now()) return null;
  return payload;
}

async function requireSession(request: Request) {
  const session = await readSession(request);
  if (!session) return null;
  return session;
}

async function fetchGitHubUser(accessToken: string) {
  const response = await githubRequest(accessToken, "/user");
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user (${response.status})`);
  }
  const body = (await response.json()) as {
    login: string;
    avatar_url?: string;
    name?: string;
  };
  return {
    login: body.login,
    avatarUrl: body.avatar_url,
    name: body.name,
  };
}

function toBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function getProjectSummaryRecord(project: AdminProjectDocument) {
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
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
  };
}

async function buildAliasWrites(
  accessToken: string,
  repo: GitHubRepoConfig,
  project: AdminProjectDocument,
  pendingAssetContents = new Map<string, string>()
) {
  const writes: Array<{ path: string; content: string; encoding: "base64" }> = [];
  const selectedCover = project.assets.find((asset) => asset.id === project.coverAssetId);
  const selectedCard = project.assets.find((asset) => asset.id === project.cardAssetId);

  if (selectedCover) {
    const repoPath = getRepoFilePathFromPublicUrl(selectedCover.src);
    const base64 = pendingAssetContents.get(repoPath) ?? await getBinaryFileBase64(
      accessToken,
      repo,
      repoPath
    );
    if (base64) {
      writes.push({
        path: getRepoFilePathFromPublicUrl(`/portfolio/projects/${project.slug}/cover.webp`),
        content: base64,
        encoding: "base64",
      });
    }
  }

  if (selectedCard) {
    const repoPath = getRepoFilePathFromPublicUrl(selectedCard.src);
    const base64 = pendingAssetContents.get(repoPath) ?? await getBinaryFileBase64(
      accessToken,
      repo,
      repoPath
    );
    if (base64) {
      writes.push({
        path: getRepoFilePathFromPublicUrl(`/portfolio/projects/${project.slug}/card.webp`),
        content: base64,
        encoding: "base64",
      });
    }
  }

  return writes;
}

async function readProjectById(accessToken: string, repo: GitHubRepoConfig, projectId: string) {
  const index = await readAdminIndex(accessToken, repo);
  const summary = index.find((project) => project.id === projectId);
  if (!summary) return null;
  const project = await readAdminProjectBySlug(accessToken, repo, summary.slug);
  return project ? normalizeProjectForWrite(project, { touch: false }) : null;
}

async function readAllProjects(accessToken: string, repo: GitHubRepoConfig) {
  const index = await readAdminIndex(accessToken, repo);
  const projects = await Promise.all(
    index
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => readAdminProjectBySlug(accessToken, repo, item.slug))
  );
  return projects.filter(Boolean).map((project) => normalizeProjectForWrite(project!, { touch: false }));
}

async function readLocalProjectById(projectId: string) {
  const index = await readLocalAdminIndex();
  const summary = index.find((project) => project.id === projectId);
  if (!summary) return null;
  const project = await readLocalAdminProjectBySlug(summary.slug);
  return project ? normalizeProjectForWrite(project, { touch: false }) : null;
}

async function readAllLocalProjects() {
  const index = await readLocalAdminIndex();
  const projects = await Promise.all(
    index
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => readLocalAdminProjectBySlug(item.slug))
  );
  return projects.filter(Boolean).map((project) => normalizeProjectForWrite(project!, { touch: false }));
}

async function buildLocalAliasWrites(
  project: AdminProjectDocument,
  pendingAssetContents = new Map<string, string>()
) {
  const writes: Array<{ path: string; content: string; encoding: "base64" }> = [];
  const selectedCover = project.assets.find((asset) => asset.id === project.coverAssetId);
  const selectedCard = project.assets.find((asset) => asset.id === project.cardAssetId);

  if (selectedCover) {
    const repoPath = getRepoFilePathFromPublicUrl(selectedCover.src);
    const base64 = pendingAssetContents.get(repoPath) ?? await readLocalBinaryBase64(repoPath);
    if (base64) {
      writes.push({
        path: getRepoFilePathFromPublicUrl(`/portfolio/projects/${project.slug}/cover.webp`),
        content: base64,
        encoding: "base64",
      });
    }
  }

  if (selectedCard) {
    const repoPath = getRepoFilePathFromPublicUrl(selectedCard.src);
    const base64 = pendingAssetContents.get(repoPath) ?? await readLocalBinaryBase64(repoPath);
    if (base64) {
      writes.push({
        path: getRepoFilePathFromPublicUrl(`/portfolio/projects/${project.slug}/card.webp`),
        content: base64,
        encoding: "base64",
      });
    }
  }

  return writes;
}

async function handleLocalDevRequest(request: Request, secure: boolean, pathname: string) {
  const localSessionSecret = LOCAL_DEV_SECRET;

  const readLocalSession = async () => {
    const token = readSessionCookie(request);
    if (!token) return null;
    const payload = await verifyToken<SessionPayload>(token, localSessionSecret);
    if (!payload || payload.exp <= Date.now()) return null;
    return payload;
  };

  const requireLocalSession = async () => {
    const session = await readLocalSession();
    if (!session) return null;
    return session;
  };

  if (request.method === "GET" && pathname === "/api/auth/github/start") {
    const sessionToken = await signToken(
      {
        login: process.env.USER?.trim() || "local-dev",
        name: "Local Dev",
        avatarUrl: undefined,
        accessToken: "",
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      localSessionSecret
    );

    const headers = new Headers();
    headers.append("Set-Cookie", buildSessionCookie(sessionToken, secure, 7 * 24 * 60 * 60));
    return redirect("/admin", headers);
  }

  if (request.method === "GET" && pathname === "/api/auth/github/callback") {
    return redirect("/admin");
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const headers = new Headers();
    headers.append("Set-Cookie", clearSessionCookie(secure));
    headers.append("Set-Cookie", clearStateCookie(secure));
    return json({ ok: true, mode: "local" }, { headers });
  }

  if (request.method === "GET" && pathname === "/api/admin/session") {
    const session = await readLocalSession();
    if (!session) return json({ authenticated: false, mode: "local" });
    return json({
      authenticated: true,
      mode: "local",
      user: {
        login: session.login,
        avatarUrl: session.avatarUrl,
        name: session.name,
      },
    });
  }

  if (!pathname.startsWith("/api/admin/")) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const session = await requireLocalSession();
  if (!session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.method === "GET" && pathname === "/api/admin/projects") {
    const projects = await readLocalAdminIndex();
    return json({ projects: projects.sort((a, b) => a.sortOrder - b.sortOrder), mode: "local" });
  }

  if (request.method === "POST" && pathname === "/api/admin/projects/reorder") {
    const body = (await request.json()) as { projectIds?: string[] };
    const projectIds = body.projectIds ?? [];
    const projects = await readAllLocalProjects();
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const orderedIds = new Set(projectIds);
    const reordered = [
      ...projectIds
        .map((projectId, index) => {
          const project = projectMap.get(projectId);
          if (!project) return null;
          return normalizeProjectForWrite({
            ...project,
            sortOrder: index,
          });
        })
        .filter(Boolean) as AdminProjectDocument[],
      ...projects.filter((project) => !orderedIds.has(project.id)),
    ].map((project, index) =>
      normalizeProjectForWrite({
        ...project,
        sortOrder: index,
      })
    );

    await writeLocalRepoFiles(buildProjectWriteSet(reordered));

    return json({
      projects: reordered.map(getProjectSummaryRecord),
      mode: "local",
    });
  }

  const assetDeleteMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)\/assets\/([^/]+)$/);
  if (assetDeleteMatch && request.method === "DELETE") {
    const projectId = decodeURIComponent(assetDeleteMatch[1]);
    const assetId = decodeURIComponent(assetDeleteMatch[2]);
    const currentProject = await readLocalProjectById(projectId);
    if (!currentProject) {
      return json({ error: "Project not found" }, { status: 404 });
    }

    const asset = currentProject.assets.find((entry) => entry.id === assetId);
    if (!asset || asset.role !== "gallery") {
      return json({ error: "Asset not found" }, { status: 404 });
    }

    const nextProject = normalizeProjectForWrite({
      ...currentProject,
      assets: currentProject.assets.filter((entry) => entry.id !== assetId),
      blocks: currentProject.blocks.filter((block) => block.type === "text" || block.assetId !== assetId),
      coverAssetId: currentProject.coverAssetId === assetId ? undefined : currentProject.coverAssetId,
      cardAssetId: currentProject.cardAssetId === assetId ? undefined : currentProject.cardAssetId,
    });

    const nextProjects = (await readAllLocalProjects()).map((entry) =>
      entry.id === projectId ? nextProject : entry
    );

    const aliasWrites = await buildLocalAliasWrites(nextProject);
    await writeLocalRepoFiles([
      {
        path: getRepoFilePathFromPublicUrl(asset.src),
        delete: true,
      },
      ...aliasWrites,
      ...buildSingleProjectWriteSet(nextProjects, nextProject),
    ]);

    return json({ project: nextProject, mode: "local" });
  }

  const assetUploadMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)\/assets$/);
  if (assetUploadMatch && request.method === "POST") {
    const projectId = decodeURIComponent(assetUploadMatch[1]);
    const project = await readLocalProjectById(projectId);
    if (!project) {
      return json({ error: "Project not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) {
      return json({ error: "No files uploaded" }, { status: 400 });
    }

    const existingNumbers = project.assets
      .filter((asset) => asset.role === "gallery")
      .map((asset) => Number(asset.id.replace("gallery-", "")))
      .filter((value) => Number.isFinite(value));
    let nextIndex = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;

    const newAssets = await Promise.all(
      files.map(async (file) => {
        const assetId = `gallery-${String(nextIndex).padStart(2, "0")}`;
        nextIndex += 1;
        const repoPath = `public/portfolio/projects/${project.slug}/${assetId}.webp`;
        return {
          asset: {
            id: assetId,
            kind: "image" as const,
            role: "gallery" as const,
            src: `/portfolio/projects/${project.slug}/${assetId}.webp`,
          },
          write: {
            path: repoPath,
            content: toBase64(await file.arrayBuffer()),
            encoding: "base64" as const,
          },
        };
      })
    );

    const pendingAssetContents = new Map(
      newAssets.map((entry) => [entry.write.path, entry.write.content])
    );
    const nextProject = normalizeProjectForWrite({
      ...project,
      assets: [...project.assets, ...newAssets.map((entry) => entry.asset)],
    });
    const nextProjects = (await readAllLocalProjects()).map((entry) =>
      entry.id === projectId ? nextProject : entry
    );
    const aliasWrites = await buildLocalAliasWrites(nextProject, pendingAssetContents);

    await writeLocalRepoFiles([
      ...newAssets.map((entry) => entry.write),
      ...aliasWrites,
      ...buildSingleProjectWriteSet(nextProjects, nextProject),
    ]);

    return json({ project: nextProject, mode: "local" });
  }

  const projectMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);

    if (request.method === "GET") {
      const project = await readLocalProjectById(projectId);
      if (!project) {
        return json({ error: "Project not found" }, { status: 404 });
      }
      return json({ project, mode: "local" });
    }

    if (request.method === "PUT") {
      const body = (await request.json()) as { project?: AdminProjectDocument } | AdminProjectDocument;
      const incoming = "project" in body ? body.project : body;
      if (!incoming || incoming.id !== projectId) {
        return json({ error: "Invalid project payload" }, { status: 400 });
      }

      const normalizedProject = normalizeProjectForWrite(incoming);
      const existingProjects = await readAllLocalProjects();
      const existingProject = existingProjects.find((entry) => entry.id === projectId);
      const nextProjects = existingProject
        ? existingProjects.map((entry) => (entry.id === projectId ? normalizedProject : entry))
        : [...existingProjects, normalizedProject];

      const aliasWrites = await buildLocalAliasWrites(normalizedProject);
      await writeLocalRepoFiles([
        ...aliasWrites,
        ...buildSingleProjectWriteSet(nextProjects, normalizedProject),
      ]);

      return json({ project: normalizedProject, mode: "local" });
    }

    if (request.method === "DELETE") {
      const index = await readLocalAdminIndex();
      const summary = index.find((entry) => entry.id === projectId);
      if (!summary) {
        return json({ ok: true, mode: "local" });
      }

      const project = await readLocalAdminProjectBySlug(summary.slug);
      const remainingProjects = (await readAllLocalProjects()).filter((entry) => entry.id !== projectId);
      const nextIndex = index.filter((entry) => entry.id !== projectId);
      const projectFiles = new Set<string>([
        getAdminProjectPath(summary.slug),
        `public/content/projects/${summary.slug}.json`,
        `public/portfolio/projects/${summary.slug}/card.webp`,
        `public/portfolio/projects/${summary.slug}/cover.webp`,
      ]);

      if (project) {
        for (const asset of project.assets) {
          projectFiles.add(getRepoFilePathFromPublicUrl(asset.src));
        }
      } else {
        const existingAssets = await listLocalDirectory(`public/portfolio/projects/${summary.slug}`);
        for (const asset of existingAssets) {
          if (asset.type === "file") projectFiles.add(asset.path);
        }
      }

      await writeLocalRepoFiles([
        {
          path: "content/admin/index.json",
          content: `${JSON.stringify({ projects: nextIndex }, null, 2)}\n`,
          encoding: "utf-8",
        },
        {
          path: "public/content/projects/index.json",
          content: `${JSON.stringify({
            projects: nextIndex
              .filter((project) => project.status === "published")
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
          }, null, 2)}\n`,
          encoding: "utf-8",
        },
        {
          path: "public/content/projects/search-index.json",
          content: `${JSON.stringify(buildSearchIndexFile(remainingProjects), null, 2)}\n`,
          encoding: "utf-8",
        },
        ...[...projectFiles].map((filePath) => ({
          path: filePath,
          delete: true as const,
        })),
      ]);

      return json({ ok: true, mode: "local" });
    }
  }

  return json({ error: "Not found" }, { status: 404 });
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const secure = secureCookieFor(request);
  const pathname = url.pathname;
  const authConfigured = hasGitHubConfig();

  try {
    if (isLocalDevMode(request)) {
      return await handleLocalDevRequest(request, secure, pathname);
    }

    if (request.method === "GET" && pathname === "/api/auth/github/start") {
      if (!authConfigured) {
        return redirect("/admin/login?error=auth_config");
      }
      const secret = getRequiredEnv("SESSION_SECRET");
      const clientId = getRequiredEnv("GITHUB_APP_CLIENT_ID");
      const nonce = crypto.randomUUID();
      const state = await signToken(
        { nonce, exp: Date.now() + 10 * 60 * 1000 },
        secret
      );
      const redirectUri = `${url.origin}/api/auth/github/callback`;
      const authUrl = new URL("https://github.com/login/oauth/authorize");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "repo");
      authUrl.searchParams.set("state", state);

      const headers = new Headers();
      headers.append("Set-Cookie", buildStateCookie(state, secure, 10 * 60));
      return redirect(authUrl.toString(), headers);
    }

    if (request.method === "GET" && pathname === "/api/auth/github/callback") {
      if (!authConfigured) {
        return redirect("/admin/login?error=auth_config");
      }
      const secret = getRequiredEnv("SESSION_SECRET");
      const storedState = readStateCookie(request);
      const nextState = url.searchParams.get("state") ?? "";
      const code = url.searchParams.get("code") ?? "";

      if (!storedState || !nextState || storedState !== nextState || !code) {
        return redirect("/admin/login");
      }

      const statePayload = await verifyToken<StatePayload>(storedState, secret);
      if (!statePayload || statePayload.exp <= Date.now()) {
        return redirect("/admin/login");
      }

      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: getRequiredEnv("GITHUB_APP_CLIENT_ID"),
          client_secret: getRequiredEnv("GITHUB_APP_CLIENT_SECRET"),
          code,
          redirect_uri: `${url.origin}/api/auth/github/callback`,
        }),
      });

      if (!response.ok) {
        return redirect("/admin/login");
      }

      const oauth = (await response.json()) as { access_token?: string };
      if (!oauth.access_token) {
        return redirect("/admin/login");
      }

      const user = await fetchGitHubUser(oauth.access_token);
      const allowedUsers = getAllowedUsers();
      if (allowedUsers.size > 0 && !allowedUsers.has(user.login.toLowerCase())) {
        return redirect("/admin/login");
      }

      const sessionToken = await signToken(
        {
          ...user,
          accessToken: oauth.access_token,
          exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
        },
        secret
      );

      const headers = new Headers();
      headers.append("Set-Cookie", buildSessionCookie(sessionToken, secure, 14 * 24 * 60 * 60));
      headers.append("Set-Cookie", clearStateCookie(secure));
      return redirect("/admin", headers);
    }

    if (request.method === "POST" && pathname === "/api/auth/logout") {
      const headers = new Headers();
      headers.append("Set-Cookie", clearSessionCookie(secure));
      headers.append("Set-Cookie", clearStateCookie(secure));
      return json({ ok: true }, { headers });
    }

    if (request.method === "GET" && pathname === "/api/admin/session") {
      const session = await readSession(request);
      if (!session) {
        return json({ authenticated: false, authConfigured, mode: "github" });
      }
      return json({
        authenticated: true,
        authConfigured,
        mode: "github",
        user: {
          login: session.login,
          avatarUrl: session.avatarUrl,
          name: session.name,
        },
      });
    }

    if (!pathname.startsWith("/api/admin/")) {
      return json({ error: "Not found" }, { status: 404 });
    }

    const session = await requireSession(request);
    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const repo = getRepoConfig();

    if (request.method === "GET" && pathname === "/api/admin/projects") {
      const projects = await readAdminIndex(session.accessToken, repo);
      return json({ projects: projects.sort((a, b) => a.sortOrder - b.sortOrder) });
    }

    if (request.method === "POST" && pathname === "/api/admin/projects/reorder") {
      const body = (await request.json()) as { projectIds?: string[] };
      const projectIds = body.projectIds ?? [];
      const projects = await readAllProjects(session.accessToken, repo);
      const projectMap = new Map(projects.map((project) => [project.id, project]));
      const orderedIds = new Set(projectIds);
      const reordered = [
        ...projectIds
        .map((projectId, index) => {
          const project = projectMap.get(projectId);
          if (!project) return null;
          return normalizeProjectForWrite({
            ...project,
            sortOrder: index,
          });
        })
        .filter(Boolean) as AdminProjectDocument[],
        ...projects.filter((project) => !orderedIds.has(project.id)),
      ].map((project, index) =>
        normalizeProjectForWrite({
          ...project,
          sortOrder: index,
        })
      );

      await commitFiles(
        session.accessToken,
        repo,
        "Reorder portfolio projects",
        buildProjectWriteSet(reordered)
      );

      return json({
        projects: reordered.map(getProjectSummaryRecord),
      });
    }

    const assetDeleteMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)\/assets\/([^/]+)$/);
    if (assetDeleteMatch && request.method === "DELETE") {
      const projectId = decodeURIComponent(assetDeleteMatch[1]);
      const assetId = decodeURIComponent(assetDeleteMatch[2]);
      const currentProject = await readProjectById(session.accessToken, repo, projectId);
      if (!currentProject) {
        return json({ error: "Project not found" }, { status: 404 });
      }

      const asset = currentProject.assets.find((entry) => entry.id === assetId);
      if (!asset || asset.role !== "gallery") {
        return json({ error: "Asset not found" }, { status: 404 });
      }

      const nextProject = normalizeProjectForWrite({
        ...currentProject,
        assets: currentProject.assets.filter((entry) => entry.id !== assetId),
        blocks: currentProject.blocks.filter((block) => block.type === "text" || block.assetId !== assetId),
        coverAssetId: currentProject.coverAssetId === assetId ? undefined : currentProject.coverAssetId,
        cardAssetId: currentProject.cardAssetId === assetId ? undefined : currentProject.cardAssetId,
      });

      const nextProjects = (await readAllProjects(session.accessToken, repo)).map((entry) =>
        entry.id === projectId ? nextProject : entry
      );

      const aliasWrites = await buildAliasWrites(session.accessToken, repo, nextProject);
      await commitFiles(
        session.accessToken,
        repo,
        `Remove asset from ${nextProject.title}`,
        [
          {
            path: getRepoFilePathFromPublicUrl(asset.src),
            delete: true,
          },
          ...aliasWrites,
          ...buildSingleProjectWriteSet(nextProjects, nextProject),
        ]
      );

      return json({ project: nextProject });
    }

    const assetUploadMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)\/assets$/);
    if (assetUploadMatch && request.method === "POST") {
      const projectId = decodeURIComponent(assetUploadMatch[1]);
      const project = await readProjectById(session.accessToken, repo, projectId);
      if (!project) {
        return json({ error: "Project not found" }, { status: 404 });
      }

      const formData = await request.formData();
      const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
      if (files.length === 0) {
        return json({ error: "No files uploaded" }, { status: 400 });
      }

      const existingNumbers = project.assets
        .filter((asset) => asset.role === "gallery")
        .map((asset) => Number(asset.id.replace("gallery-", "")))
        .filter((value) => Number.isFinite(value));
      let nextIndex = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;

      const newAssets = await Promise.all(
        files.map(async (file) => {
          const assetId = `gallery-${String(nextIndex).padStart(2, "0")}`;
          nextIndex += 1;
          const repoPath = `public/portfolio/projects/${project.slug}/${assetId}.webp`;
          return {
            asset: {
              id: assetId,
              kind: "image" as const,
              role: "gallery" as const,
              src: `/portfolio/projects/${project.slug}/${assetId}.webp`,
            },
            write: {
              path: repoPath,
              content: toBase64(await file.arrayBuffer()),
              encoding: "base64" as const,
            },
          };
        })
      );

      const pendingAssetContents = new Map(
        newAssets.map((entry) => [entry.write.path, entry.write.content])
      );
      const nextProject = normalizeProjectForWrite({
        ...project,
        assets: [...project.assets, ...newAssets.map((entry) => entry.asset)],
      });
      const nextProjects = (await readAllProjects(session.accessToken, repo)).map((entry) =>
        entry.id === projectId ? nextProject : entry
      );
      const aliasWrites = await buildAliasWrites(
        session.accessToken,
        repo,
        nextProject,
        pendingAssetContents
      );

      await commitFiles(
        session.accessToken,
        repo,
        `Upload assets for ${project.title}`,
        [
          ...newAssets.map((entry) => entry.write),
          ...aliasWrites,
          ...buildSingleProjectWriteSet(nextProjects, nextProject),
        ]
      );

      return json({ project: nextProject });
    }

    const projectMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
    if (projectMatch) {
      const projectId = decodeURIComponent(projectMatch[1]);

      if (request.method === "GET") {
        const project = await readProjectById(session.accessToken, repo, projectId);
        if (!project) {
          return json({ error: "Project not found" }, { status: 404 });
        }
        return json({ project });
      }

      if (request.method === "PUT") {
        const body = (await request.json()) as { project?: AdminProjectDocument } | AdminProjectDocument;
        const incoming = "project" in body ? body.project : body;
        if (!incoming || incoming.id !== projectId) {
          return json({ error: "Invalid project payload" }, { status: 400 });
        }

        const normalizedProject = normalizeProjectForWrite(incoming);
        const existingProjects = await readAllProjects(session.accessToken, repo);
        const existingProject = existingProjects.find((entry) => entry.id === projectId);
        const nextProjects = existingProject
          ? existingProjects.map((entry) => (entry.id === projectId ? normalizedProject : entry))
          : [...existingProjects, normalizedProject];

        const aliasWrites = await buildAliasWrites(session.accessToken, repo, normalizedProject);
        await commitFiles(
          session.accessToken,
          repo,
          `${existingProject ? "Update" : "Create"} project ${normalizedProject.title}`,
          [
            ...aliasWrites,
            ...buildSingleProjectWriteSet(nextProjects, normalizedProject),
          ]
        );

        return json({ project: normalizedProject });
      }

      if (request.method === "DELETE") {
        const index = await readAdminIndex(session.accessToken, repo);
        const summary = index.find((entry) => entry.id === projectId);
        if (!summary) {
          return json({ ok: true });
        }

        const project = await readAdminProjectBySlug(session.accessToken, repo, summary.slug);
        const remainingProjects = (await readAllProjects(session.accessToken, repo)).filter(
          (entry) => entry.id !== projectId
        );
        const nextIndex = index.filter((entry) => entry.id !== projectId);
        const projectFiles = new Set<string>([
          getAdminProjectPath(summary.slug),
          `public/content/projects/${summary.slug}.json`,
          `public/portfolio/projects/${summary.slug}/card.webp`,
          `public/portfolio/projects/${summary.slug}/cover.webp`,
        ]);

        if (project) {
          for (const asset of project.assets) {
            projectFiles.add(getRepoFilePathFromPublicUrl(asset.src));
          }
        } else {
          const existingAssets = await listDirectory(
            session.accessToken,
            repo,
            `public/portfolio/projects/${summary.slug}`
          );
          for (const asset of existingAssets) {
            if (asset.type === "file") projectFiles.add(asset.path);
          }
        }

        await commitFiles(
          session.accessToken,
          repo,
          `Delete project ${summary.title}`,
          [
            ...Array.from(projectFiles).map((filePath) => ({
              path: filePath,
              delete: true as const,
            })),
            {
              path: "content/admin/index.json",
              content: `${JSON.stringify({ projects: nextIndex }, null, 2)}\n`,
              encoding: "utf-8" as const,
            },
            {
              path: "public/content/projects/index.json",
              content: `${JSON.stringify({
                projects: nextIndex
                  .filter((project) => project.status === "published")
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
              }, null, 2)}\n`,
              encoding: "utf-8" as const,
            },
            {
              path: "public/content/projects/search-index.json",
              content: `${JSON.stringify(buildSearchIndexFile(remainingProjects), null, 2)}\n`,
              encoding: "utf-8" as const,
            },
          ]
        );

        return json({ ok: true });
      }
    }

    return json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
