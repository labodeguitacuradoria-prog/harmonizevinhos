import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Link2, Loader2, Sparkles, Trash2, Wine } from "lucide-react";
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
import {
  extractMenuDishes,
  pairMenuWithWineList,
  type DishPairing,
  type MenuDish,
} from "@/lib/menu-pairing.functions";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fileToBase64(f: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function MenuPairingStudio() {
  const { restaurantId, activeGroupId } = useAuth();
  const storeKey = restaurantId ? `menu-pairing:${restaurantId}` : null;
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [results, setResults] = useState<DishPairing[]>([]);
  const [busy, setBusy] = useState<null | "extract" | "pair">(null);
  const [openPairingIndex, setOpenPairingIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractMenuDishes);
  const pair = useServerFn(pairMenuWithWineList);

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

  useEffect(() => {
    if (!storeKey) return;
    try {
      const s = JSON.parse(localStorage.getItem(storeKey) || "null");
      setDishes(s?.dishes ?? []);
      setResults(s?.results ?? []);
    } catch {
      /* ignore */
    }
  }, [storeKey]);

  useEffect(() => {
    if (storeKey) localStorage.setItem(storeKey, JSON.stringify({ dishes, results }));
  }, [storeKey, dishes, results]);

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

  function removeDish(index: number) {
    const dish = dishes[index];
    setDishes((x) => x.filter((_, j) => j !== index));
    setResults((x) => x.filter((r, j) => j !== index && (!dish || r.dish !== dish.name)));
    if (openPairingIndex === index) setOpenPairingIndex(null);
  }

  function findPairing(dish: MenuDish, index: number) {
    const byPosition = results[index];
    if (byPosition?.dish.trim().toLocaleLowerCase("pt-BR") === dish.name.trim().toLocaleLowerCase("pt-BR")) {
      return byPosition;
    }
    return results.find((r) => r.dish.trim().toLocaleLowerCase("pt-BR") === dish.name.trim().toLocaleLowerCase("pt-BR")) ?? null;
  }

  const gaps = results.filter((r) => r.gap);
  const openDish = openPairingIndex === null ? null : dishes[openPairingIndex] ?? null;
  const openPairing = openDish && openPairingIndex !== null ? findPairing(openDish, openPairingIndex) : null;

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
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={"Um prato por linha. Ex.:\nPolvo grelhado - batata ao murro e páprica\nRisoto de cogumelos"}
          className="w-full rounded-md border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={addFromText}
            disabled={!text.trim()}
            className="rounded-md border border-border px-3 py-1.5 text-[11px] uppercase text-primary hover:border-primary disabled:opacity-40"
          >
            Adicionar pratos
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] uppercase text-primary hover:border-primary disabled:opacity-40"
          >
            {busy === "extract" ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
            Enviar cardápio (PDF ou foto)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onUrl()}
            placeholder="Ou cole o link do cardápio (site, PDF ou imagem)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
          <button
            onClick={onUrl}
            disabled={!url.trim() || !!busy}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] uppercase text-primary hover:border-primary disabled:opacity-40"
          >
            {busy === "extract" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            Ler link
          </button>
        </div>

        {!!dishes.length && (
          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {dishes.map((d, i) => (
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
                    disabled={!findPairing(d, i)}
                    onClick={() => setOpenPairingIndex(i)}
                    className="h-7 w-7 text-muted-foreground hover:text-primary disabled:opacity-30"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
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
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={run}
            disabled={!dishes.length || !!busy}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
          >
            {busy === "pair" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Harmonizar com a carta
          </button>
          {!!dishes.length && (
            <button
              onClick={() => {
                setDishes([]);
                setResults([]);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-[11px] uppercase text-muted-foreground hover:border-primary"
            >
              Limpar
            </button>
          )}
        </div>
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
    </div>
  );
}

export default MenuPairingStudio;
