/**
 * Portfolio R2 API Worker
 *
 * Endpoints:
 *   GET    /folders          — list all top-level folders in the bucket
 *   GET    /folders/:name    — list all images inside a specific folder
 *   GET    /file/:key+       — proxy-serve a file from R2
 *   PUT    /upload/:key+     — upload a file to R2
 *   DELETE /file/:key+       — delete a file from R2
 *
 * The worker is bound to the "portfolio-assets" R2 bucket via wrangler.jsonc.
 */

interface Env {
  BUCKET: R2Bucket;
}

// Image extensions we care about
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

function isImageKey(key: string): boolean {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Filename",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const path = url.pathname;

    try {
      // ═══════════════════════════════════════════
      // GET endpoints
      // ═══════════════════════════════════════════

      if (request.method === "GET") {
        // ── GET /folders — list all top-level folders ──
        if (path === "/folders") {
          const folders = await listFolders(env.BUCKET);
          return jsonResponse({ folders }, origin);
        }

        // ── GET /folders/:name — list images inside a folder ──
        const folderMatch = path.match(/^\/folders\/(.+)$/);
        if (folderMatch) {
          const folderName = decodeURIComponent(folderMatch[1]);
          const prefix = folderName.endsWith("/") ? folderName : folderName + "/";
          const images = await listFolderImages(env.BUCKET, prefix, url.origin);
          return jsonResponse({ folder: folderName, images }, origin);
        }

        // ── GET /file/:key — proxy-serve a file from R2 ──
        const fileMatch = path.match(/^\/file\/(.+)$/);
        if (fileMatch) {
          const key = decodeURIComponent(fileMatch[1]);
          const object = await env.BUCKET.get(key);
          if (!object) {
            return jsonResponse({ error: "File not found" }, origin, 404);
          }

          const headers = new Headers(corsHeaders(origin));
          object.writeHttpMetadata(headers);
          headers.set("etag", object.httpEtag);
          headers.set("Cache-Control", "public, max-age=31536000, immutable");

          return new Response(object.body, { headers });
        }
      }

      // ═══════════════════════════════════════════
      // PUT /upload/:key — upload a file to R2
      // ═══════════════════════════════════════════

      if (request.method === "PUT") {
        const uploadMatch = path.match(/^\/upload\/(.+)$/);
        if (uploadMatch) {
          const key = decodeURIComponent(uploadMatch[1]);

          if (!request.body) {
            return jsonResponse({ error: "No body provided" }, origin, 400);
          }

          // Get content type from request or infer from extension
          const contentType =
            request.headers.get("Content-Type") ||
            inferContentType(key);

          await env.BUCKET.put(key, request.body, {
            httpMetadata: {
              contentType,
            },
          });

          return jsonResponse(
            {
              ok: true,
              key,
              url: `${url.origin}/file/${encodeURIComponent(key)}`,
            },
            origin,
            201
          );
        }
      }

      // ═══════════════════════════════════════════
      // DELETE /file/:key — delete a file from R2
      // ═══════════════════════════════════════════

      if (request.method === "DELETE") {
        const deleteMatch = path.match(/^\/file\/(.+)$/);
        if (deleteMatch) {
          const key = decodeURIComponent(deleteMatch[1]);
          await env.BUCKET.delete(key);
          return jsonResponse({ ok: true, key }, origin);
        }
      }

      // ── Fallback ──
      return jsonResponse(
        {
          api: "Portfolio R2 API",
          endpoints: [
            "GET  /folders",
            "GET  /folders/:name",
            "GET  /file/:key",
            "PUT  /upload/:key",
            "DELETE /file/:key",
          ],
        },
        origin
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      return jsonResponse({ error: message }, origin, 500);
    }
  },
} satisfies ExportedHandler<Env>;

// ── Helpers ──

function inferContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
  };
  return types[ext] || "application/octet-stream";
}

async function listFolders(bucket: R2Bucket): Promise<
  {
    name: string;
    path: string;
    imageCount: number;
  }[]
> {
  const listed = await bucket.list({ delimiter: "/" });
  const folderPrefixes = listed.delimitedPrefixes ?? [];

  const folders = await Promise.all(
    folderPrefixes.map(async (prefix) => {
      const contents = await bucket.list({ prefix, limit: 100 });
      const imageCount = contents.objects.filter((obj) =>
        isImageKey(obj.key)
      ).length;

      return {
        name: prefix.replace(/\/$/, ""),
        path: prefix,
        imageCount,
      };
    })
  );

  return folders;
}

async function listFolderImages(
  bucket: R2Bucket,
  prefix: string,
  workerOrigin: string
): Promise<
  {
    key: string;
    name: string;
    url: string;
    size: number;
    lastModified: string;
  }[]
> {
  const listed = await bucket.list({ prefix, limit: 500 });

  return listed.objects
    .filter((obj) => isImageKey(obj.key))
    .map((obj) => ({
      key: obj.key,
      name: obj.key.split("/").pop() ?? obj.key,
      url: `${workerOrigin}/file/${encodeURIComponent(obj.key)}`,
      size: obj.size,
      lastModified: obj.uploaded.toISOString(),
    }));
}
