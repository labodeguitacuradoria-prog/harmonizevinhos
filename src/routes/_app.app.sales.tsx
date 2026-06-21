import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/app/sales")({
  component: SalesPage,
});

function SalesPage() {
  const { restaurantId } = useAuth();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("id, quantity, unit_price, occurred_at, movement_type, wines(name, producer, vintage)")
        .eq("restaurant_id", restaurantId!)
        .eq("movement_type", "sale")
        .order("occurred_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const total = sales.reduce((s, m) => s + m.quantity * Number(m.unit_price ?? 0), 0);
  const bottles = sales.reduce((s, m) => s + m.quantity, 0);

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Histórico de saídas registradas.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase text-muted-foreground">Garrafas vendidas (últimas 200)</div>
          <div className="mt-2 text-2xl font-semibold">{bottles}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase text-muted-foreground">Receita</div>
          <div className="mt-2 text-2xl font-semibold">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Qtd</th>
              <th className="px-4 py-3">Preço unit.</th>
              <th className="px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && sales.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma venda registrada.</td></tr>}
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{new Date(s.occurred_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{(s.wines as { name?: string } | null)?.name ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">
                    {(s.wines as { producer?: string; vintage?: number } | null)?.producer}
                    {(s.wines as { vintage?: number } | null)?.vintage ? ` · ${(s.wines as { vintage?: number } | null)?.vintage}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">{s.quantity}</td>
                <td className="px-4 py-3">R$ {Number(s.unit_price ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3">R$ {(s.quantity * Number(s.unit_price ?? 0)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
