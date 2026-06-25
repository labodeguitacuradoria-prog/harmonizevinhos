import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/app/sales")({
  component: SalesPage,
});

type SaleRow = {
  id: string;
  quantity: number;
  unit_price: number | null;
  occurred_at: string;
  wines: { name?: string; producer?: string; vintage?: number } | null;
};

function formatMonth(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

function SalesPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [editRevenue, setEditRevenue] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const { data: sales = [], isLoading } = useQuery<SaleRow[]>({
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
      return (data ?? []) as SaleRow[];
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, quantity, unit_price }: { id: string; quantity: number; unit_price: number }) => {
      const { error } = await supabase
        .from("inventory_movements")
        .update({ quantity, unit_price })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", restaurantId] });
      setEditingId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales", restaurantId] }),
  });

  const months = Array.from(new Set(sales.map((s) => formatMonth(s.occurred_at))))
    .sort((a, b) => {
      const [ma, ya] = a.split("/").map(Number);
      const [mb, yb] = b.split("/").map(Number);
      return (ya - yb) || (ma - mb);
    });

  const filtered = selectedMonth === "all" ? sales : sales.filter((s) => formatMonth(s.occurred_at) === selectedMonth);

  const total = filtered.reduce((s, m) => s + m.quantity * Number(m.unit_price ?? 0), 0);
  const bottles = filtered.reduce((s, m) => s + m.quantity, 0);

  const startEdit = (s: SaleRow) => {
    setEditingId(s.id);
    setEditQty(String(s.quantity));
    setEditRevenue((s.quantity * Number(s.unit_price ?? 0)).toFixed(2));
  };

  const saveEdit = (id: string) => {
    const q = Number(editQty);
    const rev = Number(editRevenue);
    if (!q || q <= 0) return;
    const up = rev > 0 ? rev / q : 0;
    updateMut.mutate({ id, quantity: q, unit_price: up });
  };

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Histórico de saídas registradas.</p>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos os meses</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
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

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Mês</th>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Qtd</th>
              <th className="px-4 py-3">Faturamento</th>
              <th className="px-4 py-3">Preço unit.</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>}
            {!isLoading && sales.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma venda registrada.</td></tr>}
            {sales.map((s) => {
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
