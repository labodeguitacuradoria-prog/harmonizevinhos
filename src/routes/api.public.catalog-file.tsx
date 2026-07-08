import { createFileRoute } from "@tanstack/react-router";

// Proxies files from the private `product-media` bucket through this app's own origin,
// so browsers that block the raw supabase.co host (Safe Browsing / extensions) still
// receive the file inline.
export const Route = createFileRoute("/api/public/catalog-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const raw = url.searchParams.get("u") ?? url.searchParams.get("path") ?? "";
        if (!raw) return new Response("missing", { status: 400 });

        // Accept either a full signed URL from the bucket or a bare storage path.
        let objectPath = raw;
        try {
          const parsed = new URL(raw);
          const marker = "/product-media/";
          const idx = parsed.pathname.indexOf(marker);
          if (idx >= 0) objectPath = decodeURIComponent(parsed.pathname.substring(idx + marker.length));
        } catch { /* not a URL, treat as path */ }

        if (!objectPath || objectPath.includes("..")) {
          return new Response("bad path", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("product-media").download(objectPath);
        if (error || !data) return new Response("not found", { status: 404 });

        const ext = objectPath.split(".").pop()?.toLowerCase() ?? "";
        const contentType =
          ext === "pdf" ? "application/pdf" :
          ext === "png" ? "image/png" :
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
          ext === "webp" ? "image/webp" :
          data.type || "application/octet-stream";

        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": "inline",
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
