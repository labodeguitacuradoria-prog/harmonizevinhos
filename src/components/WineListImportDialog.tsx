import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Upload, Loader2, FileText, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  extractWineListFromFile,
  extractWineListFromText,
  type WineListItem,
} from "@/lib/winelist-import.functions";

const TYPES = ["Tinto", "Branco", "Rosé", "Espumante", "Fortificado"];
const VOLUMES = ["750 ml", "375 ml", "187 ml", "1500 ml", "Taça"];
const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto", white: "Branco", rose: "Rosé",
  sparkling: "Espumante", dessert: "Fortificado", fortified: "Fortificado",
};

export type ExistingWine = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  volume: string | null;
  wine_type: string | null;
  sale_price: number;
  internal_code: string | null;
  active_on_menu: boolean;
};

type Row = {
  key: string;
  selected: boolean;
  match: ExistingWine | null;
  changes: string[];
  confidence: string | null;
  section: string | null;
  // editable fields
  name: string;
  producer: string;
  vintage: string;
  country: string;
  region: string;
  grape: string;
  wine_type: string;
  volume: string;
  price: string;
  internal_code: string;
};

function norm(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(a: string, b: string) {
  const A = new Set(norm(a).split(" ").filter((t) => t.length > 2));
  const B = new Set(norm(b).split(" ").filter((t) => t.length > 2));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((t) => { if (B.has(t)) hit++; });
  return hit / Math.max(A.size, B.size);
}

function normVolume(v: string | null): string {
  const s = (v ?? "").toLowerCase();
  if (!s) return "750 ml";
  if (s.includes("taça") || s.includes("taca") || s.includes("glass") || s.includes("calice")) return "Taça";
  const m = s.match(/(\d{3,4})/);
  if (m) {
    const n = Number(m[1]);
    if (n === 1500 || n === 150) return "1500 ml";
    if (n === 375) return "375 ml";
    if (n === 187) return "187 ml";
    if (n === 750) return "750 ml";
    return `${n} ml`;
  }
  return "750 ml";
}

function normType(t: string | null): string {
  if (!t) return "";
  const mapped = LEGACY_TYPE_MAP[t.toLowerCase()] ?? t;
  const found = TYPES.find((x) => norm(x) === norm(mapped));
  return found ?? mapped;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function findMatch(item: { name: string; producer: string; vintage: string; volume: string; internal_code: string }, wines: ExistingWine[]) {
  const code = item.internal_code.trim();
  if (code) {
    const byCode = wines.find((w) => (w.internal_code ?? "").trim().toLowerCase() === code.toLowerCase());
    if (byCode) return byCode;
  }
  const vol = normVolume(item.volume);
  const vint = item.vintage ? Number(item.vintage) : null;

  const exact = wines.find(
    (w) =>
      norm(w.name) === norm(item.name) &&
      norm(w.producer) === norm(item.producer) &&
      (w.vintage ?? null) === vint &&
      normVolume(w.volume) === vol,
  );
  if (exact) return exact;

  const sameNameVol = wines.find(
    (w) => norm(w.name) === norm(item.name) && normVolume(w.volume) === vol,
  );
  if (sameNameVol) return sameNameVol;

  let best: { w: ExistingWine; s: number } | null = null;
  for (const w of wines) {
    if (normVolume(w.volume) !== vol) continue;
    const s =
      tokenScore(w.name, item.name) * 0.75 +
      tokenScore(w.producer ?? "", item.producer) * 0.25;
    if (s >= 0.72 && (!best || s > best.s)) best = { w, s };
  }
  return best?.w ?? null;
}

export function WineListImportDialog({
  restaurantId,
  wines,
  onClose,
  onApplied,
  hidden = false,
  onDiscard,
}: {
  restaurantId: string;
  wines: ExistingWine[];
  onClose: () => void;
  onApplied: () => void;
  hidden?: boolean;
  onDiscard?: () => void;
}) {
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [pastedText, setPastedText] = useState("");
  const [progress, setProgress] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"novos" | "alterados" | "iguais" | "fora">("novos");
  const [missing, setMissing] = useState<{ wine: ExistingWine; selected: boolean }[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);
  const extractFile = useServerFn(extractWineListFromFile);
  const extractText = useServerFn(extractWineListFromText);
  const filesRef = useRef<File[]>([]);

  function buildRows(items: WineListItem[]) {
    const seen = new Set<string>();
    const built: Row[] = [];
    items.forEach((it, i) => {
      const draft = {
        name: (it.nome ?? "").trim(),
        producer: it.produtor ?? "",
        vintage: it.safra != null ? String(it.safra) : "",
        volume: normVolume(it.volume),
        internal_code: it.codigo ?? "",
      };
      const dedupe = `${norm(draft.name)}|${norm(draft.producer)}|${draft.vintage}|${draft.volume}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);

      const match = findMatch(draft, wines);
      const price = it.preco != null ? String(it.preco) : "";
      const wine_type = normType(it.tipo);
      const changes: string[] = [];
      if (match) {
        if (price && Math.abs(Number(price) - Number(match.sale_price)) > 0.009) {
          changes.push(`preço R$ ${Number(match.sale_price).toFixed(2)} → R$ ${Number(price).toFixed(2)}`);
        }
        const vint = draft.vintage ? Number(draft.vintage) : null;
        if (vint != null && vint !== (match.vintage ?? null)) {
          changes.push(`safra ${match.vintage ?? "—"} → ${vint}`);
        }
        if (draft.internal_code && draft.internal_code !== (match.internal_code ?? "")) {
          changes.push(`código ${match.internal_code ?? "—"} → ${draft.internal_code}`);
        }
        if (!match.active_on_menu) changes.push("voltar para a carta");
      }
      built.push({
        key: `r${i}`,
        selected: !match || changes.length > 0,
        match,
        changes,
        confidence: it.confianca,
        section: it.secao,
        ...draft,
        country: it.pais ?? "",
        region: it.regiao ?? "",
        grape: it.uvas ?? "",
        wine_type,
        price,
      });
    });

    const matchedIds = new Set(built.map((r) => r.match?.id).filter(Boolean) as string[]);
    setRows(built);
    setMissing(
      wines
        .filter((w) => w.active_on_menu && !matchedIds.has(w.id))
        .map((w) => ({ wine: w, selected: false })),
    );
    const news = built.filter((r) => !r.match).length;
    setTab(news > 0 ? "novos" : built.some((r) => r.changes.length) ? "alterados" : "iguais");
    setStep("review");
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    filesRef.current = files;
    setStep("processing");
    const all: WineListItem[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`Lendo ${i + 1} de ${files.length}: ${f.name}`);
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`${f.name} é maior que 20 MB e foi ignorado.`);
          continue;
        }
        const dataUrl = await fileToBase64(f);
        const res = await extractFile({
          data: { fileBase64: dataUrl, mimeType: f.type || "application/pdf" },
        });
        all.push(...res);
      }
      if (!all.length) {
        toast.error("Nenhum rótulo foi identificado na carta.");
        setStep("upload");
        return;
      }
      buildRows(all);
      // Arquiva a carta para rastreabilidade (não bloqueia o fluxo).
      void archiveFiles(files);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ler a carta.");
      setStep("upload");
    }
  }

  async function archiveFiles(files: File[]) {
    try {
      for (const f of files) {
        const ext = f.name.split(".").pop() || "bin";
        const path = `wine-lists/${restaurantId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-media").upload(path, f, { upsert: false });
        if (error) continue;
        const { data: signed } = await supabase.storage
          .from("product-media")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) {
          await supabase.from("restaurant_wine_lists").insert({
            restaurant_id: restaurantId,
            file_url: signed.signedUrl,
            version_label: `Importação ${new Date().toLocaleDateString("pt-BR")} — ${f.name}`,
            is_current: true,
          });
        }
      }
    } catch {
      /* rastreabilidade é opcional */
    }
  }

  async function handleText() {
    if (pastedText.trim().length < 20) return toast.error("Cole um texto maior.");
    setStep("processing");
    setProgress("Lendo o texto da carta...");
    try {
      const res = await extractText({ data: { text: pastedText } });
      if (!res.length) {
        toast.error("Nenhum rótulo identificado.");
        setStep("upload");
        return;
      }
      buildRows(res);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ler o texto.");
      setStep("upload");
    }
  }

  const news = useMemo(() => rows.filter((r) => !r.match), [rows]);
  const changed = useMemo(() => rows.filter((r) => r.match && r.changes.length > 0), [rows]);
  const same = useMemo(() => rows.filter((r) => r.match && r.changes.length === 0), [rows]);

  function patch(key: string, p: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  async function apply() {
    const toCreate = news.filter((r) => r.selected);
    const toUpdate = changed.filter((r) => r.selected);
    const toDeactivate = missing.filter((m) => m.selected);
    if (!toCreate.length && !toUpdate.length && !toDeactivate.length) {
      return toast.error("Selecione ao menos um item.");
    }
    setApplying(true);
    setApplyProgress(0);
    const total = toCreate.length + toUpdate.length + toDeactivate.length;
    let done = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let lastError: string | null = null;

    // Enriquecimento pelo Catálogo Global (aprovados)
    const enrich = new Map<string, any>();
    if (toCreate.length) {
      try {
        const { data: cat } = await supabase
          .from("wine_catalog")
          .select(
            "id, name, producer, vintage, region, appellation, country, grape, wine_type, style, alcohol_pct, sugar_level, body, tannin, acidity, aging, serving_temp_min, serving_temp_max, pairing_notes, tasting_notes, awards, image_url, tech_sheet_url",
          )
          .eq("status", "approved")
          .limit(2000);
        for (const r of toCreate) {
          let best: { c: any; s: number } | null = null;
          for (const c of cat ?? []) {
            const s = tokenScore(c.name ?? "", r.name) * 0.75 + tokenScore(c.producer ?? "", r.producer) * 0.25;
            if (s >= 0.8 && (!best || s > best.s)) best = { c, s };
          }
          if (best) enrich.set(r.key, best.c);
        }
      } catch {
        /* enriquecimento é opcional */
      }
    }

    for (const r of toCreate) {
      const c = enrich.get(r.key);
      const payload: Record<string, any> = {
        restaurant_id: restaurantId,
        name: r.name,
        producer: r.producer || c?.producer || null,
        vintage: r.vintage ? Number(r.vintage) : (c?.vintage ?? null),
        country: r.country || c?.country || null,
        region: r.region || c?.region || null,
        appellation: c?.appellation ?? null,
        grape: r.grape || c?.grape || null,
        wine_type: r.wine_type || c?.wine_type || null,
        style: c?.style ?? null,
        volume: r.volume || "750 ml",
        internal_code: r.internal_code || null,
        cost_price: 0,
        sale_price: r.price ? Number(r.price) : 0,
        active_on_menu: true,
        count_in_stock: normVolume(r.volume) !== "Taça",
        alcohol_pct: c?.alcohol_pct ?? null,
        sugar_level: c?.sugar_level ?? null,
        body: c?.body ?? null,
        tannin: c?.tannin ?? null,
        acidity: c?.acidity ?? null,
        aging: c?.aging ?? null,
        serving_temp_min: c?.serving_temp_min ?? null,
        serving_temp_max: c?.serving_temp_max ?? null,
        pairing_notes: c?.pairing_notes ?? null,
        tasting_notes: c?.tasting_notes ?? null,
        awards: c?.awards ?? null,
        image_url: c?.image_url ?? null,
        tech_sheet_url: c?.tech_sheet_url ?? null,
        catalog_id: c?.id ?? null,
      };
      const { error } = await supabase.from("wines").insert(payload as never);
      if (error) {
        failed++;
        lastError = error.message;
        console.error("[winelist-import] insert falhou:", r.name, error);
      } else created++;

      done++;
      setApplyProgress(Math.round((done / total) * 100));
    }

    for (const r of toUpdate) {
      const upd: Record<string, any> = { active_on_menu: true };
      if (r.price) upd.sale_price = Number(r.price);
      if (r.vintage) upd.vintage = Number(r.vintage);
      if (r.internal_code) upd.internal_code = r.internal_code;
      const { error } = await supabase.from("wines").update(upd as never).eq("id", r.match!.id);
      if (error) {
        failed++;
        lastError = error.message;
        console.error("[winelist-import] update falhou:", r.name, error);
      } else updated++;
      done++;
      setApplyProgress(Math.round((done / total) * 100));
    }

    if (toDeactivate.length) {
      const { error } = await supabase
        .from("wines")
        .update({ active_on_menu: false })
        .in("id", toDeactivate.map((m) => m.wine.id));
      if (error) failed += toDeactivate.length;
      done += toDeactivate.length;
      setApplyProgress(100);
    }

    setApplying(false);
    if (failed) {
      toast.error(`${failed} item(ns) não puderam ser gravados.${lastError ? ` Motivo: ${lastError}` : ""}`);
    }
    toast.success(
      `${created} novo(s), ${updated} atualizado(s), ${toDeactivate.length} retirado(s) da carta.`,
    );
    onApplied();
  }

  const visible = tab === "novos" ? news : tab === "alterados" ? changed : tab === "iguais" ? same : [];
  const selectedCount =
    news.filter((r) => r.selected).length +
    changed.filter((r) => r.selected).length +
    missing.filter((m) => m.selected).length;

  const hasWork = step === "review" || step === "processing";

  function handleDiscard() {
    if (hasWork && !window.confirm("Descartar esta importação? Os rótulos lidos serão perdidos.")) return;
    onDiscard?.();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center ${
        hidden ? "hidden" : ""
      }`}
    >
      <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="text-lg font-semibold">Importar carta de vinhos</h3>
            <p className="text-xs text-muted-foreground">
              {hasWork
                ? "Você pode minimizar e voltar ao painel — a leitura fica guardada até você aplicar ou descartar."
                : "Envie o PDF ou a foto da carta — a IA lê os rótulos e você confere antes de gravar."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasWork && (
              <button
                onClick={handleDiscard}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase text-muted-foreground hover:text-destructive"
              >
                Descartar
              </button>
            )}
            <button
              onClick={hasWork ? onClose : handleDiscard}
              title={hasWork ? "Minimizar (mantém a leitura)" : "Fechar"}
              className="rounded-md p-1 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>


        <div className="overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("file")}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold uppercase transition ${
                    mode === "file" ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  <Upload className="h-3 w-3" /> PDF ou fotos
                </button>
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold uppercase transition ${
                    mode === "text" ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  <FileText className="h-3 w-3" /> Texto colado
                </button>
              </div>

              {mode === "file" ? (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 bg-background px-4 py-12 text-sm text-muted-foreground hover:bg-accent/40">
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="font-medium text-foreground">Selecionar PDF ou fotos da carta</span>
                  <span className="text-xs">
                    Pode enviar várias páginas de uma vez. Fotos nítidas dão melhor resultado.
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const fs = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      handleFiles(fs);
                    }}
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={12}
                    placeholder="Cole aqui o conteúdo da carta de vinhos (rótulos, safras e preços)..."
                    className="w-full rounded-md border border-input bg-background p-3 text-sm"
                  />
                  <button
                    onClick={handleText}
                    className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase text-primary-foreground"
                  >
                    <Sparkles className="h-3 w-3" /> Ler carta
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>{progress || "Analisando a carta..."}</div>
              <div className="text-xs">Cartas longas podem levar até 1 minuto por página.</div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {([
                  ["novos", `Novos (${news.length})`],
                  ["alterados", `Alterados (${changed.length})`],
                  ["iguais", `Sem alteração (${same.length})`],
                  ["fora", `Não encontrados (${missing.length})`],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-bold uppercase transition ${
                      tab === k ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "fora" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Estes rótulos estão ativos no sistema mas não apareceram na carta enviada. Marque para tirá-los
                    da carta (nada é apagado).
                  </p>
                  {missing.length === 0 && (
                    <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
                      Todos os rótulos ativos foram encontrados na carta.
                    </div>
                  )}
                  {missing.map((m, i) => (
                    <label
                      key={m.wine.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={m.selected}
                        onChange={(e) =>
                          setMissing((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)),
                          )
                        }
                      />
                      <span className="font-medium">{m.wine.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[m.wine.producer, m.wine.vintage, m.wine.volume].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="w-8 px-2 py-2"></th>
                        <th className="px-2 py-2">Rótulo</th>
                        <th className="px-2 py-2">Produtor</th>
                        <th className="w-20 px-2 py-2">Safra</th>
                        <th className="w-28 px-2 py-2">Tipo</th>
                        <th className="w-28 px-2 py-2">Volume</th>
                        <th className="w-24 px-2 py-2">Preço</th>
                        <th className="w-24 px-2 py-2">Código</th>
                        <th className="px-2 py-2">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                            Nenhum item nesta aba.
                          </td>
                        </tr>
                      )}
                      {visible.map((r) => (
                        <tr key={r.key} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              disabled={tab === "iguais"}
                              checked={r.selected}
                              onChange={(e) => patch(r.key, { selected: e.target.checked })}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={r.name}
                              onChange={(e) => patch(r.key, { name: e.target.value })}
                              className="w-full min-w-[180px] rounded border border-input bg-background px-1.5 py-1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={r.producer}
                              onChange={(e) => patch(r.key, { producer: e.target.value })}
                              className="w-full min-w-[120px] rounded border border-input bg-background px-1.5 py-1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={r.vintage}
                              onChange={(e) => patch(r.key, { vintage: e.target.value })}
                              className="w-full rounded border border-input bg-background px-1.5 py-1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={TYPES.includes(r.wine_type) ? r.wine_type : ""}
                              onChange={(e) => patch(r.key, { wine_type: e.target.value })}
                              className="w-full rounded border border-input bg-background px-1 py-1"
                            >
                              <option value="">—</option>
                              {TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={r.volume}
                              onChange={(e) => patch(r.key, { volume: e.target.value })}
                              className="w-full rounded border border-input bg-background px-1 py-1"
                            >
                              {[...new Set([...VOLUMES, r.volume])].filter(Boolean).map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={r.price}
                              onChange={(e) => patch(r.key, { price: e.target.value.replace(",", ".") })}
                              className="w-full rounded border border-input bg-background px-1.5 py-1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={r.internal_code}
                              onChange={(e) => patch(r.key, { internal_code: e.target.value })}
                              className="w-full rounded border border-input bg-background px-1.5 py-1"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-[11px]">
                            {r.match ? (
                              r.changes.length ? (
                                <span className="text-amber-600 dark:text-amber-400">{r.changes.join(" · ")}</span>
                              ) : (
                                <span className="text-muted-foreground">igual ao cadastro</span>
                              )
                            ) : (
                              <span className="text-muted-foreground">
                                novo{!r.price && " · sem preço"} · custo pendente
                              </span>
                            )}
                            {r.confidence === "baixa" && (
                              <span className="ml-1 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" /> conferir
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {step === "review" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            <div className="text-xs text-muted-foreground">
              {selectedCount} item(ns) selecionado(s)
              {applying && ` · gravando ${applyProgress}%`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("upload")}
                disabled={applying}
                className="rounded-md border border-border px-4 py-2 text-sm"
              >
                Enviar outra carta
              </button>
              <button
                onClick={apply}
                disabled={applying || selectedCount === 0}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                Aplicar seleção
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
