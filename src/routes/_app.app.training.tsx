import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, Sparkles, Save, Eye, KeyRound, Trophy, ChevronDown, Info, Search } from "lucide-react";
import ModuleGate from "@/components/ModuleGate";
import StoryCard from "@/components/training/StoryCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  generateTrainingCards,
  saveTrainingCard,
  setTrainingCardsStatus,
} from "@/lib/training-cards.functions";

export const Route = createFileRoute("/_app/app/training")({
  head: () => ({
    meta: [
      { title: "Treinamento do staff — Fichas rápidas dos rótulos" },
      {
        name: "description",
        content:
          "Fichas rápidas de cada rótulo da carta para a equipe estudar pelo celular: história, significado do nome, uvas, como é feito e frase de venda.",
      },
      { property: "og:title", content: "Treinamento do staff — Fichas rápidas dos rótulos" },
      {
        property: "og:description",
        content: "Fichas de bolso dos rótulos para a equipe do salão vender melhor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModuleGate route="/app/training">
      <TrainingPage />
    </ModuleGate>
  ),
});

type WineRow = {
  id: string;
  name: string;
  internal_code: string | null;
  style: string | null;
  wine_type: string | null;
  country: string | null;
  region: string | null;
  producer: string | null;
  vintage: number | null;
  volume: string | null;
  image_url: string | null;
  sale_price: number | null;
};

type CardRow = {
  wine_id: string;
  status: string;
  compact_summary: string | null;
  grapes_line: string | null;
  making_line: string | null;
  origin_story: string | null;
  name_meaning: string | null;
  mouthfeel: string | null;
  pairings: string[] | null;
  sales_pitch: string | null;
  fun_fact: string | null;
  do_not_confuse: string | null;
  video_status: string;
  video_published: boolean;
};

type StatusFilter = "all" | "published" | "draft" | "missing";

const EMPTY = {
  compact_summary: "",
  grapes_line: "",
  making_line: "",
  origin_story: "",
  name_meaning: "",
  mouthfeel: "",
  pairings: [] as string[],
  sales_pitch: "",
  fun_fact: "",
  do_not_confuse: "",
};

function TrainingPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [nameFilter, setNameFilter] = useState("");

  const { data: wines = [], isLoading } = useQuery({
    queryKey: ["training-wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("id, name, internal_code, style, wine_type, region, country, producer, vintage, volume, image_url, sale_price")
        .eq("restaurant_id", restaurantId)
        .eq("active_on_menu", true)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as WineRow[];
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["training-cards", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wine_story_cards")
        .select(
          "wine_id, status, compact_summary, grapes_line, making_line, origin_story, name_meaning, mouthfeel, pairings, sales_pitch, fun_fact, do_not_confuse, video_status, video_published",
        )
        .eq("restaurant_id", restaurantId);
      if (error) throw new Error(error.message);
      return (data ?? []) as CardRow[];
    },
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["training-attempts", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("training_quiz_attempts")
        .select("id, score, total, finished_at")
        .eq("restaurant_id", restaurantId)
        .order("finished_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const byWine = useMemo(() => new Map(cards.map((c) => [c.wine_id, c])), [cards]);
  const published = cards.filter((c) => c.status === "published").length;
  const editingWine = wines.find((w) => w.id === editing) ?? null;
  const typeOptions = useMemo(() => {
    const names = new Set(wines.map((w) => w.style || w.wine_type).filter(Boolean) as string[]);
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [wines]);
  const filteredWines = useMemo(() => {
    const query = nameFilter.trim().toLocaleLowerCase("pt-BR");
    return wines.filter((w) => {
      const card = byWine.get(w.id);
      const type = w.style || w.wine_type || "";
      const matchesType = typeFilter === "all" || type === typeFilter;
      const matchesName =
        !query ||
        [w.name, w.internal_code, w.country, w.volume]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "missing" && !card) ||
        (statusFilter === "published" && card?.status === "published") ||
        (statusFilter === "draft" && card?.status !== "published" && !!card);
      return matchesType && matchesName && matchesStatus;
    });
  }, [byWine, nameFilter, statusFilter, typeFilter, wines]);
  const allFilteredSelected =
    filteredWines.length > 0 && filteredWines.every((w) => selected.includes(w.id));

  function openEditor(wineId: string) {
    const c = byWine.get(wineId);
    setEditing(wineId);
    setDraft({
      compact_summary: c?.compact_summary ?? "",
      grapes_line: c?.grapes_line ?? "",
      making_line: c?.making_line ?? "",
      origin_story: c?.origin_story ?? "",
      name_meaning: c?.name_meaning ?? "",
      mouthfeel: c?.mouthfeel ?? "",
      pairings: c?.pairings ?? [],
      sales_pitch: c?.sales_pitch ?? "",
      fun_fact: c?.fun_fact ?? "",
      do_not_confuse: c?.do_not_confuse ?? "",
    });
  }

  async function handleGenerate(ids: string[]) {
    if (!restaurantId || !ids.length) return;
    setBusy(true);
    try {
      const res = await generateTrainingCards({
        data: { restaurant_id: restaurantId, wine_ids: ids.slice(0, 12) },
      });
      if (res.saved) toast.success(`${res.saved} ficha(s) criada(s) como rascunho.`);
      res.failures.forEach((f) => toast.error(f));
      await qc.invalidateQueries({ queryKey: ["training-cards", restaurantId] });
      if (editing && ids.includes(editing)) {
        const { data } = await supabase
          .from("wine_story_cards")
          .select(
            "wine_id, status, compact_summary, grapes_line, making_line, origin_story, name_meaning, mouthfeel, pairings, sales_pitch, fun_fact, do_not_confuse, video_status, video_published",
          )
          .eq("wine_id", editing)
          .maybeSingle();
        if (data) {
          setDraft({
            compact_summary: data.compact_summary ?? "",
            grapes_line: data.grapes_line ?? "",
            making_line: data.making_line ?? "",
            origin_story: data.origin_story ?? "",
            name_meaning: data.name_meaning ?? "",
            mouthfeel: data.mouthfeel ?? "",
            pairings: data.pairings ?? [],
            sales_pitch: data.sales_pitch ?? "",
            fun_fact: data.fun_fact ?? "",
            do_not_confuse: data.do_not_confuse ?? "",
          });
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar as fichas agora.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(status: "draft" | "published") {
    if (!restaurantId || !editing) return;
    setBusy(true);
    try {
      await saveTrainingCard({
        data: {
          restaurant_id: restaurantId,
          wine_id: editing,
          status,
          ...draft,
          pairings: draft.pairings.filter((p) => p.trim()).slice(0, 5),
        },
      });
      toast.success(status === "published" ? "Ficha publicada para a equipe." : "Rascunho salvo.");
      await qc.invalidateQueries({ queryKey: ["training-cards", restaurantId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a ficha.");
    } finally {
      setBusy(false);
    }
  }

  async function publishSelected() {
    if (!restaurantId || !selected.length) return;
    setBusy(true);
    try {
      await setTrainingCardsStatus({
        data: { restaurant_id: restaurantId, wine_ids: selected, status: "published" },
      });
      toast.success("Fichas publicadas.");
      await qc.invalidateQueries({ queryKey: ["training-cards", restaurantId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="page-title flex items-center gap-2 text-primary">
          <GraduationCap className="h-5 w-5" /> Treinamento do staff
        </h1>
        <Link
          to="/app/access-links"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:bg-accent"
        >
          <KeyRound className="h-3.5 w-3.5" /> Criar link para a equipe
        </Link>
      </header>

      <div className="text-sm text-muted-foreground">
        <span className="text-primary">{published}</span> de {wines.length} fichas publicadas.
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          onClick={() => handleGenerate(selected)}
          disabled={busy || !selected.length}
          size="sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {busy ? "Gerando..." : `Gerar fichas (${selected.length})`}
        </Button>
        <Button
          onClick={publishSelected}
          disabled={busy || !selected.length}
          variant="outline"
          size="sm"
          className="text-primary"
        >
          <Eye className="h-3.5 w-3.5" /> Publicar selecionadas
        </Button>
        <Button
          onClick={() =>
            setSelected(allFilteredSelected ? [] : filteredWines.map((w) => w.id))
          }
          variant="outline"
          size="sm"
          className="text-muted-foreground"
        >
          {allFilteredSelected ? "Limpar seleção" : "Selecionar filtrados"}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
              Rótulos da carta
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 rounded-full text-primary"
                      aria-label="Informações sobre as fichas"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs leading-relaxed" side="right">
                    Uma ficha de bolso por rótulo: uvas, como é feito, de onde vem, o significado do nome,
                    com o que combina e a frase pronta para dizer na mesa. Gere com a ajuda da inteligência
                    artificial, ajuste o texto e publique.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {filteredWines.length} de {wines.length}
            </span>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_0.85fr_0.8fr]">
            <label className="relative block text-[11px] uppercase tracking-wider text-muted-foreground">
              Nome
              <Search className="pointer-events-none absolute bottom-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Buscar rótulo ou código"
                className="mt-1 pl-8 text-sm"
              />
            </label>
            <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">
              Tipo
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {typeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">
              Status
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="published">Publicada</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="missing">Sem ficha</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {filteredWines.map((w) => {
                const c = byWine.get(w.id);
                const state = !c ? "Sem ficha" : c.status === "published" ? "Publicada" : "Rascunho";
                const details = [w.style || w.wine_type, w.country, w.volume].filter(Boolean).join(" · ");
                return (
                  <li key={w.id} className="flex items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(w.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, w.id] : s.filter((x) => x !== w.id),
                        )
                      }
                      className="h-4 w-4 accent-[var(--gold)]"
                    />
                    <button
                      onClick={() => openEditor(w.id)}
                      className="min-w-0 flex-1 text-left text-sm text-foreground hover:text-primary"
                    >
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                        {w.internal_code ? (
                          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-primary">
                            {w.internal_code}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 font-medium">{w.name}</span>
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {details || "Sem tipo, país ou volume informados"}
                      </span>
                    </button>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                        state === "Publicada"
                          ? "border-primary/50 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {state}
                    </span>
                    {c?.video_published ? <span className="text-[10px] text-primary">Vídeo</span> : null}
                  </li>
                );
              })}
              {filteredWines.length === 0 ? (
                <li className="py-5 text-center text-sm text-muted-foreground">
                  Nenhum rótulo encontrado com estes filtros.
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {editingWine ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Ficha de {editingWine.name}
              </div>
              <div className="mt-3 space-y-2">
                <label className="block text-[11px] font-semibold text-primary">
                  Resumo para apresentar ao cliente
                  <textarea
                    value={draft.compact_summary}
                    onChange={(e) => setDraft((d) => ({ ...d, compact_summary: e.target.value }))}
                    rows={4}
                    maxLength={900}
                    className="mt-1 w-full rounded-md border border-primary/50 bg-background p-2 text-base leading-relaxed text-foreground"
                  />
                </label>
                <details className="rounded-md border border-border p-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Informações complementares <ChevronDown className="h-4 w-4" />
                  </summary>
                  <div className="mt-3 space-y-2">
                {(
                  [
                    ["grapes_line", "Uvas"],
                    ["making_line", "Como é feito (método ou madeira)"],
                    ["origin_story", "De onde vem"],
                    ["name_meaning", "Por que esse nome"],
                    ["mouthfeel", "Como é na boca"],
                    ["sales_pitch", "Fale assim na mesa"],
                    ["fun_fact", "Curiosidade"],
                    ["do_not_confuse", "Não confunda"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-[11px] text-muted-foreground">
                    {label}
                    <textarea
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      rows={key === "origin_story" || key === "name_meaning" ? 3 : 2}
                      className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
                    />
                  </label>
                ))}
                <label className="block text-[11px] text-muted-foreground">
                  Combina com (um prato por linha)
                  <textarea
                    value={draft.pairings.join("\n")}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, pairings: e.target.value.split("\n") }))
                    }
                    rows={3}
                    className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
                  />
                </label>
                  </div>
                </details>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleGenerate([editingWine.id])}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:bg-accent disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
                </button>
                <button
                  onClick={() => handleSave("draft")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" /> Salvar rascunho
                </button>
                <button
                  onClick={() => handleSave("published")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  <Eye className="h-3.5 w-3.5" /> Publicar
                </button>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                  Como a equipe vê
                </div>
                <div className="mx-auto h-[min(680px,70vh)] max-w-[360px]">
                  <StoryCard card={{ ...editingWine, ...draft }} />
                </div>
              </div>

            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Toque em um rótulo da lista para criar ou ajustar a ficha.
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              <Trophy className="h-3.5 w-3.5" /> Últimos desafios da equipe
            </div>
            {attempts.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhum desafio respondido ainda.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                {attempts.map((a) => (
                  <li key={a.id} className="flex justify-between">
                    <span>
                      {new Date(a.finished_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </span>
                    <span className="font-semibold text-primary">
                      {a.score}/{a.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
