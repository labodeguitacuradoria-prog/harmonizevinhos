import { useRef, useState } from "react";
import { ACCEPT } from "@/lib/file-accept";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Upload, Loader2, Sparkles, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { WinePicker } from "@/components/WinePicker";
import { extractStockFromFile, extractStockFromText, type StockImportItem } from "@/lib/stock-import.functions";

type Wine = { id: string; name: string; producer: string | null; vintage: number | null; volume: string | null; internal_code: string | null };
type Row = {
  key: string;
  selected: boolean;
  item: StockImportItem;
  wineId: string; // "" = criar novo
  matchBy: "codigo" | "nome" | "novo";
  qty: string;
};

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const normCode = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/^0+(?=\d)/, "");

function tokenScore(a: string, b: string) {
  const A = new Set(norm(a).split(" ").filter((t) => t.length > 2));
  const B = new Set(norm(b).split(" ").filter((t) => t.length > 2));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((t) => B.has(t) && hit++);
  return hit / Math.max(A.size, B.size);
}

function match(it: StockImportItem, wines: Wine[], useName: boolean): { id: string; by: Row["matchBy"] } {
  const code = normCode(it.codigo);
  if (code) {
    const w = wines.find((x) => normCode(x.internal_code) === code);
    if (w) return { id: w.id, by: "codigo" };
  }
  if (useName) {
    let best: { id: string; s: number } | null = null;
    for (const w of wines) {
      let s = tokenScore(w.name + " " + (w.producer ?? ""), it.nome + " " + (it.produtor ?? ""));
      if (it.safra && w.vintage === it.safra) s += 0.1;
      if (!best || s > best.s) best = { id: w.id, s };
    }
    if (best && best.s >= 0.6) return { id: best.id, by: "nome" };
  }
  return { id: "", by: "novo" };
}

