import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";


export const Route = createFileRoute("/_app/app/sales")({
  component: SalesPage,
});

type SaleRow = {
  id: string;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  occurred_at: string;
  wines: { name?: string; producer?: string; vintage?: number; cost_price?: number } | null;
};

function formatMonth(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-input bg-background px-1.5 py-1 text-[11px] placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
    />
  );
}

type ColFilters = {
  month: string;
  name: string;
  quantity: string;
  revenue: string;
  unit_price: string;
  unit_cost: string;
};
const EMPTY_FILTERS: ColFilters = {
  month: "", name: "", quantity: "", revenue: "", unit_price: "", unit_cost: "",
};

function matchNum(filter: string, value: number | null | undefined): boolean {
  const s = filter.trim();
  if (!s) return true;
  if (value == null || Number.isNaN(Number(value))) return false;
  const n = Number(value);
  const range = s.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (range) return n >= Number(range[1].replace(",", ".")) && n <= Number(range[2].replace(",", "."));
  const op = s.match(/^\s*(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (op) {
    const v = Number(op[2].replace(",", "."));
    switch (op[1]) {
      case ">=": return n >= v;
      case "<=": return n <= v;
      case ">": return n > v;
      case "<": return n < v;
      case "=": return n === v;
    }
  }
  return String(n).includes(s.replace(",", "."));
}
function matchText(filter: string, value: string | null | undefined): boolean {
  const s = filter.trim().toLowerCase();
  if (!s) return true;
  return (value ?? "").toLowerCase().includes(s);
}

function SalesPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [editRevenue, setEditRevenue] = useState<string>("");
  const [editCost, setEditCost] = useState<string>("");
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);
  const setF = (k: keyof ColFilters, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const hasAnyFilter = Object.values(filters).some((v) => v !== "");

  const { data: sales = [], isLoading } = useQuery<SaleRow[]>({
    queryKey: ["sales", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("id, quantity, unit_price, unit_cost, occurred_at, movement_type, wines(name, producer, vintage, cost_price)")
        .eq("restaurant_id", restaurantId!)
        .eq("movement_type", "sale")
        .order("occurred_at", { ascending: false })
        .limit(200);
      return (data ?? []) as SaleRow[];
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({
      id,
      quantity,
      unit_price,
      unit_cost,
    }: { id: string; quantity: number; unit_price: number; unit_cost: number | null }) => {
      const { error } = await supabase
        .from("inventory_movements")
        .update({ quantity, unit_price, unit_cost })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", restaurantId] });
      setEditingId(null);
    },
  });

  const fillCostsMut = useMutation({
    mutationFn: async (rows: SaleRow[]) => {
      const targets = rows.filter(
        (r) => (r.unit_cost == null || Number(r.unit_cost) === 0) && Number(r.wines?.cost_price ?? 0) > 0,
      );
      if (targets.length === 0) throw new Error("Nenhum lançamento sem custo com preço de custo cadastrado.");
      for (const t of targets) {
        const { error } = await supabase
          .from("inventory_movements")
          .update({ unit_cost: Number(t.wines?.cost_price) })
          .eq("id", t.id);
        if (error) throw error;
      }
      return targets.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["sales", restaurantId] });
      toast.success(`${n} lançamento(s) atualizado(s) com o custo atual do cadastro.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", restaurantId] }),
  });

  const filtered = sales.filter((s) => {
    const monthStr = `${formatMonth(s.occurred_at)} ${new Date(s.occurred_at).toISOString().slice(0, 7)}`;
    const label = [s.wines?.name, s.wines?.producer, s.wines?.vintage].filter(Boolean).join(" ");
    const revenue = s.quantity * Number(s.unit_price ?? 0);
    return (
      matchText(filters.month, monthStr) &&
      matchText(filters.name, label) &&
      matchNum(filters.quantity, s.quantity) &&
      matchNum(filters.revenue, revenue) &&
      matchNum(filters.unit_price, Number(s.unit_price ?? 0)) &&
      matchNum(filters.unit_cost, Number(s.unit_cost ?? 0))
    );
  });


  const missingCost = filtered.filter((s) => s.unit_cost == null || Number(s.unit_cost) === 0);
  const total = filtered.reduce((s, m) => s + m.quantity * Number(m.unit_price ?? 0), 0);
  const bottles = filtered.reduce((s, m) => s + m.quantity, 0);

  const startEdit = (s: SaleRow) => {
    setEditingId(s.id);
    setEditQty(String(s.quantity));
    setEditRevenue((s.quantity * Number(s.unit_price ?? 0)).toFixed(2));
    setEditCost(s.unit_cost == null ? "" : String(s.unit_cost));
  };

  const saveEdit = (id: string) => {
    const q = Number(editQty);
    const rev = Number(editRevenue);
    if (!q || q <= 0) return;
    const up = rev > 0 ? rev / q : 0;
    const cost = editCost.trim() === "" ? null : Number(editCost);
    updateMut.mutate({ id, quantity: q, unit_price: up, unit_cost: cost });
  };

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Histórico de saídas registradas.</p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por mês (05/26 ou 2026-05), rótulo, produtor, safra, quantidade ou valores..."
          className="w-full bg-transparent text-sm outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-xs text-muted-foreground hover:text-foreground">
            limpar
          </button>
        )}
      </div>


      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase text-muted-foreground">Garrafas vendidas</div>
          <div className="mt-2 text-2xl font-semibold">{bottles}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase text-muted-foreground">Receita</div>
          <div className="mt-2 text-2xl font-semibold">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {missingCost.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <div className="text-sm">
            <strong>{missingCost.length}</strong> lançamento(s) sem preço de custo — o CMV desse período fica subestimado.
            Edite o custo linha por linha abaixo ou aplique o custo atual do cadastro.
          </div>
          <button
            onClick={() => fillCostsMut.mutate(filtered)}
            disabled={fillCostsMut.isPending}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {fillCostsMut.isPending ? "Aplicando..." : "Aplicar custo atual do cadastro"}
          </button>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Mês</th>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Qtd</th>
              <th className="px-4 py-3">Faturamento</th>
              <th className="px-4 py-3">Preço unit.</th>
              <th className="px-4 py-3">Custo unit.</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && sales.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma venda registrada.</td></tr>}
            {filtered.map((s) => {
              const isEditing = editingId === s.id;
              const revenue = s.quantity * Number(s.unit_price ?? 0);
              return (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{formatMonth(s.occurred_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.wines?.name ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.wines?.producer}
                      {s.wines?.vintage ? ` · ${s.wines.vintage}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="no-spin w-20 rounded border border-border bg-background px-2 py-1"
                      />
                    ) : (
                      s.quantity
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editRevenue}
                        onChange={(e) => setEditRevenue(e.target.value)}
                        className="no-spin w-28 rounded border border-border bg-background px-2 py-1"
                      />
                    ) : (
                      `R$ ${revenue.toFixed(2)}`
                    )}
                  </td>
                  <td className="px-4 py-3">R$ {Number(s.unit_price ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                        placeholder={Number(s.wines?.cost_price ?? 0) > 0 ? Number(s.wines?.cost_price).toFixed(2) : "0,00"}
                        className="no-spin w-24 rounded border border-border bg-background px-2 py-1"
                      />
                    ) : s.unit_cost != null && Number(s.unit_cost) > 0 ? (
                      `R$ ${Number(s.unit_cost).toFixed(2)}`
                    ) : (
                      <span className="text-xs font-medium text-destructive">sem custo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(s.id)}
                          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded border border-border px-3 py-1 text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Excluir este lançamento de venda?")) deleteMut.mutate(s.id);
                          }}
                          className="rounded border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
