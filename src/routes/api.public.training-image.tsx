import { createFileRoute } from "@tanstack/react-router";

function storagePathFromUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    const marker = "/product-media/";
    const index = parsed.pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(parsed.pathname.substring(index + marker.length)) : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/training-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim() ?? "";
        const wineId = url.searchParams.get("wine")?.trim() ?? "";
        if (token.length < 10 || !wineId) return new Response("invalid", { status: 400 });

        const { hashToken } = await import("@/lib/access-links.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: link } = await supabaseAdmin
          .from("access_links")
          .select("restaurant_id, scope, expires_at, revoked_at")
          .eq("token_hash", hashToken(token))
          .maybeSingle();

        const expired = link?.expires_at && new Date(link.expires_at).getTime() < Date.now();
        if (!link || link.scope !== "training" || link.revoked_at || expired) {
          return new Response("not found", { status: 404 });
        }

        const { data: card } = await supabaseAdmin
          .from("wine_story_cards")
          .select("wine_id")
          .eq("restaurant_id", link.restaurant_id)
          .eq("wine_id", wineId)
          .eq("status", "published")
          .maybeSingle();
        if (!card) return new Response("not found", { status: 404 });

        const { data: wine } = await supabaseAdmin
          .from("wines")
          .select("image_url")
          .eq("id", wineId)
          .eq("restaurant_id", link.restaurant_id)
          .maybeSingle();
        if (!wine?.image_url) return new Response("not found", { status: 404 });

        const storagePath = storagePathFromUrl(wine.image_url);
        let body: Blob;
        let contentType = "image/jpeg";
        if (storagePath && !storagePath.includes("..")) {
          const { data, error } = await supabaseAdmin.storage.from("product-media").download(storagePath);
          if (error || !data) return new Response("not found", { status: 404 });
          body = data;
          contentType = data.type || contentType;
        } else {
          let imageUrl: URL;
          try {
            imageUrl = new URL(wine.image_url);
          } catch {
            return new Response("invalid image", { status: 400 });
          }
          if (imageUrl.protocol !== "https:") return new Response("invalid image", { status: 400 });
          const response = await fetch(imageUrl, {
            headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
            redirect: "follow",
          });
          if (!response.ok) return new Response("not found", { status: 404 });
          const fetchedType = response.headers.get("content-type") ?? "";
          if (!fetchedType.startsWith("image/")) return new Response("invalid image", { status: 415 });
          body = await response.blob();
          contentType = fetchedType;
        }

        return new Response(body, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": "inline",
          },
        });
      },
    },
  },
});