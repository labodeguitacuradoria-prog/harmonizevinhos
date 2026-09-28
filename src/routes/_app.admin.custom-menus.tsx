import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Paperclip, PenTool } from "lucide-react";
import { setActiveRestaurant } from "@/lib/active-scope";
import { CUSTOM_STATUS_LABEL, openBriefFile, type BriefAttachment } from "@/components/printed-menu/CustomMenu";

export const Route = createFileRoute("/_app/admin/custom-menus")({
  component: CustomMenusAdmin,
  head: () => ({
    meta: [
      { title: "Cartas personalizadas | Administração" },
      { name: "description", content: "Pedidos de cartas de vinhos exclusivas enviados pelos restaurantes." },
      { property: "og:title", content: "Cartas personalizadas" },
      { property: "og:description", content: "Gestão dos pedidos de cartas exclusivas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CustomMenusAdmin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-custom-menus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_menu_requests")
        .select("*, restaurants(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function update(id: string, patch: { status?: string; admin_notes?: string }) {
    const { error } = await supabase.from("custom_menu_requests").update(patch).eq("id", id);
    if (error) return toast.error(`Não foi possível salvar: ${error.message}`);
    qc.invalidateQueries({ queryKey: ["admin-custom-menus"] });
  }

  function openEditor(restaurantId: string, id: string) {
    setActiveRestaurant(restaurantId);
    navigate({ to: "/app/wine-menu", search: { request: id } as never });
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold uppercase tracking-[2px] text-primary">
        <Sparkles className="h-5 w-5" /> Cartas personalizadas
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pedidos enviados pelos restaurantes. Abra o editor para desenhar a carta e disponibilize quando estiver pronta.
      </p>
      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
      ) : data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {data.map((r) => {
            const atts = (r.attachments as unknown as BriefAttachment[]) ?? [];
            const rest = r.restaurants as unknown as { name: string } | null;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {rest?.name ?? "—"} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={r.status}
                      onChange={(e) => update(r.id, { status: e.target.value })}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {Object.entries(CUSTOM_STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => openEditor(r.restaurant_id, r.id)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase text-primary-foreground"
                    >
                      <PenTool className="h-3.5 w-3.5" /> Abrir editor
                    </button>
                  </div>
                </div>
                {r.brief_text && <p className="mt-3 whitespace-pre-line text-sm">{r.brief_text}</p>}
                {atts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {atts.map((a) => (
                      <button
                        key={a.path}
                        onClick={() => openBriefFile(a.path, a.name)}
                        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary"
                      >
                        <Paperclip className="h-3 w-3" /> {a.name}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  defaultValue={r.admin_notes ?? ""}
                  onBlur={(e) => e.target.value !== (r.admin_notes ?? "") && update(r.id, { admin_notes: e.target.value })}
                  placeholder="Anotações internas (prazo, preço contratado...)"
                  rows={2}
                  className="mt-3 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
