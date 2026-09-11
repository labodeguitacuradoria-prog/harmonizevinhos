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

const VALID = ["full", "dashboard", "pricing", "printed_menu", "pairing"] as const;
type ModuleKey = (typeof VALID)[number];

/**
 * Aplica o pacote escolhido na tela inicial.
 * - Restaurante ainda vazio (sem rótulos): passa a ter somente o pacote escolhido.
 * - Restaurante já em operação: o pacote escolhido é SOMADO aos que já existiam,
 *   preservando o que o cliente já usava (ex.: carta impressa + precificação).
 */
export const claimSignupModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { module: string }) => {
    if (!VALID.includes(input?.module as ModuleKey)) throw new Error("Pacote inválido.");
    return { module: input.module as ModuleKey };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin) return { ok: true, applied: false };

    const { data: mine, error: mineError } = await context.supabase.rpc("my_restaurants", {
      _user_id: context.userId,
    });
    if (mineError) throw new Error(mineError.message);
    const ids = Array.from(
      new Set(((mine ?? []) as { restaurant_id: string }[]).map((r) => r.restaurant_id)),
    );
    if (!ids.length) return { ok: true, applied: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let applied = false;
    for (const id of ids) {
      const { count } = await supabaseAdmin
        .from("wines")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", id);
      const inUse = (count ?? 0) > 0;

      if (!inUse) {
        const { error: deleteError } = await supabaseAdmin
          .from("module_entitlements")
          .delete()
          .eq("restaurant_id", id);
        if (deleteError) throw new Error(deleteError.message);
      }

      const { error } = await supabaseAdmin.from("module_entitlements").upsert(
        {
          restaurant_id: id,
          module: data.module,
          enabled: true,
          source: "trial",
          notes: "Pacote escolhido no cadastro",
        },
        { onConflict: "restaurant_id,module" },
      );
      if (error) throw new Error(error.message);
      applied = true;
    }
    return { ok: true, applied };
  });

