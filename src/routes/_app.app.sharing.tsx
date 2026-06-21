import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Share2 } from "lucide-react";

export const Route = createFileRoute("/_app/app/sharing")({
  component: SharingPage,
});

function SharingPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();

  // suppliers that show up in our wines
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["my-suppliers", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: wines } = await supabase
        .from("wines")
        .select("supplier_id")
        .eq("restaurant_id", restaurantId!)
        .not("supplier_id", "is", null);
      const ids = Array.from(new Set((wines ?? []).map((w) => w.supplier_id).filter(Boolean))) as string[];
      if (ids.length === 0) return [];
      const { data: sups } = await supabase
        .from("suppliers")
        .select("id, name, contact_email")
        .in("id", ids);
      return sups ?? [];
    },
  });

  const { data: access = [] } = useQuery({
    queryKey: ["rsa", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurant_supplier_access")
        .select("supplier_id, enabled")
        .eq("restaurant_id", restaurantId!);
      return data ?? [];
    },
  });

  const enabledMap: Record<string, boolean> = {};
  access.forEach((a) => { enabledMap[a.supplier_id] = a.enabled; });

  async function toggle(supplier_id: string, enabled: boolean) {
    const { error } = await supabase
      .from("restaurant_supplier_access")
      .upsert(
        { restaurant_id: restaurantId, supplier_id, enabled },
        { onConflict: "restaurant_id,supplier_id" }
      );
    if (error) return toast.error(error.message);
    toast.success(enabled ? "Compartilhamento ativado" : "Compartilhamento desativado");
    qc.invalidateQueries({ queryKey: ["rsa"] });
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center gap-2">
        <Share2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Compartilhamento com fornecedores</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Por padrão nenhum fornecedor enxerga seus dados. Ative abaixo para
        autorizar um fornecedor a ver o estoque, vendas e preço dos rótulos
        dele neste restaurante.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Carregando...</div>}
        {!isLoading && suppliers.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            Você ainda não tem nenhum vinho vinculado a um fornecedor. Vá em <strong>Vinhos</strong> e selecione o fornecedor ao cadastrar o rótulo.
          </div>
        )}
        <ul className="divide-y divide-border">
          {suppliers.map((s) => {
            const on = enabledMap[s.id] ?? false;
            return (
              <li key={s.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.contact_email}</div>
                </div>
                <button
                  onClick={() => toggle(s.id, !on)}
                  className={`relative h-6 w-11 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}
                  aria-label="Toggle"
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
