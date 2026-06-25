import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Save } from "lucide-react";

export const Route = createFileRoute("/_app/app/sales-monthly")({
  component: MonthlySalesPage,
});

type WineRow = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  volume: string | null;
  internal_code: string | null;
  sale_price: number;
  cost_price: number;
};

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MonthlySalesPage() {
  const { restaurantId } = useAuth();
  const [month, setMonth] = useState(todayMonth());
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [revenue, setRevenue] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: wines = [], isLoading } = useQuery({
    queryKey: ["wines-monthly", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("id, name, producer, vintage, volume, internal_code, sale_price, cost_price")
        .eq("restaurant_id", restaurantId!)
        .order("name");
      if (error) throw error;
      return data as WineRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return wines;
    return wines.filter((w) =>
      [w.name, w.producer, w.internal_code, w.volume]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }, [wines, search]);

  const filled = Object.entries(qty).filter(([id, v]) => Number(v) > 0 && Number(revenue[id] || 0) > 0);
  const totalUnits = filled.reduce((s, [, v]) => s + Number(v || 0), 0);
  const totalRevenue = filled.reduce((s, [id]) => s + Number(revenue[id] || 0), 0);

  async function saveAll() {
    if (!restaurantId) return;
    const qtyOnly = Object.entries(qty).filter(([, v]) => Number(v) > 0);
    if (qtyOnly.length === 0) return toast.error("Preencha ao menos uma quantidade.");
    const missing = qtyOnly.filter(([id]) => !(Number(revenue[id] || 0) > 0));
    if (missing.length > 0) return toast.error("Informe o faturamento de cada rótulo com quantidade preenchida.");

    setSaving(true);
    const [y, m] = month.split("-").map(Number);
    const occurredAt = new Date(y, m, 0, 23, 59, 59).toISOString();

    const rows = qtyOnly.map(([wine_id, q]) => {
      const w = wines.find((x) => x.id === wine_id)!;
      const rev = Number(revenue[wine_id]);
      const quantity = Number(q);
      return {
        wine_id,
        restaurant_id: restaurantId,
        movement_type: "sale" as const,
        quantity,
        unit_price: rev / quantity,
        unit_cost: Number(w.cost_price),
        occurred_at: occurredAt,
        notes: `Venda mensal ${month} · faturamento R$ ${rev.toFixed(2)}`,
      };
    });

    const { error } = await supabase.from("inventory_movements").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} venda(s) registrada(s) para ${month}.`);
    setQty({});
    setRevenue({});
  }


  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendas mensais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lance, para cada rótulo, a quantidade vendida no mês e o faturamento correspondente. O sistema usa esses dois números para calcular o preço médio histórico e a venda média mensal de cada rótulo — sem depender do preço atual.
          </p>

        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Mês de referência</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={saveAll}
            disabled={saving || filled.length === 0}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : `Salvar (${filled.length})`}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Linhas preenchidas" value={String(filled.length)} />
        <Stat label="Unidades totais" value={String(totalUnits)} />
        <Stat label="Receita estimada" value={`R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, produtor, código ou volume..."
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3 w-32">Qtd. vendida</th>
              <th className="px-4 py-3">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum rótulo encontrado.</td></tr>
            )}
            {filtered.map((w) => {
              const q = Number(qty[w.id] || 0);
              const subtotal = q * Number(w.sale_price);
              return (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{w.internal_code ?? "-"}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {w.producer ?? ""}{w.vintage ? ` · ${w.vintage}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-2">{w.volume ?? "-"}</td>
                  <td className="px-4 py-2">R$ {Number(w.sale_price).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={qty[w.id] ?? ""}
                      onChange={(e) => setQty({ ...qty, [w.id]: e.target.value })}
                      placeholder="0"
                      className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring no-spin"
                    />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {q > 0 ? `R$ ${subtotal.toFixed(2)}` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        As vendas são registradas com a data do último dia do mês selecionado e usam o preço atual do rótulo. Alterações futuras de preço não afetam os lançamentos já salvos.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
