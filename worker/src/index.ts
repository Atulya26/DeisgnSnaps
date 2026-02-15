interface Env {
  CONTENT_BUCKET: R2Bucket;
  SESSION_SECRET: string;
  ADMIN_PASSWORD: string;
  ADMIN_EMAIL?: string;
  PUBLIC_ASSET_BASE_URL?: string;
}

type ProjectStatus = "draft" | "published";

interface StorageImage {
  key: string;
  name: string;
  url: string;
  size: number;
  lastModified: string;
}

interface ImageBlock {
  type: "image";
  id: string;
  url: string;
  key?: string;
  caption?: string;
}

interface TextBlock {
  type: "text";
  id: string;
  content: string;
}

type ContentBlock = ImageBlock | TextBlock;

interface AdminProject {
  id: string;
  storagePath: string;
  title: string;
  category: string;
  year: string;
  description: string;
  tags: string[];
  richContent: string;
  coverImageKey: string;
  images: StorageImage[];
  contentBlocks: ContentBlock[];
  x: number;
  y: number;
  width: number;
  height: number;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

interface SessionPayload {
  email: string;
  exp: number;
}

const PROJECTS_OBJECT_KEY = "content/projects.json";
const SESSION_COOKIE = "admin_session";
const MAX_SESSION_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "svg",
  "bmp",
  "ico",
]);

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function getPathname(request: Request): string {
  return new URL(request.url).pathname;
}

function normaliseProject(project: AdminProject): AdminProject {
  const now = new Date().toISOString();
  return {
    ...project,
    title: project.title ?? "",
    category: project.category ?? "",
    year: project.year ?? "",
    description: project.description ?? "",
    tags: Array.isArray(project.tags) ? project.tags : [],
    richContent: project.richContent ?? "",
    coverImageKey: project.coverImageKey ?? "",
    images: Array.isArray(project.images) ? project.images : [],
    contentBlocks: Array.isArray(project.contentBlocks) ? project.contentBlocks : [],
    status: project.status === "published" ? "published" : "draft",
    createdAt: project.createdAt ?? now,
    updatedAt: now,
  };
}

async function readProjects(env: Env): Promise<AdminProject[]> {
  const object = await env.CONTENT_BUCKET.get(PROJECTS_OBJECT_KEY);
  if (!object) return [];
  const parsed = (await object.json()) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is AdminProject => !!item && typeof item === "object");
}

async function writeProjects(env: Env, projects: AdminProject[]): Promise<void> {
  await env.CONTENT_BUCKET.put(PROJECTS_OBJECT_KEY, JSON.stringify(projects), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "no-store",
    },
  });
}

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, rest.join("="));
  }
  return cookies;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSha256(input: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function createSessionToken(email: string, env: Env): Promise<string> {
  const payload: SessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + MAX_SESSION_AGE_SECONDS,
  };
  const payloadEncoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256(payloadEncoded, env.SESSION_SECRET);
  return `${payloadEncoded}.${signature}`;
}

