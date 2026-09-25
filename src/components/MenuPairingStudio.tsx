import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  FileUp,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wine,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAccessLink } from "@/lib/access-links.functions";
import {
  extractMenuDishes,
  getMenuPairingGuide,
  pairMenuWithWineList,
  saveMenuPairingGuide,
  type DishPairing,
  type MenuDish,
  type WineLite,
} from "@/lib/menu-pairing.functions";
import { publicOrigin } from "@/lib/public-origin";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type BusyState = null | "extract" | "pair" | "save" | "link";
type EditablePick = DishPairing["picks"][number];

function fileToBase64(f: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function emptyPairing(dish: MenuDish): DishPairing {
  return {
    dish: dish.name,
    profile: dish.description ?? "",
    picks: [],
    gap: false,
    gap_note: null,
  };
}

function staffLinkText(url: string) {
  return [
    "Harmonizações da carta — consulta pelo celular",
    "",
    url,
    "",
    "Use este link durante o atendimento para consultar as sugestões por prato.",
  ].join("\n");
}

export function MenuPairingStudio() {
  const { restaurantId, activeGroupId } = useAuth();
  const qc = useQueryClient();
  const storeKey = restaurantId ? `menu-pairing:${restaurantId}` : null;
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [results, setResults] = useState<DishPairing[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [openPairingIndex, setOpenPairingIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingPairing, setEditingPairing] = useState<DishPairing | null>(null);
  const [staffLink, setStaffLink] = useState<{ url: string; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractMenuDishes);
  const pair = useServerFn(pairMenuWithWineList);
  const getGuide = useServerFn(getMenuPairingGuide);
  const saveGuide = useServerFn(saveMenuPairingGuide);
  const makeLink = useServerFn(createAccessLink);

  const { data: wineCount, isLoading } = useQuery({
    queryKey: ["menu-pairing-wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) return 0;
      const { count } = await supabase
        .from("wines")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("active_on_menu", true);
      return count ?? 0;
    },
  });

  const { data: wineOptions = [] } = useQuery({
    queryKey: ["menu-pairing-wine-options", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) return [] as WineLite[];
      const { data, error } = await supabase
        .from("wines")
        .select("id, name, producer, wine_type, country, volume, sale_price, internal_code")
        .eq("restaurant_id", restaurantId)
        .eq("active_on_menu", true)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        producer: w.producer,
        wine_type: w.wine_type,
        country: w.country,
        volume: w.volume,
        sale_price: Number(w.sale_price ?? 0),
        internal_code: w.internal_code,
      })) satisfies WineLite[];
    },
  });

  const WINE_GROUP_ORDER = ["Espumantes", "Brancos", "Rosés", "Tintos", "Fortificados"] as const;

  function wineGroupLabel(raw: string | null): string {
    const t = (raw ?? "").trim().toLowerCase();
    if (/espuma|sparkl|champ|cava|prosecc|frizz|moscat/i.test(t) && !/tinto/.test(t)) return "Espumantes";
    if (/branc|white|chard|sauvignon|riesling|pinot gris|grüner|glera|albari|gewürz|chenin|viogn|gree?n?g?o|arneis|verdejo|verdelho/i.test(t))
      return "Brancos";
    if (/rosé|rosado|clarete|blush/i.test(t)) return "Rosés";
    if (/tinto|red|tannat|cabernet|merlot|malbec|syrah|shiraz|pinot noir|grenache|garnacha|tempranill|nebbiolo|sangiovese|barbera|zinfandel|petit verdot|carmén?è?re|alicante|bordeaux|blend/i.test(t))
      return "Tintos";
    if (/fortific|port|jerez|sherry|madeira|vermouth|oporto|moscatel de setúbal|pedro ximénez/i.test(t)) return "Fortificados";
    return raw?.trim() ? raw.trim() : "Outros";
  }

  const groupedWineOptions = useMemo(() => {
    const groups = new Map<string, WineLite[]>();
    for (const w of wineOptions) {
      const label = wineGroupLabel(w.wine_type);
      const arr = groups.get(label) ?? [];
      arr.push(w);
      groups.set(label, arr);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => {
        const ia = WINE_GROUP_ORDER.indexOf(a as (typeof WINE_GROUP_ORDER)[number]);
        const ib = WINE_GROUP_ORDER.indexOf(b as (typeof WINE_GROUP_ORDER)[number]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
      })
      .map(([label, wines]) => ({ label, wines }));
  }, [wineOptions]);

  const { data: savedGuide } = useQuery({
    queryKey: ["menu-pairing-guide", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) return null;
      return getGuide({ data: { restaurantId } });
    },
  });

  useEffect(() => {
    if (!storeKey) return;
    if (savedGuide?.dishes?.length || savedGuide?.results?.length) {
      setDishes(savedGuide.dishes ?? []);
      setResults(savedGuide.results ?? []);
      return;
    }
    try {
      const s = JSON.parse(localStorage.getItem(storeKey) || "null");
      setDishes(s?.dishes ?? []);
      setResults(s?.results ?? []);
    } catch {
      /* ignore */
    }
  }, [storeKey, savedGuide]);

  useEffect(() => {
    if (storeKey) localStorage.setItem(storeKey, JSON.stringify({ dishes, results }));
  }, [storeKey, dishes, results]);

  const gaps = useMemo(() => results.filter((r) => r.gap), [results]);
  const openDish = openPairingIndex === null ? null : dishes[openPairingIndex] ?? null;
  const openPairing = openDish && openPairingIndex !== null ? findPairing(openDish, openPairingIndex) : null;
  const publishedDate = savedGuide?.published_at ? new Date(savedGuide.published_at).toLocaleString("pt-BR") : null;

  if (activeGroupId || !restaurantId)
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Selecione uma unidade específica no seletor de restaurantes para harmonizar com a carta dela.
      </div>
    );

  function addFromText() {
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 3);
    if (!lines.length) return;
    setDishes((d) => [
      ...d,
      ...lines.map((l) => {
        const [name, ...rest] = l.split(/\s[-–—:]\s/);
        return { name: name.trim(), description: rest.join(" - ").trim() || null, section: null };
      }),
    ]);
    setText("");
  }

  async function onFile(f: File) {
    setBusy("extract");
    try {
      const b64 = await fileToBase64(f);
      const found = await extract({ data: { fileBase64: b64, mimeType: f.type || "application/pdf" } });
      if (!found?.length) toast.error("Nenhum prato encontrado no arquivo.");
      else {
        setDishes((d) => [...d, ...found]);
        toast.success(`${found.length} pratos lidos do cardápio.`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível ler o cardápio.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onUrl() {
    const u = url.trim();
    if (!u) return;
    setBusy("extract");
    try {
      const found = await extract({ data: { url: /^https?:\/\//i.test(u) ? u : `https://${u}` } });
      if (!found?.length) toast.error("Nenhum prato encontrado neste link.");
      else {
        setDishes((d) => [...d, ...found]);
        setUrl("");
        toast.success(`${found.length} pratos lidos do link.`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível ler o link.");
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    if (!dishes.length || !restaurantId) return;
    setBusy("pair");
    setOpenPairingIndex(null);
    try {
      const out: DishPairing[] = [];
      for (let i = 0; i < dishes.length; i += 12) {
        const r = await pair({ data: { restaurantId, dishes: dishes.slice(i, i + 12) } });
        out.push(...r);
      }
      setResults(out);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível harmonizar.");
    } finally {
      setBusy(null);
    }
  }

  async function publishForStaff() {
    if (!restaurantId) return;
    if (!dishes.length || !results.length) {
      toast.error("Gere ou ajuste as harmonizações antes de publicar para o staff.");
      return;
    }
    setBusy("save");
    try {
      await saveGuide({ data: { restaurantId, title: "Harmonizações do cardápio", dishes, results } });
      await qc.invalidateQueries({ queryKey: ["menu-pairing-guide", restaurantId] });
      toast.success("Harmonizações publicadas para o staff.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível publicar para o staff.");
    } finally {
      setBusy(null);
    }
  }

  async function createStaffLink() {
    if (!restaurantId) return;
    if (!results.length) {
      toast.error("Publique as harmonizações antes de gerar o link.");
      return;
    }
    setBusy("link");
    try {
      await saveGuide({ data: { restaurantId, title: "Harmonizações do cardápio", dishes, results } });
      const res = await makeLink({
        data: {
          restaurant_id: restaurantId,
          label: "Staff — harmonizações no celular",
          scope: "pairings",
          device_kind: "mobile",
          single_device: false,
          days: 0,
        },
      });
      const linkUrl = `${publicOrigin()}/acesso/harmonizacoes/${res.token}`;
      setStaffLink({ url: linkUrl, text: staffLinkText(linkUrl) });
      await qc.invalidateQueries({ queryKey: ["access-links"] });
      await qc.invalidateQueries({ queryKey: ["menu-pairing-guide", restaurantId] });
      toast.success("Link mobile criado para o staff.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível criar o link do staff.");
    } finally {
      setBusy(null);
    }
  }

  function removeDish(index: number) {
    const dish = dishes[index];
    setDishes((x) => x.filter((_, j) => j !== index));
    setResults((x) => x.filter((r, j) => j !== index && (!dish || r.dish !== dish.name)));
    if (openPairingIndex === index) setOpenPairingIndex(null);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingPairing(null);
    }
  }

  function findPairing(dish: MenuDish, index: number) {
    const byPosition = results[index];
    if (byPosition?.dish.trim().toLocaleLowerCase("pt-BR") === dish.name.trim().toLocaleLowerCase("pt-BR")) {
      return byPosition;
    }
    return results.find((r) => normalizeKey(r.dish) === normalizeKey(dish.name)) ?? null;
  }

  function openEdit(dish: MenuDish, index: number) {
    setOpenPairingIndex(null);
    setEditingIndex(index);
    setEditingPairing(findPairing(dish, index) ?? emptyPairing(dish));
  }

  function applyManualPairing() {
    if (editingIndex === null || !editingPairing) return;
    const editingDish = dishes[editingIndex];
    const cleaned: DishPairing = {
      ...editingPairing,
      dish: editingPairing.dish.trim() || editingDish?.name || "Prato",
      profile: editingPairing.profile.trim(),
      gap_note: editingPairing.gap ? editingPairing.gap_note?.trim() || "A carta precisa de um estilo mais adequado para este prato." : null,
      picks: editingPairing.picks.filter((p) => p.wine_id && p.wine),
    };
    setResults((current) => {
      const next = [...current];
      const idx = next.findIndex((r, j) => j === editingIndex || normalizeKey(r.dish) === normalizeKey(cleaned.dish));
      if (idx >= 0) next[idx] = cleaned;
      else next[editingIndex] = cleaned;
      return next;
    });
    setEditingIndex(null);
    setEditingPairing(null);
    toast.success("Harmonização ajustada.");
  }

  function updatePick(index: number, patch: Partial<EditablePick>) {
    setEditingPairing((current) => {
      if (!current) return current;
      const picks = [...current.picks];
      const prev = picks[index];
      if (!prev) return current;
      picks[index] = { ...prev, ...patch };
      return { ...current, picks };
    });
  }

  function selectWine(index: number, wineId: string) {
    const wine = wineOptions.find((w) => w.id === wineId);
    if (!wine) return;
    updatePick(index, { wine_id: wine.id, wine });
  }

  function addPick() {
    const wine = wineOptions[0];
    if (!wine) return;
    setEditingPairing((current) => {
      if (!current || current.picks.length >= 3) return current;
      return {
        ...current,
        picks: [
          ...current.picks,
          {
            wine_id: wine.id,
            wine,
            score: 8,
            reason: "",
            table_phrase: "",
          },
        ],
      };
    });
  }

  async function copy(textToCopy: string) {
    await navigator.clipboard.writeText(textToCopy);
    toast.success("Texto copiado.");
  }

  if (!isLoading && wineCount === 0)
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm">
        <div className="mb-2 font-bold text-primary">Primeiro passo: a carta de vinhos</div>
        <p className="mb-4 text-muted-foreground">
          Esta harmonização usa somente os vinhos ativos da carta do restaurante. Importe a carta para começar.
        </p>
        <a
          href="/app/wines"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase text-primary-foreground"
        >
          <Wine className="h-3 w-3" /> Importar carta de vinhos
        </a>
      </div>
    );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="section-title flex items-center justify-between">
          <span>1. Cardápio</span>
          <span className="text-[10px] font-normal normal-case text-muted-foreground">
            {wineCount ?? "…"} vinhos ativos na carta
          </span>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={"Um prato por linha. Ex.:\nPolvo grelhado - batata ao murro e páprica\nRisoto de cogumelos"}
          className="bg-background text-sm focus:border-primary"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addFromText} disabled={!text.trim()}>
            Adicionar pratos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            {busy === "extract" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
            Enviar cardápio (PDF ou foto)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onUrl()}
            placeholder="Ou cole o link do cardápio (site, PDF ou imagem)"
            className="bg-background text-sm focus:border-primary"
          />
          <Button type="button" variant="outline" size="sm" onClick={onUrl} disabled={!url.trim() || !!busy} className="shrink-0">
            {busy === "extract" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            Ler link
          </Button>
        </div>

        {!!dishes.length && (
          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {dishes.map((d, i) => {
              const pairing = findPairing(d, i);
              return (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{d.name}</div>
                    {d.description && (
                      <div className="truncate text-[11px] text-muted-foreground">{d.description}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Ver harmonização de ${d.name}`}
                      disabled={!pairing}
                      onClick={() => setOpenPairingIndex(i)}
                      className="h-7 w-7 text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar harmonização de ${d.name}`}
                      onClick={() => openEdit(d, i)}
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover prato"
                      onClick={() => removeDish(i)}
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={run} disabled={!dishes.length || !!busy} size="sm">
            {busy === "pair" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Harmonizar com a carta
          </Button>
          <Button type="button" onClick={publishForStaff} disabled={!results.length || !!busy} variant="outline" size="sm">
            {busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Publicar para staff
          </Button>
          <Button type="button" onClick={createStaffLink} disabled={!results.length || !!busy} variant="outline" size="sm">
            {busy === "link" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
            Criar link mobile
          </Button>
          {!!dishes.length && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDishes([]);
                setResults([]);
                setStaffLink(null);
              }}
            >
              Limpar
            </Button>
          )}
        </div>
        {publishedDate && (
          <p className="mt-3 text-[11px] text-muted-foreground">Última publicação para o staff: {publishedDate}</p>
        )}
        {staffLink && (
          <div className="mt-4 rounded-lg border border-primary/40 bg-background p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Link mobile do staff</div>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-foreground">{staffLink.text}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => copy(staffLink.text)}>
                <Copy className="h-3.5 w-3.5" /> Copiar texto
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => copy(staffLink.url)}>
                <Copy className="h-3.5 w-3.5" /> Copiar link
              </Button>
            </div>
          </div>
        )}
      </section>

      {busy === "pair" && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Cruzando o cardápio com a carta de vinhos...
        </div>
      )}

      {!!results.length && (
        <>
          <div className="kpi-container grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <span className="block text-[9px] uppercase text-muted-foreground">Pratos</span>
              <b className="text-primary">{results.length}</b>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <span className="block text-[9px] uppercase text-muted-foreground">Bem harmonizados</span>
              <b className="text-primary">{results.length - gaps.length}</b>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <span className="block text-[9px] uppercase text-muted-foreground">Gaps na carta</span>
              <b className="text-primary">{gaps.length}</b>
            </div>
          </div>

          {!!gaps.length && (
            <section className="rounded-xl border border-secondary bg-secondary/10 p-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                <AlertTriangle className="h-4 w-4" /> Alertas de gaps
              </div>
              <ul className="space-y-2 text-sm">
                {gaps.map((g, i) => (
                  <li key={i}>
                    <b>{g.dish}:</b> <span className="text-foreground/80">{g.gap_note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Dialog open={openPairingIndex !== null} onOpenChange={(open) => !open && setOpenPairingIndex(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border p-5 pr-12">
            <DialogTitle className="text-primary">{openPairing?.dish ?? openDish?.name ?? "Harmonização"}</DialogTitle>
            <DialogDescription>{openPairing?.profile ?? "Harmonização deste prato."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div className="flex justify-end">
              {openDish && (
                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(openDish, openPairingIndex ?? 0)}>
                  <Pencil className="h-3.5 w-3.5" /> Alterar harmonização
                </Button>
              )}
            </div>
            {openPairing?.gap && (
              <div className="rounded-lg border border-secondary bg-secondary/10 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <AlertTriangle className="h-4 w-4" /> Gap na carta
                </div>
                <p className="text-muted-foreground">{openPairing.gap_note}</p>
              </div>
            )}

            {openPairing?.picks.length ? (
              <ol className="space-y-3">
                {openPairing.picks.map((p, j) => (
                  <li key={j} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm">
                          {p.wine?.internal_code && <span className="mr-1 text-muted-foreground">{p.wine.internal_code}</span>}
                          {p.wine?.name}
                        </div>
                        <div className="text-[10px] uppercase text-muted-foreground">
                          {[p.wine?.wine_type, p.wine?.country, p.wine?.volume].filter(Boolean).join(" · ")}
                          {p.wine ? ` · ${brl(p.wine.sale_price)}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 rounded border border-primary/60 px-1.5 text-[11px] font-bold text-primary">
                        {p.score}/10
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-foreground/80">{p.reason}</p>
                    <p className="mt-1 text-[12px] italic text-primary/90">“{p.table_phrase}”</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum rótulo da carta indicado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingPairing}
        onOpenChange={(open) => {
          if (!open) {
            setEditingIndex(null);
            setEditingPairing(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border p-5 pr-12">
            <DialogTitle className="text-primary">Alterar harmonização</DialogTitle>
            <DialogDescription>{editingPairing?.dish ?? "Ajuste a sugestão que a equipe verá no celular."}</DialogDescription>
          </DialogHeader>
          {editingPairing && (
            <div className="space-y-4 p-5">
              <label className="block text-xs text-muted-foreground">
                Perfil do prato
                <Textarea
                  value={editingPairing.profile}
                  onChange={(e) => setEditingPairing((p) => (p ? { ...p, profile: e.target.value } : p))}
                  rows={2}
                  className="mt-1 bg-background text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editingPairing.gap}
                  onChange={(e) => setEditingPairing((p) => (p ? { ...p, gap: e.target.checked } : p))}
                />
                Marcar como gap da carta
              </label>
              {editingPairing.gap && (
                <label className="block text-xs text-muted-foreground">
                  Alerta de gap
                  <Textarea
                    value={editingPairing.gap_note ?? ""}
                    onChange={(e) => setEditingPairing((p) => (p ? { ...p, gap_note: e.target.value } : p))}
                    rows={2}
                    className="mt-1 bg-background text-sm"
                  />
                </label>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Vinhos indicados</div>
                  <Button type="button" variant="outline" size="sm" onClick={addPick} disabled={editingPairing.picks.length >= 3 || !wineOptions.length}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar vinho
                  </Button>
                </div>
                {editingPairing.picks.map((p, j) => (
                  <div key={`${p.wine_id}-${j}`} className="rounded-lg border border-border p-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_96px_34px]">
                      <label className="text-xs text-muted-foreground">
                        Rótulo da carta
                        <select
                          value={p.wine_id}
                          onChange={(e) => selectWine(j, e.target.value)}
                          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                        >
                          {groupedWineOptions.map((g) => (
                            <optgroup key={g.label} label={g.label}>
                              {g.wines.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {[w.internal_code, w.name, w.country, w.volume].filter(Boolean).join(" · ")}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Nota
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={p.score}
                          onChange={(e) => updatePick(j, { score: Number(e.target.value) })}
                          className="mt-1 bg-background text-sm"
                        />
                      </label>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remover vinho"
                          onClick={() =>
                            setEditingPairing((current) =>
                              current ? { ...current, picks: current.picks.filter((_, idx) => idx !== j) } : current,
                            )
                          }
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <label className="mt-3 block text-xs text-muted-foreground">
                      Motivo técnico
                      <Textarea
                        value={p.reason}
                        onChange={(e) => updatePick(j, { reason: e.target.value })}
                        rows={2}
                        className="mt-1 bg-background text-sm"
                      />
                    </label>
                    <label className="mt-3 block text-xs text-muted-foreground">
                      Frase para falar na mesa
                      <Textarea
                        value={p.table_phrase}
                        onChange={(e) => updatePick(j, { table_phrase: e.target.value })}
                        rows={2}
                        className="mt-1 bg-background text-sm"
                      />
                    </label>
                  </div>
                ))}
                {!editingPairing.picks.length && (
                  <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                    Adicione até três vinhos da carta ou marque este prato como gap.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingIndex(null);
                    setEditingPairing(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={applyManualPairing}>
                  <Save className="h-4 w-4" /> Salvar alteração
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MenuPairingStudio;
