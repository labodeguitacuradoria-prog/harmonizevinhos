import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCanManage(context: any, restaurantId: string) {
  const { data: ok } = await context.supabase.rpc("can_manage_restaurant", {
    _user_id: context.userId,
    _restaurant_id: restaurantId,
  });
  if (!ok) throw new Error("Sem permissão para gerenciar este restaurante.");
}

const CreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  scope: z.enum(["dashboard", "stock_count"]),
  device_kind: z.enum(["mobile", "desktop"]),
  single_device: z.boolean(),
  days: z.number().int().min(0).max(3650),
});

export const createAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context, data.restaurant_id);
    const helpers = await import("@/lib/access-links.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const token = helpers.generateToken();
    const expires_at =
      data.days > 0 ? new Date(Date.now() + data.days * 86400000).toISOString() : null;

    const { data: row, error } = await supabaseAdmin
      .from("access_links")
      .insert({
        restaurant_id: data.restaurant_id,
        label: data.label,
        scope: data.scope,
        device_kind: data.device_kind,
        single_device: data.single_device,
        token_hash: helpers.hashToken(token),
        expires_at,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id, token };
  });

export const revokeAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("access_links")
      .select("restaurant_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!link) return { ok: true };
    await assertCanManage(context, link.restaurant_id);
    const { error } = await supabaseAdmin
      .from("access_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("access_links")
      .select("restaurant_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!link) return { ok: true };
    await assertCanManage(context, link.restaurant_id);
    const { error } = await supabaseAdmin.from("access_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unbindAccessLinkDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("access_links")
      .select("restaurant_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!link) return { ok: true };
    await assertCanManage(context, link.restaurant_id);
    const { error } = await supabaseAdmin.from("access_link_devices").delete().eq("link_id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