async function verifySessionToken(token: string, env: Env): Promise<SessionPayload | null> {
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;
  const expected = await hmacSha256(payloadEncoded, env.SESSION_SECRET);
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    const payloadRaw = new TextDecoder().decode(base64UrlDecode(payloadEncoded));
    const payload = JSON.parse(payloadRaw) as SessionPayload;
    if (!payload.email || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function buildSessionCookie(value: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${MAX_SESSION_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function clearSessionCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

async function requireAuth(request: Request, env: Env): Promise<SessionPayload | null> {
  const cookieMap = parseCookies(request.headers.get("cookie"));
  const token = cookieMap.get(SESSION_COOKIE);
  if (!token) return null;
  return verifySessionToken(token, env);
}

function imageNameFromKey(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] || key;
}

function buildAssetUrl(key: string, env: Env, requestOrigin: string): string {
  const base = env.PUBLIC_ASSET_BASE_URL?.replace(/\/$/, "") || `${requestOrigin}/assets`;
  return `${base}/${key}`;
}

async function listImagesByPrefix(
  env: Env,
  prefix: string,
  requestOrigin: string
): Promise<StorageImage[]> {
  const images: StorageImage[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const listed = await env.CONTENT_BUCKET.list({ prefix, cursor, limit: 1000 });
    for (const object of listed.objects) {
      const ext = object.key.split(".").pop()?.toLowerCase() ?? "";
      if (!IMAGE_EXTENSIONS.has(ext)) continue;
      images.push({
        key: object.key,
        name: imageNameFromKey(object.key),
        url: buildAssetUrl(object.key, env, requestOrigin),
        size: object.size,
        lastModified: object.uploaded.toISOString(),
      });
    }
    if (!listed.truncated || !listed.cursor) break;
    cursor = listed.cursor;
  }

  return images.sort((a, b) => +new Date(b.lastModified) - +new Date(a.lastModified));
}

async function deleteByPrefix(env: Env, prefix: string): Promise<void> {
  let cursor: string | undefined = undefined;
  while (true) {
    const listed = await env.CONTENT_BUCKET.list({ prefix, cursor, limit: 1000 });
    await Promise.all(listed.objects.map((obj) => env.CONTENT_BUCKET.delete(obj.key)));
    if (!listed.truncated || !listed.cursor) break;
    cursor = listed.cursor;
  }
}

function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

function unauthorized(): Response {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function notFound(): Response {
  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = getPathname(request);
    const secureCookie = url.protocol === "https:";

    try {
      // Serve media files from the same worker if no separate media domain exists.
      if (request.method === "GET" && pathname.startsWith("/assets/")) {
        const key = decodeURIComponent(pathname.replace(/^\/assets\//, ""));
        if (!key) return notFound();
        const object = await env.CONTENT_BUCKET.get(key);
        if (!object) return notFound();
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("cache-control", "public, max-age=31536000, immutable");
        return new Response(object.body, { headers });
      }

      // Public: published projects for homepage.
      if (request.method === "GET" && pathname === "/api/public/projects") {
        const projects = await readProjects(env);
        const published = projects.filter(
          (project) =>
            project.status === "published" &&
            project.title.trim().length > 0 &&
            project.coverImageKey.trim().length > 0
        );
        return json(
          { projects: published },
          {
            headers: {
              "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
            },
          }
        );
      }

      // Auth endpoints.
      if (request.method === "POST" && pathname === "/api/admin/login") {
        const body = (await request.json()) as { email?: string; password?: string };
        const email = (body.email ?? "").trim().toLowerCase();
        const password = body.password ?? "";
        if (!password) return badRequest("Password is required");
        if (password !== env.ADMIN_PASSWORD) return unauthorized();
        if (env.ADMIN_EMAIL && email !== env.ADMIN_EMAIL.trim().toLowerCase()) {
          return unauthorized();
        }

        const sessionEmail = env.ADMIN_EMAIL?.trim().toLowerCase() || email || "admin";
        const token = await createSessionToken(sessionEmail, env);
        const response = json({ ok: true, user: { email: sessionEmail } });
        response.headers.set("set-cookie", buildSessionCookie(token, secureCookie));
        return response;
      }

      if (request.method === "POST" && pathname === "/api/admin/logout") {
        const response = json({ ok: true });
        response.headers.set("set-cookie", clearSessionCookie(secureCookie));
        return response;
      }

      if (request.method === "GET" && pathname === "/api/admin/session") {
        const session = await requireAuth(request, env);
        if (!session) return json({ authenticated: false });
        return json({ authenticated: true, user: { email: session.email } });
      }

      if (!pathname.startsWith("/api/admin/")) {
        return notFound();
      }

      const session = await requireAuth(request, env);
      if (!session) return unauthorized();

      if (request.method === "GET" && pathname === "/api/admin/health") {
        const projects = await readProjects(env);
        return json({ ok: true, projectCount: projects.length });
      }

      if (request.method === "GET" && pathname === "/api/admin/projects") {
        const projects = await readProjects(env);
        return json({ projects });
      }

      if (request.method === "POST" && pathname === "/api/admin/upload") {
        const form = await request.formData();
        const key = String(form.get("key") ?? "").trim();
        const file = form.get("file");

        if (!key) return badRequest("Missing key");
        if (!key.startsWith("projects/")) return badRequest("Invalid key path");
        if (!(file instanceof File)) return badRequest("Missing file");

        await env.CONTENT_BUCKET.put(key, await file.arrayBuffer(), {
          httpMetadata: {
            contentType: file.type || "application/octet-stream",
          },
        });

        return json({
          key,
          url: buildAssetUrl(key, env, url.origin),
        });
      }

      if (pathname === "/api/admin/assets") {
        const prefix = url.searchParams.get("prefix")?.trim() ?? "";
        if (!prefix) return badRequest("Missing prefix");
        if (!prefix.startsWith("projects/")) return badRequest("Invalid prefix");

        if (request.method === "GET") {
          const images = await listImagesByPrefix(env, prefix, url.origin);
          return json({ images });
        }

        if (request.method === "DELETE") {
          await deleteByPrefix(env, prefix);
          return json({ ok: true });
        }
      }

      const projectMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
      if (projectMatch) {
        const projectId = decodeURIComponent(projectMatch[1]);
        const projects = await readProjects(env);
        const index = projects.findIndex((project) => project.id === projectId);

        if (request.method === "GET") {
          if (index === -1) return notFound();
          return json({ project: projects[index] });
        }

        if (request.method === "PUT") {
          const body = (await request.json()) as { project?: AdminProject } | AdminProject;
          const incoming = "project" in body ? body.project : body;
          if (!incoming || typeof incoming !== "object") return badRequest("Missing project payload");
          if (incoming.id !== projectId) return badRequest("Project ID mismatch");

          const nextProject = normaliseProject(incoming);
          const nextProjects = [...projects];
          if (index === -1) nextProjects.push(nextProject);
          else nextProjects[index] = nextProject;
          await writeProjects(env, nextProjects);
          return json({ project: nextProject });
        }

        if (request.method === "DELETE") {
          if (index === -1) return json({ ok: true });
          const nextProjects = projects.filter((project) => project.id !== projectId);
          await writeProjects(env, nextProjects);
          return json({ ok: true });
        }
      }

      return notFound();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error";
      return json({ error: message }, { status: 500 });
    }
  },
};
