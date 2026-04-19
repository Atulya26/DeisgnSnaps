const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const ADMIN_API_TIMEOUT_MS = 30000;

function buildUrl(path: string): string {
  if (!API_BASE) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ADMIN_API_TIMEOUT_MS);
  const externalSignal = init.signal;

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: {
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) errorMessage = body.error;
      } catch {
        // Best-effort only.
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(ADMIN_API_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
