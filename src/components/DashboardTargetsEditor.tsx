import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

export type IndicatorKey =
  | "faturamento"
  | "garrafas"
  | "tacas"
  | "estoque"
  | "preco"
  | "cmv"
  | "rolha";

export const INDICATORS: Array<{
  key: IndicatorKey;
  label: string;
  unit: "R$" | "un" | "%";
  hint: string;
}> = [
  { key: "faturamento", label: "Faturamento", unit: "R$", hint: "Receita total mensal (inclui rolha)." },
  { key: "garrafas", label: "Garrafas vendidas", unit: "un", hint: "Quantidade de garrafas vendidas." },
  { key: "tacas", label: "Taças vendidas", unit: "un", hint: "Quantidade de taças vendidas." },
  { key: "estoque", label: "Estoque (garrafas)", unit: "un", hint: "Nível-alvo de garrafas em adega." },
  { key: "preco", label: "Preço médio", unit: "R$", hint: "Ticket médio por unidade vendida." },
  { key: "cmv", label: "CMV", unit: "%", hint: "% custo sobre venda (meta usual ≤ 33%)." },
  { key: "rolha", label: "Taxa de rolha", unit: "R$", hint: "Arrecadação mensal com taxa de rolha." },
];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Row = {
  id: string;
  indicator: string;
  reference_year: number;
  reference_month: number | null;
  target_value: number;
};

export function useDashboardTargets(restaurantId: string | null, year: number) {
  return useQuery({
    queryKey: ["dashboard-targets", restaurantId, year],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("dashboard_targets")
        .select("id, indicator, reference_year, reference_month, target_value")
        .eq("restaurant_id", restaurantId!)
        .eq("reference_year", year);
      return (data ?? []) as Row[];
    },
  });
}

export function targetsFor(
  rows: Row[] | undefined,
  indicator: IndicatorKey,
): { monthly: number[]; annual: number | null } {
  const monthly: number[] = Array(12).fill(0);
  let annual: number | null = null;
  let anyMonthly = false;
  for (const r of rows ?? []) {
    if (r.indicator !== indicator) continue;
    if (r.reference_month === null) annual = Number(r.target_value) || 0;
    else {
      monthly[r.reference_month - 1] = Number(r.target_value) || 0;
      anyMonthly = true;
    }
  }
  return { monthly: anyMonthly ? monthly : [], annual };
}

export default function DashboardTargetsEditor({
  open,
  onClose,
  restaurantId,
  year,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  year: number;
}) {
  const qc = useQueryClient();
  const { data: rows = [] } = useDashboardTargets(restaurantId, year);
  const [indicator, setIndicator] = useState<IndicatorKey>("faturamento");
  const [monthly, setMonthly] = useState<string[]>(Array(12).fill(""));
  const [annual, setAnnual] = useState<string>("");

  const current = useMemo(() => INDICATORS.find((i) => i.key === indicator)!, [indicator]);

  useEffect(() => {
    const map: Record<string, Row> = {};
    for (const r of rows) {
      if (r.indicator !== indicator) continue;
      map[r.reference_month === null ? "y" : String(r.reference_month)] = r;
    }
    setMonthly(Array.from({ length: 12 }, (_, i) => {
      const v = map[String(i + 1)]?.target_value;
      return v != null ? String(v) : "";
    }));
    setAnnual(map["y"]?.target_value != null ? String(map["y"].target_value) : "");
  }, [rows, indicator]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const upserts: Array<{
        restaurant_id: string;
        indicator: string;
        reference_year: number;
        reference_month: number | null;
        target_value: number;
      }> = [];
      const deletes: Array<{ month: number | null }> = [];
      monthly.forEach((v, i) => {
        const n = v.trim() === "" ? null : Number(v.replace(",", "."));
        if (n === null || Number.isNaN(n)) {
          deletes.push({ month: i + 1 });
        } else {
          upserts.push({
            restaurant_id: restaurantId,
            indicator,
            reference_year: year,
            reference_month: i + 1,
            target_value: n,
          });
        }
      });
      const na = annual.trim() === "" ? null : Number(annual.replace(",", "."));
      if (na === null || Number.isNaN(na)) {
        deletes.push({ month: null });
      } else {
        upserts.push({
          restaurant_id: restaurantId,
          indicator,
          reference_year: year,
          reference_month: null,
          target_value: na,
        });
      }

      // Delete removed entries
      for (const d of deletes) {
        let q = supabase
          .from("dashboard_targets")
          .delete()
          .eq("restaurant_id", restaurantId)
          .eq("indicator", indicator)
          .eq("reference_year", year);
        q = d.month === null ? q.is("reference_month", null) : q.eq("reference_month", d.month);
        await q;
      }

      if (upserts.length > 0) {
        // Manually upsert: try update, if 0 rows, insert
        for (const u of upserts) {
          let sel = supabase
            .from("dashboard_targets")
            .select("id")
            .eq("restaurant_id", u.restaurant_id)
            .eq("indicator", u.indicator)
            .eq("reference_year", u.reference_year);
          sel = u.reference_month === null
            ? sel.is("reference_month", null)
            : sel.eq("reference_month", u.reference_month);
          const { data: existing } = await sel.maybeSingle();
          if (existing?.id) {
            await supabase
              .from("dashboard_targets")
              .update({ target_value: u.target_value })
              .eq("id", existing.id);
          } else {
            await supabase.from("dashboard_targets").insert(u);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-targets", restaurantId, year] });
    },
  });

  if (!open) return null;

  const sumMonthly = monthly.reduce((s, v) => {
    const n = Number(v.replace(",", "."));
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-primary"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
        <h2 className="page-title text-base">Metas do painel — {year}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Defina metas mensais e/ou anuais. Deixe em branco para não usar meta em determinado mês.
          Metas aparecem como linha pontilhada dourada nos gráficos.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3">
          {INDICATORS.map((i) => (
            <button
              key={i.key}
              onClick={() => setIndicator(i.key)}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                indicator === i.key
                  ? "border-primary bg-[color:var(--wine)]/20 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/60"
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Metas mensais — {current.label} ({current.unit})
              </div>
              <div className="text-[10px] text-muted-foreground">
                Soma mensal: {current.unit === "R$" ? "R$ " : ""}
                {sumMonthly.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                {current.unit === "%" ? "%" : ""}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {MONTHS.map((m, i) => (
                <label key={m} className="flex flex-col">
                  <span className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m}/{String(year).slice(-2)}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={monthly[i]}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMonthly((prev) => prev.map((p, idx) => (idx === i ? v : p)));
                    }}
                    placeholder="—"
                    className="rounded-md border border-border bg-[color:var(--surface-2)] px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">{current.hint}</p>
          </div>
          <div className="rounded-lg border border-border bg-[color:var(--surface-2)] p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
              Meta anual ({current.unit})
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={annual}
              onChange={(e) => setAnnual(e.target.value)}
              placeholder="—"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-lg font-bold text-primary focus:border-primary focus:outline-none"
            />
            <p className="mt-2 text-[10px] text-muted-foreground">
              Usada como referência acumulada no painel. Se não informar, o painel usará a soma das metas mensais.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={() => saveMut.mutate(undefined, { onSuccess: () => onClose() })}
            disabled={saveMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saveMut.isPending ? "Salvando..." : "Salvar metas"}
          </button>
        </div>
      </div>
    </div>
  );
}
