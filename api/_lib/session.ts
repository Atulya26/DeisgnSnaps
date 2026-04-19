const SESSION_COOKIE = "portfolio_admin_session";
const STATE_COOKIE = "portfolio_admin_oauth_state";

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacSha256(input: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, rest.join("="));
  }

  return cookies;
}

export async function signToken(payload: Record<string, unknown>, secret: string) {
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyToken<T>(token: string, secret: string): Promise<T | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = await hmacSha256(encodedPayload, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as T;
  } catch {
    return null;
  }
}

function buildCookie(name: string, value: string, secure: boolean, maxAge: number) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function clearCookie(name: string, secure: boolean) {
  const parts = [
    `${name}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildSessionCookie(value: string, secure: boolean, maxAgeSeconds: number) {
  return buildCookie(SESSION_COOKIE, value, secure, maxAgeSeconds);
}

export function buildStateCookie(value: string, secure: boolean, maxAgeSeconds: number) {
  return buildCookie(STATE_COOKIE, value, secure, maxAgeSeconds);
}

export function clearSessionCookie(secure: boolean) {
  return clearCookie(SESSION_COOKIE, secure);
}

export function clearStateCookie(secure: boolean) {
  return clearCookie(STATE_COOKIE, secure);
}

export function readCookie(request: Request, cookieName: string) {
  return parseCookies(request.headers.get("cookie")).get(cookieName) ?? null;
}

export function readSessionCookie(request: Request) {
  return readCookie(request, SESSION_COOKIE);
}

export function readStateCookie(request: Request) {
  return readCookie(request, STATE_COOKIE);
}
