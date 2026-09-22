import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RestaurantSchema = z.object({ restaurant_id: z.string().uuid() });
const RestoreSchema = RestaurantSchema.extend({ owner_id: z.string().uuid() });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: ok } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!ok) throw new Error("Apenas o administrador geral pode realizar esta ação.");
}

export const trashRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestaurantSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .eq("id", data.restaurant_id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("access_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("restaurant_id", data.restaurant_id)
      .is("revoked_at", null);
    return { ok: true };
  });

export const restoreRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestoreSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .update({ owner_id: data.owner_id, deleted_at: null, deleted_by: null })
      .eq("id", data.restaurant_id)
      .not("deleted_at", "is", null)
      .select("id")
      .maybeSingle();
    if (restaurantError) throw new Error(restaurantError.message);
    if (!restaurant) throw new Error("Restaurante não encontrado na lixeira.");

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("restaurant_id", data.restaurant_id)
      .eq("role", "rest_admin");
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.owner_id,
      role: "rest_admin",
      restaurant_id: data.restaurant_id,
    });
    if (roleError && !roleError.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleError.message);
    }
    return { ok: true };
  });

function storagePath(value: string | null | undefined, bucket: string) {
  if (!value) return null;
  const marker = `/${bucket}/`;
  const clean = value.split("?")[0] ?? value;
  const index = clean.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(clean.slice(index + marker.length));
}

export const permanentlyDeleteRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestaurantSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id, deleted_at")
      .eq("id", data.restaurant_id)
      .maybeSingle();
    if (!restaurant) return { ok: true };
    if (!restaurant.deleted_at) throw new Error("Mova o restaurante para a lixeira antes da exclusão definitiva.");

    const [{ data: wines }, { data: glasses }, { data: menus }, { data: orders }] = await Promise.all([
      supabaseAdmin.from("wines").select("image_url, gallery_urls, tech_sheet_url, videos").eq("restaurant_id", data.restaurant_id),
      supabaseAdmin.from("glasses").select("image_url").eq("restaurant_id", data.restaurant_id),
      supabaseAdmin.from("printed_wine_lists").select("logo_url").eq("restaurant_id", data.restaurant_id),
      supabaseAdmin.from("purchase_orders").select("id").eq("restaurant_id", data.restaurant_id),
    ]);

    const productPaths = new Set<string>();
    const addProduct = (value: string | null | undefined) => {
      const path = storagePath(value, "product-media");
      if (path && !path.startsWith("catalog/")) productPaths.add(path);
    };
    for (const wine of wines ?? []) {
      addProduct(wine.image_url);
      for (const value of wine.gallery_urls ?? []) addProduct(value);
      addProduct(wine.tech_sheet_url);
      for (const video of Array.isArray(wine.videos) ? wine.videos : []) {
        if (video && typeof video === "object" && "url" in video) addProduct(String(video.url));
      }
    }
    for (const glass of glasses ?? []) addProduct(glass.image_url);
    for (const menu of menus ?? []) addProduct(menu.logo_url);
    const { data: trainingObjects } = await supabaseAdmin.storage
      .from("product-media")
      .list(`training-videos/${data.restaurant_id}`, { limit: 1000 });
    for (const object of trainingObjects ?? []) {
      productPaths.add(`training-videos/${data.restaurant_id}/${object.name}`);
    }

    const orderIds = (orders ?? []).map((order) => order.id);
    let orderPaths: string[] = [];
    if (orderIds.length) {
      const { data: docs } = await supabaseAdmin
        .from("purchase_order_documents")
        .select("storage_path")
        .in("order_id", orderIds);
      orderPaths = (docs ?? []).map((doc) => doc.storage_path);
    }
    if (productPaths.size) {
      await supabaseAdmin.storage.from("product-media").remove(Array.from(productPaths));
    }
    if (orderPaths.length) {
      await supabaseAdmin.storage.from("order-documents").remove(orderPaths);
    }

    const { error } = await supabaseAdmin.from("restaurants").delete().eq("id", data.restaurant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });