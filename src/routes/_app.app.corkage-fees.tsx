import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Coins, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/app/corkage-fees")({
  component: CorkageFeesPage,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Row = {
  id: string;
  reference_year: number;
  reference_month: number;
  quantity: number;
  total_amount: number;
  notes: string | null;
};

function CorkageFeesPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [qty, setQty] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rows = [] } = useQuery<Row[]>({
    queryKey: ["corkage-fees", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corkage_fees")
        .select("id, reference_year, reference_month, quantity, total_amount, notes")
        .eq("restaurant_id", restaurantId!)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Pre-fill when selecting an existing month
  useEffect(() => {
    const existing = rows.find((r) => r.reference_year === year && r.reference_month === month);
    if (existing) {
      setQty(String(existing.quantity));
      setAmount(String(existing.total_amount));
      setNotes(existing.notes ?? "");
    } else {
      setQty("");
      setAmount("");
      setNotes("");
    }
  }, [year, month, rows]);

  async function save() {
    if (!restaurantId) return;
    const q = parseInt(qty || "0", 10);
    const a = parseFloat((amount || "0").replace(",", "."));
    if (isNaN(q) || isNaN(a)) {
      toast.error("Quantidade e valor devem ser numéricos.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("corkage_fees").upsert(
      {
        restaurant_id: restaurantId,
        reference_year: year,
        reference_month: month,
        quantity: q,
        total_amount: a,
        notes: notes || null,
      },
      { onConflict: "restaurant_id,reference_year,reference_month" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Taxa de rolha de ${MONTHS[month - 1]}/${String(year).slice(-2)} salva.`);
    qc.invalidateQueries({ queryKey: ["corkage-fees", restaurantId] });
    qc.invalidateQueries({ queryKey: ["dash-corkage", restaurantId] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("corkage_fees").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lançamento excluído.");
    qc.invalidateQueries({ queryKey: ["corkage-fees", restaurantId] });
    qc.invalidateQueries({ queryKey: ["dash-corkage", restaurantId] });
  }

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  const totalYear = rows
    .filter((r) => r.reference_year === year)
    .reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const qtyYear = rows
    .filter((r) => r.reference_year === year)
    .reduce((s, r) => s + Number(r.quantity || 0), 0);

  return (
    <div className="p-6 md:p-10 space-y-6">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Taxa de Rolha — Lançamento Mensal
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Registre a quantidade e o valor arrecadado com taxas de rolha em cada mês. Esse valor é
            somado ao faturamento do restaurante no Painel de Controle.
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="section-title mb-4">Lançar mês</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Ano</span>
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Mês</span>
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Quantidade (garrafas)</span>
            <input
              type="number"
              min={0}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Valor total (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Observações (opcional)</span>
            <input
              type="text"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="—"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar mês"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="section-title">Histórico — {year}</div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              Qtd ano: <span className="text-primary font-semibold">{qtyYear}</span>
            </span>
            <span>
              Total ano:{" "}
              <span className="text-primary font-semibold">
                R$ {totalYear.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </span>
          </div>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2">Mês</th>
              <th className="py-2 text-right">Quantidade</th>
              <th className="py-2 text-right">Valor total</th>
              <th className="py-2">Observações</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 font-medium">
                  {MONTHS[r.reference_month - 1]}/{String(r.reference_year).slice(-2)}
                </td>
                <td className="py-2 text-right">{r.quantity}</td>
                <td className="py-2 text-right text-primary">
                  R$ {Number(r.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => remove(r.id)}
                    className="rounded p-1 text-muted-foreground hover:text-[#f4a5b0]"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  Sem lançamentos ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
