import { createFileRoute } from "@tanstack/react-router";

// Entrega o PDF publicado do Livro de Estudos para quem tem um link de treinamento válido.
export const Route = createFileRoute("/api/public/training-book")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim() ?? "";
        if (token.length < 10 || token.length > 200) return new Response("invalid", { status: 400 });
        const { hashToken } = await import("@/lib/access-links.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: link } = await supabaseAdmin
          .from("access_links")
          .select("restaurant_id, scope, expires_at, revoked_at")
          .eq("token_hash", hashToken(token))
          .maybeSingle();
        const expired = link?.expires_at && new Date(link.expires_at).getTime() < Date.now();
        if (!link || link.scope !== "training" || link.revoked_at || expired) return new Response("not found", { status: 404 });
        const { data: book } = await supabaseAdmin
          .from("training_books")
          .select("pdf_path, title")
          .eq("restaurant_id", link.restaurant_id)
          .maybeSingle();
        const path = book?.pdf_path;
        if (!path || !path.startsWith(`training-books/${link.restaurant_id}/`)) return new Response("not published", { status: 404 });
        const { data, error } = await supabaseAdmin.storage.from("product-media").download(path);
        if (error || !data) return new Response("not found", { status: 404 });
        const download = url.searchParams.get("download") === "1";
        const safe = (book?.title || "livro-de-estudos").replace(/[^\w\- ]+/g, "").trim() || "livro";
        return new Response(data, {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `${download ? "attachment" : "inline"}; filename="${safe}.pdf"`,
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
