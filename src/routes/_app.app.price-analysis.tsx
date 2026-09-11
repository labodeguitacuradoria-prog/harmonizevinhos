import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Store, Building2, Info, HelpCircle, Layers, SlidersHorizontal, ArrowUpRight, ArrowDownRight, CheckCircle2, Save, Clock } from "lucide-react";
import ModuleGate from "@/components/ModuleGate";

export const Route = createFileRoute("/_app/app/price-analysis")({
  component: () => (
    <ModuleGate route="/app/price-analysis">
      <PriceAnalysisPage />
    </ModuleGate>
  ),
});

type WineRow = {
  id: string;
  name: string;
  wine_type: string | null;
  volume: string | null;
  sale_price: number | null;
  active_on_menu: boolean | null;
  suggested_retail_price: number | null;
  catalog_id: string | null;
  wine_catalog?: { suggested_retail_price: number | null; status: string | null } | null;
};

type SimulationRecord = {
  id: string;
  name: string;
  entree_price: number;
  prices: Record<string, number>;
  updated_at: string;
};


const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto", white: "Branco", rose: "Rosé",
  sparkling: "Espumante", dessert: "Fortificado", fortified: "Fortificado",
};
function normType(t: string | null) {
  if (!t) return "Outro";
  const label = LEGACY_TYPE_MAP[t] ?? t;
  if (/tinto/i.test(label)) return "Tinto";
  if (/branco/i.test(label)) return "Branco";
  if (/ros[eé]/i.test(label)) return "Rosé";
  if (/espumante|sparkling/i.test(label)) return "Espumante";
  return "Outro";
}
const isGlassVol = (v: string | null | undefined) => !!v && /taça|taca|glass/i.test(v);

type ConceptKey =
  | "Geral" | "Peixes" | "Steakhouse" | "Italiano" | "Japones"
  | "Frances" | "Arabe" | "Pizzaria" | "Hamburgueria" | "Personalizado";

type Ratios = { white: number; red: number; sparkling: number; rose: number };

const CONCEPT_PRESETS: Record<Exclude<ConceptKey, "Personalizado">, Ratios> = {
  Geral:         { white: 30, red: 50, sparkling: 12, rose: 8 },
  Peixes:        { white: 45, red: 20, sparkling: 25, rose: 10 },
  Steakhouse:    { white: 15, red: 70, sparkling: 10, rose: 5 },
  Italiano:      { white: 30, red: 45, sparkling: 15, rose: 10 },
  Japones:       { white: 40, red: 15, sparkling: 30, rose: 15 },
  Frances:       { white: 35, red: 40, sparkling: 20, rose: 5 },
  Arabe:         { white: 35, red: 40, sparkling: 15, rose: 10 },
  Pizzaria:      { white: 20, red: 60, sparkling: 10, rose: 10 },
  Hamburgueria:  { white: 20, red: 55, sparkling: 15, rose: 10 },
};

