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
 * Aplica o pacote escolhido na tela inicial ao restaurante recém-criado no cadastro.
 * Só ajusta restaurantes do próprio usuário que ainda estão vazios (sem rótulos),
 * evitando alterar pacotes de clientes já em operação.
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rests } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", context.userId);
    if (!rests?.length) return { ok: true, applied: false };

    let applied = false;
    for (const r of rests) {
      const { count } = await supabaseAdmin
        .from("wines")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", r.id);
      if ((count ?? 0) > 0) continue;

      await supabaseAdmin.from("module_entitlements").delete().eq("restaurant_id", r.id);
      const { error } = await supabaseAdmin.from("module_entitlements").insert({
        restaurant_id: r.id,
        module: data.module,
        enabled: true,
        source: "trial",
        notes: "Pacote escolhido no cadastro",
      });
      if (error) throw new Error(error.message);
      applied = true;
    }
    return { ok: true, applied };
  });
