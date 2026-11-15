import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MEDIA_BUCKET,
  SIGNED_URL_SECONDS,
  fetchImage,
  imageNeedsWork,
  internalStoragePath,
  sha256Hex,
} from "@/lib/image-storage";

const FOLDER = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/i;

/** Baixa a foto de um link colado e salva no armazenamento do app (permissões do próprio usuário). */
export const importImageFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ url: z.string().min(8).max(4000), folder: z.string().min(1).max(200).regex(FOLDER) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    const got = await fetchImage(data.url);
    if (!got.ok) return got;
    const path = `${data.folder}/${crypto.randomUUID()}.${got.image.ext}`;
    const { error } = await context.supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, got.image.bytes, { contentType: got.image.mime, cacheControl: "31536000", upsert: false });
    if (error) {
      console.error("[importImageFromUrl] upload", error);
      return { ok: false, error: "Sem permissão para salvar a foto neste cadastro." };
    }
    const { data: signed } = await context.supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (!signed?.signedUrl) return { ok: false, error: "A foto foi salva, mas o link não pôde ser gerado." };
    return { ok: true, url: signed.signedUrl };
  });

// ---------------------------------------------------------------------------
// Migração em lote (somente Administrador Geral)
// ---------------------------------------------------------------------------

type Table = "wines" | "wine_catalog" | "wineries";
export type ImageWorkItem = { table: Table; id: string; label: string; place: string; imports: number; renews: number };
export type ImageFailure = { table: Table; id: string; label: string; place: string; url: string; reason: string };

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: ok } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!ok) throw new Error("Apenas o administrador geral pode realizar esta ação.");
}

async function readAll(db: any, table: Table, columns: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function urlsOf(table: Table, row: any): string[] {
  if (table === "wineries") return (row.photos ?? []) as string[];
  return [row.image_url, ...((row.gallery_urls ?? []) as string[])].filter(Boolean);
}

function labelOf(table: Table, row: any, restaurants: Map<string, string>) {
  if (table === "wineries") return { label: row.name as string, place: "Vinícolas" };
  const label = [row.name, row.vintage].filter(Boolean).join(" ");
  if (table === "wine_catalog") return { label, place: "Cadastro Global" };
  return { label, place: restaurants.get(row.restaurant_id) ?? "Restaurante" };
}

/** Lista os cadastros que ainda têm fotos fora do sistema (ou links a renovar). */
export const scanExternalImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [wines, catalog, wineries, rests] = await Promise.all([
      readAll(supabaseAdmin, "wines", "id, name, vintage, restaurant_id, image_url, gallery_urls"),
      readAll(supabaseAdmin, "wine_catalog", "id, name, vintage, image_url, gallery_urls"),
      readAll(supabaseAdmin, "wineries", "id, name, photos"),
      supabaseAdmin.from("restaurants").select("id, name"),
    ]);
    const restaurants = new Map<string, string>((rests.data ?? []).map((r: any) => [r.id, r.name]));
    const now = Date.now();
    const items: ImageWorkItem[] = [];
    const push = (table: Table, rows: any[]) => {
      for (const row of rows) {
        let imports = 0;
        let renews = 0;
        for (const u of urlsOf(table, row)) {
          const need = imageNeedsWork(u, now);
          if (need === "import") imports++;
          else if (need === "renew") renews++;
        }
        if (imports || renews) items.push({ table, id: row.id, ...labelOf(table, row, restaurants), imports, renews });
      }
    };
    push("wine_catalog", catalog);
    push("wines", wines);
    push("wineries", wineries);
    return { items };
  });

/** Processa alguns cadastros: baixa as fotos externas, salva no sistema e troca o link no cadastro. */
export const migrateImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        items: z.array(z.object({ table: z.enum(["wines", "wine_catalog", "wineries"]), id: z.string().uuid() })).min(1).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const failures: ImageFailure[] = [];
    let imported = 0;
    let renewed = 0;
    const cache = new Map<string, string>();

    const sign = async (path: string) => {
      const { data: s } = await supabaseAdmin.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
      return s?.signedUrl ?? null;
    };

    await Promise.all(data.items.map(async (item) => {
      const columns =
        item.table === "wineries"
          ? "id, name, photos"
          : item.table === "wines"
            ? "id, name, vintage, restaurant_id, image_url, gallery_urls, restaurant:restaurants(name)"
            : "id, name, vintage, image_url, gallery_urls";
      const { data: row } = await db.from(item.table).select(columns).eq("id", item.id).maybeSingle();
      if (!row) return;
      const { label } = labelOf(item.table, row, new Map());
      const place =
        item.table === "wines" ? row.restaurant?.name ?? "Restaurante" : item.table === "wine_catalog" ? "Cadastro Global" : "Vinícolas";
      const folder =
        item.table === "wines" ? `wines/${row.restaurant_id}/imported` : item.table === "wine_catalog" ? "catalog/imported" : "catalog/wineries/imported";

      const fix = async (url: string | null): Promise<string | null> => {
        if (!url) return url;
        const need = imageNeedsWork(url);
        if (!need) return url;
        if (need === "renew") {
          const path = internalStoragePath(url);
          const next = path ? await sign(path) : null;
          if (next) {
            renewed++;
            return next;
          }
          return url;
        }
        const key = `${folder}|${url}`;
        if (cache.has(key)) {
          imported++;
          return cache.get(key)!;
        }
        const got = await fetchImage(url);
        if (!got.ok) {
          failures.push({ table: item.table, id: item.id, label, place, url: url.startsWith("data:") ? "(imagem colada)" : url, reason: got.error });
          return url;
        }
        const path = `${folder}/${(await sha256Hex(url)).slice(0, 40)}.${got.image.ext}`;
        const { error } = await supabaseAdmin.storage
          .from(MEDIA_BUCKET)
          .upload(path, got.image.bytes, { contentType: got.image.mime, cacheControl: "31536000", upsert: true });
        const next = error ? null : await sign(path);
        if (!next) {
          failures.push({ table: item.table, id: item.id, label, place, url, reason: "Falha ao salvar no armazenamento." });
          return url;
        }
        imported++;
        cache.set(key, next);
        return next;
      };

      let patch: Record<string, unknown>;
      if (item.table === "wineries") {
        const photos: string[] = [];
        for (const p of (row.photos ?? []) as string[]) photos.push((await fix(p)) ?? p);
        patch = { photos };
      } else {
        const image_url = await fix(row.image_url);
        const gallery: string[] = [];
        for (const g of (row.gallery_urls ?? []) as string[]) gallery.push((await fix(g)) ?? g);
        patch = { image_url, gallery_urls: row.gallery_urls ? gallery : row.gallery_urls };
      }
      const { error } = await db.from(item.table).update(patch).eq("id", item.id);
      if (error) failures.push({ table: item.table, id: item.id, label, place, url: "", reason: `Não foi possível atualizar o cadastro: ${error.message}` });
    }));
    return { imported, renewed, failures };
  });
