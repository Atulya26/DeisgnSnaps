import adminApiHandler from "./[...route].ts";

function buildForwardedRequest(request: Request) {
  const currentUrl = new URL(request.url);
  const forwardedPath = currentUrl.searchParams.get("__pathname");

  if (!forwardedPath) {
    return request;
  }

  const nextUrl = new URL(request.url);
  nextUrl.pathname = forwardedPath;
  nextUrl.searchParams.delete("__pathname");

  return new Request(nextUrl, request);
}

export default {
  async fetch(request: Request) {
    return adminApiHandler(buildForwardedRequest(request));
  },
};
