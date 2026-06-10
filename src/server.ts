import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // If an ASSETS binding is available (Cloudflare Pages/Worker asset binding),
      // prefer serving static assets directly from it for `/assets/*` requests
      // and common static file extensions. This avoids failing dynamic imports
      // for client-side route chunks when the Worker routing doesn't proxy
      // static asset requests to the assets host.
      const url = new URL(request.url);
      const pathname = url.pathname;
      const isAssetPath = pathname.startsWith("/assets/") || /\.(js|css|png|jpg|jpeg|svg|webp|map|json|ico)$/.test(pathname);

      // `env` comes from Wrangler; the assets binding is commonly named `ASSETS`.
      // Try to call `env.ASSETS.fetch` if present.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyEnv = env as any;
        if (isAssetPath && anyEnv?.ASSETS && typeof anyEnv.ASSETS.fetch === "function") {
          const assetRes = await anyEnv.ASSETS.fetch(request);
          // If the asset exists, return it immediately.
          if (assetRes && assetRes.status !== 404) return assetRes;
        }
      } catch (e) {
        // ignore and fall through to SSR handler
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