const toB64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export function StockImportDialog({ onClose }: { onClose: () => void }) {
  const { restaurantId, user } = useAuth();
  const qc = useQueryClient();
  const fileFn = useServerFn(extractStockFromFile);
  const textFn = useServerFn(extractStockFromText);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [useName, setUseName] = useState(true);
  const [createNew, setCreateNew] = useState(true);
  const [quick, setQuick] = useState<{ key: string; name: string; producer: string; vintage: string; volume: string; code: string; cost: string; sale: string; type: string } | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));

  async function process(items: StockImportItem[]) {
    const { data } = await supabase
      .from("wines")
      .select("id,name,producer,vintage,volume,internal_code")
      .eq("restaurant_id", restaurantId!);
    const ws = ((data ?? []) as Wine[]).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    setWines(ws);
    setRows(
      items.map((it, i) => {
        const m = match(it, ws, useName);
        return { key: String(i), selected: (it.quantidade ?? 0) >= 0, item: it, wineId: m.id, matchBy: m.by, qty: String(it.quantidade ?? 0) };
      }),
    );
  }

  async function run(fn: () => Promise<StockImportItem[]>) {
    if (!restaurantId) return toast.error("Selecione um restaurante.");
    setLoading(true);
    try {
      await process(await fn());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na leitura.");
    } finally {
      setLoading(false);
    }
  }

  async function onFile(f: File) {
    const isSheet = /\.(xlsx|xls|csv|ods)$/i.test(f.name);
    if (isSheet) {
      run(async () => {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer());
        const csv = wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
        return textFn({ data: { text: csv } });
      });
    } else {
      run(async () => fileFn({ data: { fileBase64: await toB64(f), mimeType: f.type || "application/pdf" } }));
    }
  }

  function upd(key: string, p: Partial<Row>) {
    setRows((r) => r?.map((x) => (x.key === key ? { ...x, ...p } : x)) ?? null);
  }

  function openQuick(r: Row) {
    setQuick({ key: r.key, name: r.item.nome ?? "", producer: r.item.produtor ?? "", vintage: r.item.safra ? String(r.item.safra) : "",
      volume: r.item.volume || "750 ml", code: r.item.codigo ?? "", cost: r.item.custo != null ? String(r.item.custo) : "", sale: "", type: "" });
  }

  async function saveQuick() {
    if (!quick || !restaurantId) return;
    if (!quick.name.trim()) return toast.error("Informe o nome do rótulo.");
    setQuickSaving(true);
    const { data, error } = await supabase.from("wines").insert({
      restaurant_id: restaurantId, name: quick.name.trim(), producer: quick.producer.trim() || null,
      vintage: quick.vintage ? Number(quick.vintage) : null, volume: quick.volume.trim() || "750 ml",
      internal_code: quick.code.trim() || null, wine_type: quick.type || null,
      cost_price: Number(quick.cost.replace(",", ".")) || 0, sale_price: Number(quick.sale.replace(",", ".")) || 0,
      active_on_menu: true, count_in_stock: true,
    } as never).select("id,name,producer,vintage,volume,internal_code").single();
    setQuickSaving(false);
    if (error) return toast.error(error.message);
    const w = data as Wine;
    setWines((ws) => [...ws, w].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })));
    upd(quick.key, { wineId: w.id, matchBy: "nome", selected: true });
    qc.invalidateQueries();
    toast.success("Rótulo criado e vinculado.");
    setQuick(null);
  }

  async function confirm() {
    if (!rows || !restaurantId) return;
    const sel = rows.filter((r) => r.selected && (r.wineId || createNew));
    if (!sel.length) return toast.error("Nenhuma linha selecionada.");
    setSaving(true);
    try {
      // 1. cria rótulos novos
      for (const r of sel.filter((x) => !x.wineId)) {
        const { data, error } = await supabase
          .from("wines")
          .insert({
            restaurant_id: restaurantId,
            name: r.item.nome || r.item.codigo || "Sem nome",
            producer: r.item.produtor,
            vintage: r.item.safra,
            volume: r.item.volume || "750 ml",
            internal_code: r.item.codigo,
            cost_price: r.item.custo ?? 0,
            sale_price: 0,
            active_on_menu: false,
            count_in_stock: true,
          } as never)
          .select("id")
          .single();
        if (error) throw error;
        r.wineId = (data as { id: string }).id;
      }
      // agrega por rótulo (linhas repetidas somam)
      const qtyBy = new Map<string, number>();
      sel.forEach((r) => qtyBy.set(r.wineId, (qtyBy.get(r.wineId) ?? 0) + Math.max(0, Math.round(Number(r.qty) || 0))));

      const { data: last } = await supabase.rpc("get_last_closed_stock", { p_restaurant_id: restaurantId });
      const prev = new Map<string, number>(((last ?? []) as { wine_id: string; last_qty: number }[]).map((l) => [l.wine_id, l.last_qty ?? 0]));

      const now = new Date().toISOString();
      const { data: sess, error: se } = await supabase
        .from("stock_count_sessions")
        .insert({ restaurant_id: restaurantId, reference_date: refDate, status: "draft", notes: "Importação de estoque", started_by: user?.id ?? null })
        .select("id")
        .single();
      if (se) throw se;
      const sid = sess.id as string;
      const items = [...qtyBy].map(([wine_id, q]) => ({
        session_id: sid, wine_id, previous_qty: prev.get(wine_id) ?? 0, counted_qty: q, counted_at: now, counted_by: user?.id ?? null,
      }));
      const { error: ie } = await supabase.from("stock_count_items").insert(items);
      if (ie) throw ie;
      const adj = items
        .filter((i) => i.counted_qty !== i.previous_qty)
        .map((i) => ({
          wine_id: i.wine_id, restaurant_id: restaurantId, movement_type: "adjustment" as const,
          quantity: i.counted_qty - i.previous_qty, notes: `Importação de estoque (${refDate})`,
          created_by: user?.id ?? null, source_session_id: sid,
        }));
      if (adj.length) {
        const { error } = await supabase.from("inventory_movements").insert(adj);
        if (error) throw error;
      }
      const { error: ce } = await supabase
        .from("stock_count_sessions")
        .update({ status: "closed", closed_at: now, closed_by: user?.id ?? null })
        .eq("id", sid);
      if (ce) throw ce;
      toast.success(`Estoque importado: ${items.length} rótulo(s).`);
      qc.invalidateQueries();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar o estoque.");
    } finally {
      setSaving(false);
    }
  }

  const counts = rows
    ? { codigo: rows.filter((r) => r.matchBy === "codigo").length, nome: rows.filter((r) => r.matchBy === "nome").length, novo: rows.filter((r) => !r.wineId).length }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-4 w-4" /> Importar estoque com IA
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto p-4">
          {!rows ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie o inventário em PDF, foto, Excel/CSV ou cole o texto. O sistema localiza cada rótulo pelo <b>código</b> e, se quiser, também pelo nome. Rótulos não encontrados podem ser criados automaticamente — funciona mesmo sem carta cadastrada.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useName} onChange={(e) => setUseName(e.target.checked)} />
                Quando o código não for encontrado, tentar pelo nome do rótulo
              </label>
              <button
                type="button"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-8 text-sm text-muted-foreground hover:bg-accent"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Lendo o estoque...</> : <><Upload className="h-4 w-4" /> Selecionar PDF, imagem ou planilha</>}
              </button>
              <input ref={inputRef} type="file" hidden accept={ACCEPT.stock}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
                placeholder="ou cole aqui a tabela de estoque (código, nome, quantidade...)"
                className="w-full rounded-md border border-input bg-background p-2 text-sm" />
              <Button variant="outline" disabled={loading || text.trim().length < 5}
                onClick={() => run(() => textFn({ data: { text } }))}>
                <FileText className="h-4 w-4" /> Ler texto colado
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span>Pelo código: <b className="text-primary">{counts!.codigo}</b></span>
                <span>Pelo nome: <b className="text-primary">{counts!.nome}</b></span>
                <span>Não encontrados: <b className="text-primary">{counts!.novo}</b></span>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} />
                  Criar rótulos não encontrados como novos produtos
                </label>
                <label className="ml-auto flex items-center gap-2">
                  Data de referência
                  <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)}
                    className="rounded border border-input bg-background px-2 py-1" />
                </label>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="p-2"></th><th className="p-2">Código</th><th className="p-2">Lido no arquivo</th>
                    <th className="p-2">Rótulo no sistema</th><th className="p-2 w-24">Qtd.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-border">
                      <td className="p-2"><input type="checkbox" checked={r.selected} onChange={(e) => upd(r.key, { selected: e.target.checked })} /></td>
                      <td className="p-2 font-mono text-xs">{r.item.codigo ?? "—"}</td>
                      <td className="p-2">
                        <div>{r.item.nome}</div>
                        <div className="text-xs text-muted-foreground">{[r.item.produtor, r.item.safra, r.item.volume].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="p-2">
                        <WinePicker wines={wines} value={r.wineId}
                          emptyLabel={createNew ? "+ Criar novo rótulo" : "— Ignorar (não encontrado)"}
                          onChange={(id) => upd(r.key, { wineId: id, matchBy: id ? "nome" : "novo" })}
                          onCreate={createNew ? () => openQuick(r) : undefined} />
                        {r.matchBy === "codigo" && <div className="mt-0.5 text-[10px] text-primary">encontrado pelo código</div>}
                      </td>
                      <td className="p-2">
                        <input type="number" min={0} value={r.qty} onChange={(e) => upd(r.key, { qty: e.target.value })}
                          className="w-20 rounded border border-input bg-background px-2 py-1 text-right" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {rows && (
          <div className="flex justify-between gap-2 border-t border-border p-4">
            <Button variant="outline" onClick={() => setRows(null)} disabled={saving}>Voltar</Button>
            <Button onClick={confirm} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar estoque
            </Button>
          </div>
        )}
      </div>
      {quick && (() => { const F = (k: string, label: string, type = "text") => (
    <label className="block text-xs text-muted-foreground">{label}
      <input type={type} value={(quick as Record<string, string>)[k]} onChange={(e) => setQuick((q) => q && { ...q, [k]: e.target.value })}
        className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground" />
    </label>);
        return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4" onClick={() => !quickSaving && setQuick(null)}>
          <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold uppercase tracking-wider text-primary">Novo rótulo</h3>
              <button type="button" onClick={() => setQuick(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Confira o que foi lido no arquivo e complete os dados.</p>
            {F("name", "Nome *")}
            <div className="grid grid-cols-2 gap-3">{F("producer", "Produtor")}{F("vintage", "Safra", "number")}</div>
            <div className="grid grid-cols-2 gap-3">{F("volume", "Volume")}{F("code", "Código interno")}</div>
            <label className="block text-xs text-muted-foreground">Tipo
              <select value={quick.type} onChange={(e) => setQuick({ ...quick, type: e.target.value })}
                className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground">
                <option value="">—</option><option value="red">Tinto</option><option value="white">Branco</option><option value="rose">Rosé</option>
                <option value="sparkling">Espumante</option><option value="dessert">Sobremesa</option><option value="fortified">Fortificado</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">{F("cost", "Custo (R$)")}{F("sale", "Preço de venda (R$)")}</div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setQuick(null)} disabled={quickSaving}>Cancelar</Button>
              <Button onClick={saveQuick} disabled={quickSaving}>{quickSaving && <Loader2 className="h-4 w-4 animate-spin" />} Criar e vincular</Button>
            </div>
          </div>
        </div>); })()}
    </div>
  );
}
