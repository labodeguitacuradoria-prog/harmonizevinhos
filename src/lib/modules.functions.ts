import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  restaurant_id: string;
  module: "full" | "dashboard" | "pricing" | "printed_menu" | "pairing";
  enabled: boolean;
  notes?: string | null;
};

/** Liga/desliga um módulo de um restaurante. Somente administrador geral. */
export const setModuleEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!input?.restaurant_id) throw new Error("Restaurante obrigatório.");
    if (!input?.module) throw new Error("Módulo obrigatório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas o administrador geral pode alterar módulos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("module_entitlements").upsert(
      {
        restaurant_id: data.restaurant_id,
        module: data.module,
        enabled: data.enabled,
        source: "admin",
        granted_by: context.userId,
        notes: data.notes ?? null,
      },
      { onConflict: "restaurant_id,module" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
