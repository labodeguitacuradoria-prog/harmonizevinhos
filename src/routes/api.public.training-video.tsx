import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/training-video")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim() ?? "";
        const path = url.searchParams.get("path")?.trim() ?? "";
        if (token.length < 10 || !path || path.includes("..")) {
          return new Response("invalid", { status: 400 });
        }

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
          .select("id")
          .eq("restaurant_id", link.restaurant_id)
          .eq("status", "published")
          .eq("video_published", true)
          .contains("video_paths", [path])
          .maybeSingle();
        if (!card) return new Response("not found", { status: 404 });

        const { data, error } = await supabaseAdmin.storage.from("product-media").download(path);
        if (error || !data) return new Response("not found", { status: 404 });

        return new Response(data, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": "inline",
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});