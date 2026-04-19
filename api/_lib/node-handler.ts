import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

function buildRequestFromNode(req: IncomingMessage) {
  const origin = `https://${req.headers.host ?? "localhost"}`;
  const url = new URL(req.url ?? "/", origin);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
      continue;
    }
    if (value) headers.append(key, value);
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
  };

  if (req.method && !["GET", "HEAD"].includes(req.method)) {
    init.body = Readable.toWeb(req) as BodyInit;
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function sendNodeResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;

  const setCookies =
    typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : [];

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });

  if (setCookies.length > 0) {
    res.setHeader("Set-Cookie", setCookies);
  } else {
    const cookie = response.headers.get("set-cookie");
    if (cookie) res.setHeader("Set-Cookie", cookie);
  }

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

export const config = {
  runtime: "nodejs",
};

export function createNodeApiHandler() {
  return async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
      const request = buildRequestFromNode(req);
      const { default: adminApiHandler } = await import("../router.ts");
      const response = await adminApiHandler(request);
      await sendNodeResponse(res, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server bootstrap error";
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: message }));
    }
  };
}
