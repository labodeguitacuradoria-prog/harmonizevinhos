import { createFileRoute } from "@tanstack/react-router";

// Server-side proxy for cross-origin image URLs so the client can
// normalize them on a canvas without CORS taint.
export const Route = createFileRoute("/api/image-proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = url.searchParams.get("url");
        if (!target) return new Response("Missing url", { status: 400 });
        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }
        if (!/^https?:$/.test(parsed.protocol)) {
          return new Response("Unsupported protocol", { status: 400 });
        }
        try {
          const upstream = await fetch(parsed.toString(), {
            headers: { "User-Agent": "Mozilla/5.0 LovableImageProxy" },
          });
          if (!upstream.ok || !upstream.body) {
            return new Response("Upstream error", { status: upstream.status || 502 });
          }
          const ct = upstream.headers.get("content-type") ?? "application/octet-stream";
          if (!ct.startsWith("image/")) {
            return new Response("Not an image", { status: 415 });
          }
          return new Response(upstream.body, {
            headers: {
              "Content-Type": ct,
              "Cache-Control": "public, max-age=3600",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("Fetch failed", { status: 502 });
        }
      },
    },
  },
});