const CONCEPT_LABEL: Record<ConceptKey, string> = {
  Geral: "Geral / Internacional",
  Peixes: "Peixes e Frutos do Mar",
  Steakhouse: "Steakhouse / Parrilla / Carnes",
  Italiano: "Italiano / Bistrô",
  Japones: "Japonês / Sushi",
  Frances: "Francês / Alta Gastronomia",
  Arabe: "Árabe / Cozinha Oriental",
  Pizzaria: "Pizzaria",
  Hamburgueria: "Hamburgueria / Pub / Bar",
  Personalizado: "Personalizado",
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function PriceAnalysisPage() {
  const { restaurantId } = useAuth();
  const [mode, setMode] = useState<"current" | "new">("current");
  const [entreePrice, setEntreePrice] = useState<number>(85);
  const [targetWineCount, setTargetWineCount] = useState<number>(50);
  const [concept, setConcept] = useState<ConceptKey>("Geral");
  const [customRatios, setCustomRatios] = useState<Ratios>({ white: 30, red: 45, sparkling: 15, rose: 10 });
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [simPrices, setSimPrices] = useState<Record<string, number>>({});
  const [simSearch, setSimSearch] = useState("");
  const [simBracketFilter, setSimBracketFilter] = useState<string>("all");
  const [simTypeFilter, setSimTypeFilter] = useState<string>("all");
  const [simChangedOnly, setSimChangedOnly] = useState(false);
  const [simId, setSimId] = useState<string | null>(null);
  const [simName, setSimName] = useState<string>("");

  const { data: wines = [] } = useQuery({
    queryKey: ["price-analysis-wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("wines")
        .select("id,name,wine_type,volume,sale_price,active_on_menu,suggested_retail_price,catalog_id,wine_catalog(suggested_retail_price,status)")
        .eq("restaurant_id", restaurantId!);
      return (data ?? []) as unknown as WineRow[];
    },
  });


  const queryClient = useQueryClient();
  const hydratedFor = useRef<string | null>(null);

  const { data: savedSetting } = useQuery({
    queryKey: ["price-analysis-setting", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("price_analysis_settings")
        .select("entree_price,used_at")
        .eq("restaurant_id", restaurantId!)
        .maybeSingle();
      return data as { entree_price: number; used_at: string } | null;
    },
  });

  useEffect(() => {
    if (!restaurantId || hydratedFor.current === restaurantId) return;
    if (savedSetting === undefined) return;
    hydratedFor.current = restaurantId;
    if (savedSetting?.entree_price) setEntreePrice(Number(savedSetting.entree_price));
  }, [restaurantId, savedSetting]);

  const saveEntree = useMutation({
    mutationFn: async (value: number) => {
      if (!restaurantId) throw new Error("Selecione um restaurante");
      const { error } = await supabase
        .from("price_analysis_settings")
        .upsert(
          { restaurant_id: restaurantId, entree_price: value, used_at: new Date().toISOString() },
          { onConflict: "restaurant_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preço do prato principal salvo");
      queryClient.invalidateQueries({ queryKey: ["price-analysis-setting", restaurantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Saved simulations ----
  const { data: savedSims = [] } = useQuery({
    queryKey: ["price-simulations", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_simulations")
        .select("id,name,entree_price,prices,updated_at")
        .eq("restaurant_id", restaurantId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SimulationRecord[];
    },
  });

  const saveSimulation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("Selecione um restaurante");
      const name = simName.trim() || `Simulação ${new Date().toLocaleDateString("pt-BR")}`;
      const payload = {
        restaurant_id: restaurantId,
        name,
        entree_price: Math.max(1, entreePrice),
        prices: simPrices,
      };
      if (simId) {
        const { error } = await supabase.from("price_simulations").update(payload).eq("id", simId);
        if (error) throw error;
        return simId;
      }
      const { data, error } = await supabase
        .from("price_simulations")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setSimId(id);
      toast.success("Simulação salva");
      queryClient.invalidateQueries({ queryKey: ["price-simulations", restaurantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSimulation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_simulations").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      if (simId === id) { setSimId(null); setSimName(""); setSimPrices({}); }
      toast.success("Simulação excluída");
      queryClient.invalidateQueries({ queryKey: ["price-simulations", restaurantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openSimulation(id: string) {
    const s = savedSims.find((x) => x.id === id);
    if (!s) return;
    setSimId(s.id);
    setSimName(s.name);
    setSimPrices((s.prices ?? {}) as Record<string, number>);
    if (s.entree_price) setEntreePrice(Number(s.entree_price));
    toast.success(`Simulação "${s.name}" carregada`);
  }

  function newSimulation() {
    setSimId(null);
    setSimName("");
    setSimPrices({});
    setSimChangedOnly(false);
  }

  // ---- Market price (preço de mercado) ----
  const saveMarketPrice = useMutation({
    mutationFn: async ({ wineId, value }: { wineId: string; value: number | null }) => {
      const { error } = await supabase.from("wines").update({ suggested_retail_price: value }).eq("id", wineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-analysis-wines", restaurantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const savedDateLabel = savedSetting?.used_at
    ? new Date(savedSetting.used_at).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;
  const isDirty = !!savedSetting && Number(savedSetting.entree_price) !== entreePrice;


  // Only bottled active wines participate in price analysis
  const activeWines = useMemo(
    () => wines.filter((w) => w.active_on_menu !== false && !isGlassVol(w.volume) && (w.sale_price ?? 0) > 0),
    [wines],
  );

  const E = Math.max(1, entreePrice);
  const totalBottles = mode === "current" ? activeWines.length : Math.max(5, targetWineCount);

  const activeRatios: Ratios =
    concept === "Personalizado" ? customRatios : CONCEPT_PRESETS[concept];
  const customTotal = customRatios.white + customRatios.red + customRatios.sparkling + customRatios.rose;

  // 5 Harrington brackets
  const brackets = useMemo(() => {
    const defs = [
      { id: "b1", name: "Entrada (Acessível)",              mult: "1x a 2x E", min: E,     max: E * 2, pct: 20 },
      { id: "b2", name: "Faixa Principal de Giro",          mult: "2x a 3x E", min: E * 2, max: E * 3, pct: 45, sweet: true },
      { id: "b3", name: "Seleção Especial",                 mult: "3x a 4x E", min: E * 3, max: E * 4, pct: 15 },
      { id: "b4", name: "Premium",                          mult: "4x a 5x E", min: E * 4, max: E * 5, pct: 15 },
      { id: "b5", name: "Super Premium (Ícones)",           mult: "> 5x E",    min: E * 5, max: Infinity, pct: 5 },
    ];
    return defs.map((b) => {
      const target = Math.round((totalBottles * b.pct) / 100);
      const inRange = activeWines.filter((w) => {
        const p = w.sale_price ?? 0;
        return b.max === Infinity ? p >= b.min : p >= b.min && p < b.max;
      });
      const actual = mode === "current" ? inRange.length : 0;
      const actualPct = totalBottles > 0 ? (actual / totalBottles) * 100 : 0;
      const delta = target - actual;
      return { ...b, target, actual, actualPct, delta, wines: inRange };
    });
  }, [E, totalBottles, activeWines, mode]);

  // Purchase matrix (bracket x style) — only in planning mode
  const matrix = useMemo(() => {
    return brackets.map((b) => {
      const sp = Math.round((b.target * activeRatios.sparkling) / 100);
      const wh = Math.round((b.target * activeRatios.white) / 100);
      const ro = Math.round((b.target * activeRatios.rose) / 100);
      const rd = Math.max(0, b.target - sp - wh - ro);
      return { b, sparkling: sp, white: wh, rose: ro, red: rd };
    });
  }, [brackets, activeRatios]);

  const totalActual = activeWines.length;

  // ---- Price simulator (study only, never writes to the catalog) ----
  const bracketOf = (price: number) => brackets.find((b) => (b.max === Infinity ? price >= b.min : price >= b.min && price < b.max));

  const simulation = useMemo(() => {
    const priceFor = (w: WineRow) => simPrices[w.id] ?? (w.sale_price ?? 0);

    const rows = brackets.map((b) => {
      const simulated = activeWines.filter((w) => {
        const p = priceFor(w);
        return b.max === Infinity ? p >= b.min : p >= b.min && p < b.max;
      }).length;
      const simulatedPct = totalActual > 0 ? (simulated / totalActual) * 100 : 0;
      return { ...b, simulated, simulatedPct, simGap: b.target - simulated };
    });

    const sum = (fn: (w: WineRow) => number) => activeWines.reduce((a, w) => a + fn(w), 0);
    const avgCurrent = totalActual > 0 ? sum((w) => w.sale_price ?? 0) / totalActual : 0;
    const avgSimulated = totalActual > 0 ? sum(priceFor) / totalActual : 0;

    const term = simSearch.trim().toLowerCase();
    const wineRows = activeWines
      .filter((w) => (term ? w.name.toLowerCase().includes(term) : true))
      .filter((w) => (simTypeFilter === "all" ? true : normType(w.wine_type) === simTypeFilter))
      .filter((w) => (simBracketFilter === "all" ? true : bracketOf(w.sale_price ?? 0)?.id === simBracketFilter))
      .filter((w) => (simChangedOnly ? simPrices[w.id] != null && simPrices[w.id] !== (w.sale_price ?? 0) : true))
      .sort((a, b) => (b.sale_price ?? 0) - (a.sale_price ?? 0))
      .map((w) => {
        const currentPrice = w.sale_price ?? 0;
        const simPrice = priceFor(w);
        const changed = simPrices[w.id] != null && simPrice !== currentPrice;
        const catalogMarket =
          w.wine_catalog?.status === "approved" ? (w.wine_catalog?.suggested_retail_price ?? null) : null;
        const marketPrice = w.suggested_retail_price ?? catalogMarket;
        return {
          ...w,
          currentPrice,
          simPrice,
          changed,
          marketPrice,
          marketFromCatalog: w.suggested_retail_price == null && catalogMarket != null,
          diff: simPrice - currentPrice,
          diffPct: currentPrice > 0 ? ((simPrice - currentPrice) / currentPrice) * 100 : 0,
          currentBracket: bracketOf(currentPrice)?.name ?? "Fora das faixas",
          currentBracketId: bracketOf(currentPrice)?.id ?? null,
          simBracket: bracketOf(simPrice)?.name ?? "Fora das faixas",
          simBracketId: bracketOf(simPrice)?.id ?? null,
        };
      });

    return { rows, wineRows, avgCurrent, avgSimulated };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brackets, activeWines, totalActual, simPrices, simSearch, simTypeFilter, simBracketFilter, simChangedOnly]);



  return (
    <div className="mx-auto max-w-[1400px] p-6 md:p-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" /> Modelo Harrington · List Mapping
          </div>
          <h1 className="page-title text-2xl">Análise de Preços da Carta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Faixas ideais de preço ancoradas no prato principal para otimizar o giro e a margem.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs">
          <button
            onClick={() => setMode("current")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold uppercase tracking-wide transition ${
              mode === "current" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Store className="h-3.5 w-3.5" /> Carta Atual
          </button>
          <button
            onClick={() => setMode("new")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold uppercase tracking-wide transition ${
              mode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" /> Novo Restaurante
          </button>
        </div>
      </header>

      {/* Methodology explainer */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <HelpCircle className="h-4 w-4" /> Conceito Metodológico
          </div>
          <button onClick={() => setShowExplanation(!showExplanation)} className="text-[11px] text-muted-foreground underline hover:text-foreground">
            {showExplanation ? "Ocultar" : "Entender o conceito"}
          </button>
        </div>
        {showExplanation && (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 text-xs text-muted-foreground md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-1 font-semibold text-foreground">Ancoragem pelo prato principal (E)</div>
              O preço médio dos pratos principais é a régua da carta. A "Faixa Principal de Giro" — onde ocorre a maior venda —
              fica entre <span className="font-semibold text-primary">2× E</span> e <span className="font-semibold text-primary">3× E</span>.
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-1 font-semibold text-foreground">Distribuição-alvo (Harrington)</div>
              20% Entrada · <span className="text-primary font-semibold">45% Faixa Principal</span> · 15% Seleção Especial ·
              15% Premium · 5% Super Premium.
            </div>
          </div>
        )}
      </section>

      {/* Controls */}
      <section className="mb-6 grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
        <ControlCard
          label="Preço médio do prato principal (E)"
          hint="Base de cálculo (Ex.: R$ 85,00)."
        >
          <div className="flex items-center gap-2">
            <span className="text-primary text-lg font-semibold">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={entreePrice === 0 ? "" : String(entreePrice)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                setEntreePrice(raw === "" ? 0 : Number(raw));
              }}
              onBlur={() => { if (entreePrice < 1) setEntreePrice(1); }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-lg font-semibold text-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={() => saveEntree.mutate(Math.max(1, entreePrice))}
              disabled={saveEntree.isPending || !restaurantId}
              title="Salvar valor usado na simulação"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Salvar
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            {savedDateLabel ? (
              <span>
                Último valor salvo: <span className="font-semibold text-foreground">{fmtBRL(Number(savedSetting!.entree_price))}</span> em {savedDateLabel}
                {isDirty && <span className="ml-1 text-primary">(não salvo)</span>}
              </span>
            ) : (
              <span>Nenhum valor salvo ainda para este restaurante.</span>
            )}
          </div>

        </ControlCard>

        <ControlCard
          label="Ponto de maior venda"
          hint="Faixa Principal de Giro (2× E a 3× E)."
        >
          <div className="text-lg font-semibold text-primary">
            {fmtBRL(E * 2)} <span className="text-muted-foreground">–</span> {fmtBRL(E * 3)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Meta: 45% dos rótulos</div>
        </ControlCard>

        {mode === "current" ? (
          <ControlCard
            label="Rótulos ativos na carta"
            hint="Vinhos ativos, engarrafados, com preço > 0."
          >
            <div className="text-2xl font-semibold text-foreground">{totalActual}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {wines.length - totalActual} rótulo(s) fora do escopo desta análise
            </div>
          </ControlCard>
        ) : (
          <ControlCard
            label="Quantidade desejada de rótulos"
            hint="Tamanho-alvo da nova carta."
          >
            <input
              type="text"
              inputMode="numeric"
              value={targetWineCount === 0 ? "" : String(targetWineCount)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                setTargetWineCount(raw === "" ? 0 : Number(raw));
              }}
              onBlur={() => { if (targetWineCount < 5) setTargetWineCount(5); }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-lg font-semibold text-foreground focus:border-primary focus:outline-none"
            />
          </ControlCard>
        )}
      </section>

      {/* 5 Bracket cards */}
      <section className="mb-8">
        <SectionTitle
          icon={<Layers className="h-4 w-4" />}
          title="Faixas de Preço"
          subtitle={mode === "current" ? "Comparativo Ideal vs Atual" : "Distribuição-alvo para a nova carta"}
        />

        <div className="grid gap-3 md:grid-cols-5">
          {brackets.map((b) => (
            <BracketCard
              key={b.id}
              name={b.name}
              mult={b.mult}
              min={b.min}
              max={b.max}
              targetPct={b.pct}
              targetBottles={b.target}
              actualBottles={mode === "current" ? b.actual : b.target}
              actualPct={mode === "current" ? b.actualPct : b.pct}
              delta={b.delta}
              sweet={!!b.sweet}
              mode={mode}
            />
          ))}
        </div>
      </section>

      {/* Planning-mode extras */}
      {mode === "new" && (
        <>
          <section className="mb-8">
            <SectionTitle
              icon={<SlidersHorizontal className="h-4 w-4" />}
              title="Perfil Gastronômico"
              subtitle="Define a proporção-alvo entre estilos de vinho"
            />
            <div className="grid gap-2 md:grid-cols-5">
              {(Object.keys(CONCEPT_LABEL) as ConceptKey[]).map((k) => {
                const active = concept === k;
                const r = k === "Personalizado" ? customRatios : CONCEPT_PRESETS[k];
                return (
                  <button
                    key={k}
                    onClick={() => setConcept(k)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className={`text-[11px] font-semibold uppercase tracking-wide ${active ? "text-primary" : "text-muted-foreground"}`}>
                      {CONCEPT_LABEL[k]}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      B {r.white}% · T {r.red}% · E {r.sparkling}% · R {r.rose}%
                    </div>
                  </button>
                );
              })}
            </div>

            {concept === "Personalizado" && (
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Ratios personalizados</div>
                  <div className={`text-xs font-semibold ${customTotal === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                    Soma: {customTotal}% {customTotal === 100 ? "✓" : "(precisa ser 100%)"}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  {(["white", "red", "sparkling", "rose"] as const).map((k) => (
                    <label key={k} className="rounded-lg border border-border bg-background/40 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {k === "white" ? "Brancos" : k === "red" ? "Tintos" : k === "sparkling" ? "Espumantes" : "Rosés"}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={0} max={100}
                          value={customRatios[k]}
                          onChange={(e) => setCustomRatios({ ...customRatios, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-base font-semibold text-foreground focus:border-primary focus:outline-none"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="mb-8">
            <SectionTitle
              icon={<Layers className="h-4 w-4" />}
              title="Matriz de Compras"
              subtitle="Garrafas por faixa de preço × estilo de vinho"
            />
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Faixa</th>
                    <th className="px-3 py-3 text-left font-semibold">Intervalo (R$)</th>
                    <th className="px-3 py-3 text-center font-semibold">Espumante</th>
                    <th className="px-3 py-3 text-center font-semibold">Branco</th>
                    <th className="px-3 py-3 text-center font-semibold">Rosé</th>
                    <th className="px-3 py-3 text-center font-semibold">Tinto</th>
                    <th className="px-3 py-3 text-center font-semibold text-primary">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(({ b, sparkling, white, rose, red }) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-foreground">{b.name}</div>
                        <div className="text-[10px] text-muted-foreground">{b.mult} · Meta {b.pct}%</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {fmtBRL(b.min)} {b.max === Infinity ? "+" : `– ${fmtBRL(b.max)}`}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold">{sparkling}</td>
                      <td className="px-3 py-3 text-center font-semibold">{white}</td>
                      <td className="px-3 py-3 text-center font-semibold">{rose}</td>
                      <td className="px-3 py-3 text-center font-semibold">{red}</td>
                      <td className="px-3 py-3 text-center font-semibold text-primary">{b.target}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-background/40">
                    <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={2}>Total geral</td>
                    <td className="px-3 py-3 text-center text-primary">{matrix.reduce((a, m) => a + m.sparkling, 0)}</td>
                    <td className="px-3 py-3 text-center text-primary">{matrix.reduce((a, m) => a + m.white, 0)}</td>
                    <td className="px-3 py-3 text-center text-primary">{matrix.reduce((a, m) => a + m.rose, 0)}</td>
                    <td className="px-3 py-3 text-center text-primary">{matrix.reduce((a, m) => a + m.red, 0)}</td>
                    <td className="px-3 py-3 text-center text-primary font-semibold">{matrix.reduce((a, m) => a + m.b.target, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Current-mode: style breakdown */}
      {mode === "current" && totalActual > 0 && (
        <section className="mb-8">
          <SectionTitle
            icon={<Info className="h-4 w-4" />}
            title="Distribuição atual por estilo"
            subtitle="Composição da carta hoje"
          />
          <div className="grid gap-3 md:grid-cols-4">
            {(["Espumante", "Branco", "Rosé", "Tinto"] as const).map((style) => {
              const count = activeWines.filter((w) => normType(w.wine_type) === style).length;
              const pct = totalActual > 0 ? (count / totalActual) * 100 : 0;
              return (
                <div key={style} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{style}</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-primary">{pct.toFixed(0)}%</span>
                    <span className="text-xs text-muted-foreground">{count} rótulos</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: "linear-gradient(90deg, var(--gold), var(--wine))" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Current-mode: price simulator */}
      {mode === "current" && totalActual > 0 && (
        <section className="mb-8">
          <SectionTitle
            icon={<SlidersHorizontal className="h-4 w-4" />}
            title="Simulador de preços"
            subtitle="Ajuste os preços e veja o impacto na distribuição Ideal vs Atual"
          />

{/* Live redistribution monitor — compact, stays pinned */}
<div className="sticky top-0 z-30 mb-4 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur">
  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Redistribuição em tempo real</div>
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-muted-foreground/50" /> Atual</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--gold)" }} /> Simulado</span>
        <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-rose-500" /> Ideal</span>
      </div>
    </div>
    <button
      onClick={() => setSimBracketFilter("all")}
      className={`text-[9px] font-semibold uppercase tracking-wide transition ${simBracketFilter === "all" ? "text-muted-foreground/30" : "text-primary hover:text-primary/80"}`}
      disabled={simBracketFilter === "all"}
    >
      Limpar filtro de faixa
    </button>
  </div>

  <div className="grid grid-cols-5 gap-2">
    {simulation.rows.map((r) => {
      const maxVal = Math.max(r.actual, r.simulated, r.target, 1);
      const selected = simBracketFilter === r.id;
      return (
        <button
          key={r.id}
          onClick={() => setSimBracketFilter(selected ? "all" : r.id)}
          title={`Filtrar rótulos da faixa ${r.name}`}
          className={`rounded-xl border p-2 text-left transition ${selected ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:border-primary/40"}`}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="truncate text-[10px] font-semibold text-foreground">{r.name}</div>
            {selected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          </div>
          <div className="text-[9px] text-muted-foreground">{fmtBRL(r.min)} {r.max === Infinity ? "+" : `– ${fmtBRL(r.max)}`}</div>

          <div className="mt-1.5 space-y-1">
            <div className="h-1 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, (r.target / maxVal) * 100)}%` }} />
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-muted-foreground/50" style={{ width: `${Math.min(100, (r.actual / maxVal) * 100)}%` }} />
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (r.simulated / maxVal) * 100)}%`, background: "var(--gold)" }} />
            </div>
          </div>

          <div className="mt-1.5 flex items-baseline gap-1 text-[10px]">
            <span className="font-bold text-primary">{r.simulated}</span>
            <span className="text-[9px] text-muted-foreground">/ {r.target}</span>
          </div>
          <div className="text-[9px]">
            {r.simGap === 0 ? (
              <span className="font-semibold text-emerald-400">no alvo</span>
            ) : (
              <span className={r.simGap > 0 ? "text-primary" : "text-rose-400"}>
                {r.simGap > 0 ? `faltam ${r.simGap}` : `excesso ${Math.abs(r.simGap)}`}
              </span>
            )}
          </div>
        </button>
      );
    })}
  </div>

  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[11px]">
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-muted-foreground">
        Ticket médio atual <b className="ml-1 text-foreground">{fmtBRL(simulation.avgCurrent)}</b>
      </span>
      <span className="text-muted-foreground">
        Simulado <b className="ml-1 text-primary">{fmtBRL(simulation.avgSimulated)}</b>
      </span>
      <span className={`font-semibold ${simulation.avgSimulated >= simulation.avgCurrent ? "text-emerald-400" : "text-rose-400"}`}>
        {simulation.avgSimulated >= simulation.avgCurrent ? "+" : "−"}
        {fmtBRL(Math.abs(simulation.avgSimulated - simulation.avgCurrent))}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">{Object.keys(simPrices).length} rótulo(s) simulado(s)</span>
      <button
        onClick={() => setSimPrices({})}
        disabled={Object.keys(simPrices).length === 0}
        className="rounded-lg border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-40"
      >
        Limpar
      </button>
    </div>
  </div>

  {/* Save / open simulations */}
  <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
    <div className="grid gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {simId ? "Editando simulação salva" : "Nova simulação"}
      </span>
      <input
        value={simName}
        onChange={(e) => setSimName(e.target.value)}
        placeholder="Nome da simulação (ex.: Reajuste out/2026)"
        className="w-[220px] rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
      />
    </div>
    <button
      onClick={() => saveSimulation.mutate()}
      disabled={saveSimulation.isPending || !restaurantId || Object.keys(simPrices).length === 0}
      className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
    >
      <Save className="h-3 w-3" /> {simId ? "Salvar alterações" : "Salvar"}
    </button>
    <button
      onClick={newSimulation}
      className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    >
      Nova
    </button>

    {savedSims.length > 0 && (
      <div className="ml-auto grid gap-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Simulações salvas</span>
        <div className="flex items-center gap-1.5">
          <select
            value={simId ?? ""}
            onChange={(e) => (e.target.value ? openSimulation(e.target.value) : newSimulation())}
            className="w-[220px] rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">Abrir simulação salva…</option>
            {savedSims.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {new Date(s.updated_at).toLocaleDateString("pt-BR")}
              </option>
            ))}
          </select>
          {simId && (
            <button
              onClick={() => { if (confirm("Excluir esta simulação salva?")) deleteSimulation.mutate(simId); }}
              className="rounded-lg border border-rose-500/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-400 transition hover:bg-rose-500/10"
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    )}
  </div>
</div>
          {/* Per-wine simulation */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="overflow-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left">Rótulo</th>
                    <th className="px-3 py-3 text-left">Faixa atual</th>
                    <th className="px-3 py-3 text-right">Preço atual</th>
                    <th className="px-3 py-3 text-center">Nova simulação (R$)</th>
                    <th className="px-3 py-3 text-center">Preço de mercado sugerido</th>
                    <th className="px-3 py-3 text-left">Faixa simulada</th>
                    <th className="px-3 py-3 text-right">Variação</th>
                  </tr>
                  <tr className="border-b border-border bg-background/40">
                    <th className="px-4 py-2">
                      <input
                        value={simSearch}
                        onChange={(e) => setSimSearch(e.target.value)}
                        placeholder="Filtrar nome…"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none"
                      />
                    </th>
                    <th className="px-3 py-2">
                      <select
                        value={simBracketFilter}
                        onChange={(e) => setSimBracketFilter(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="all">Todas as faixas</option>
                        {brackets.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-2">
                      <select
                        value={simTypeFilter}
                        onChange={(e) => setSimTypeFilter(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="all">Todos os tipos</option>
                        {["Tinto", "Branco", "Rosé", "Espumante", "Outro"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-2 text-center">
                      <button
                        onClick={() => setSimChangedOnly((v) => !v)}
                        className={`rounded-md border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${simChangedOnly ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        Só simulados
                      </button>
                    </th>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setSimSearch(""); setSimBracketFilter("all"); setSimTypeFilter("all"); setSimChangedOnly(false); }}
                        className="rounded-md border border-border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
                      >
                        Limpar filtros
                      </button>
                    </th>
                  </tr>

                </thead>
                <tbody>
                  {simulation.wineRows.map((w) => (
                    <tr key={w.id} className="border-b border-border/60">
                      <td className="px-4 py-2.5">
                        <Link
                          to="/app/wines"
                          search={{ wine: w.id }}
                          className="text-xs font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
                          title="Abrir cadastro do rótulo"
                        >
                          {w.name}
                        </Link>
                        <div className="text-[10px] text-muted-foreground">{normType(w.wine_type)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{w.currentBracket}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{fmtBRL(w.currentPrice)}</td>
                      <td className="px-3 py-2.5">
                        <div className="mx-auto flex w-[150px] items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 focus-within:border-primary">
                          <span className="text-[11px] text-primary">R$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={simPrices[w.id] != null ? String(simPrices[w.id]) : ""}
                            placeholder="—"
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, "");
                              setSimPrices((prev) => {
                                const next = { ...prev };
                                if (raw === "") delete next[w.id];
                                else next[w.id] = Number(raw);
                                return next;
                              });
                            }}
                            className="w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <MarketPriceCell
                          key={`${w.id}-${w.marketPrice ?? "none"}`}
                          value={w.marketPrice}
                          fromCatalog={w.marketFromCatalog}
                          onSave={(v) => saveMarketPrice.mutate({ wineId: w.id, value: v })}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-[11px]">
                        <span className={w.changed ? "font-semibold text-primary" : "text-muted-foreground"}>
                          {w.simBracket}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        {w.changed ? (
                          <span className={`font-semibold ${w.diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {w.diff >= 0 ? "+" : "−"}{fmtBRL(Math.abs(w.diff))}{" "}
                            <span className="text-[10px] text-muted-foreground">
                              ({w.diff >= 0 ? "+" : "−"}{Math.abs(w.diffPct).toFixed(0)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
              A simulação é apenas um estudo — nenhum preço do cadastro é alterado.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}


function ControlCard({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2">{children}</div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
      <div className="text-primary">{icon}</div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
        {subtitle && <div className="text-sm font-semibold text-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

function BracketCard({
  name, mult, min, max, targetPct, targetBottles, actualBottles, actualPct, delta, sweet, mode,
}: {
  name: string; mult: string; min: number; max: number;
  targetPct: number; targetBottles: number;
  actualBottles: number; actualPct: number; delta: number;
  sweet: boolean; mode: "current" | "new";
}) {
  const showSuggestion = mode === "current";
  const balanced = Math.abs(delta) <= Math.max(1, Math.round(targetBottles * 0.1));

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-4 transition ${
        sweet ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      {sweet && (
        <div className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
          Sweet Spot
        </div>
      )}

      <div className={`text-sm font-semibold ${sweet ? "text-primary" : "text-foreground"}`}>{name}</div>

      <div className="mt-3 text-xs text-muted-foreground">Intervalo</div>
      <div className="text-sm font-semibold text-foreground">
        {fmtBRL(min)} {max === Infinity ? "+" : `– ${fmtBRL(max)}`}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-border bg-background/40 px-2 py-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Ideal</div>
          <div className="text-sm font-semibold text-foreground">{targetPct}%</div>
          <div className="text-[10px] text-muted-foreground">{targetBottles} rótulos</div>
        </div>
        <div className={`rounded-lg border px-2 py-1.5 ${sweet ? "border-primary/40 bg-primary/10" : "border-border bg-background/40"}`}>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{mode === "current" ? "Atual" : "Planejado"}</div>
          <div className={`text-sm font-semibold ${sweet ? "text-primary" : "text-foreground"}`}>{actualPct.toFixed(0)}%</div>
          <div className="text-[10px] text-muted-foreground">{actualBottles} rótulos</div>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, actualPct * (100 / Math.max(targetPct, 1)))}%`,
            background: sweet
              ? "linear-gradient(90deg, var(--gold), var(--wine))"
              : "color-mix(in oklab, var(--muted-foreground) 55%, transparent)",
          }}
        />
      </div>

      {showSuggestion && (
        <div className="mt-3">
          {balanced ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Distribuição equilibrada
            </div>
          ) : delta > 0 ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5 text-[11px] font-semibold text-primary">
              <ArrowUpRight className="h-3.5 w-3.5" /> Adicionar +{delta} rótulo{delta > 1 ? "s" : ""}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] font-semibold text-rose-400">
              <ArrowDownRight className="h-3.5 w-3.5" /> Reduzir {delta} rótulo{Math.abs(delta) > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MarketPriceCell({
  value, fromCatalog, onSave,
}: {
  value: number | null;
  fromCatalog: boolean;
  onSave: (v: number | null) => void;
}) {
  const [text, setText] = useState(value != null ? String(Math.round(value)) : "");

  const commit = () => {
    const raw = text.replace(/[^\d]/g, "");
    const next = raw === "" ? null : Number(raw);
    if (next !== (value != null ? Math.round(value) : null)) onSave(next);
  };

  return (
    <div className="mx-auto w-[150px]">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 focus-within:border-primary">
        <span className="text-[11px] text-muted-foreground">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          placeholder="—"
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none"
          title="Preço de mercado sugerido (catálogo global aprovado ou informado por você)"
        />
      </div>
      <div className="mt-0.5 text-center text-[9px] text-muted-foreground">
        {value == null ? "informe" : fromCatalog ? "catálogo global" : "informado"}
      </div>
    </div>
  );
}
