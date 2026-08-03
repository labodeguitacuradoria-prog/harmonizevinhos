import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Upload, Loader2, FileText, Sparkles, AlertTriangle } from "lucide-react";
import {
  extractSalesFromFile,
  extractSalesFromText,
  type SalesImportItem,
} from "@/lib/sales-import.functions";

export type SalesWine = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  volume: string | null;
  internal_code: string | null;
  sale_price: number;
};

type Row = {
  key: string;
  selected: boolean;
  raw: string;
  wineId: string;
  qty: string;
  revenue: string;
  confidence: string | null;
  score: number;
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
  A.forEach((t) => {
    if (B.has(t)) hit++;
  });
  return hit / Math.max(A.size, B.size);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function matchWine(item: SalesImportItem, wines: SalesWine[]): { id: string; score: number } {
  const code = (item.codigo ?? "").trim();
  if (code) {
    const byCode = wines.find(
      (w) => (w.internal_code ?? "").trim().toLowerCase() === code.toLowerCase(),
    );
    if (byCode) return { id: byCode.id, score: 1 };
  }
  let best: { id: string; score: number } | null = null;
  for (const w of wines) {
    let s = tokenScore(w.name + " " + (w.producer ?? ""), item.nome);
    if (item.safra && w.vintage === item.safra) s += 0.1;
    if (item.volume && norm(item.volume) === norm(w.volume)) s += 0.1;
    if (!best || s > best.score) best = { id: w.id, score: s };
  }
  if (best && best.score >= 0.5) return best;
  return { id: "", score: best?.score ?? 0 };
}

export function SalesImportDialog({
  wines,
  mode,
  month,
  onClose,
  onApply,
}: {
  wines: SalesWine[];
  mode: "current" | "historic";
  month: string;
  onClose: () => void;
  onApply: (entries: { wineId: string; qty: string; revenue: string }[]) => void;
}) {
  const [step, setStep] = useState<"upload" | "loading" | "review">("upload");
  const [rows, setRows] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fromFile = useServerFn(extractSalesFromFile);
  const fromText = useServerFn(extractSalesFromText);

  function buildRows(items: SalesImportItem[]) {
    const built: Row[] = items.map((it, i) => {
      const m = matchWine(it, wines);
      const qty = it.quantidade != null && it.quantidade > 0 ? String(it.quantidade) : "";
      const rev = it.faturamento != null && it.faturamento > 0 ? String(it.faturamento) : "";
      return {
        key: `r${i}`,
        selected: !!m.id && !!qty && (mode === "current" || !!rev),
        raw: it.nome + (it.safra ? ` ${it.safra}` : "") + (it.volume ? ` · ${it.volume}` : ""),
        wineId: m.id,
        qty,
        revenue: rev,
        confidence: it.confianca,
        score: m.score,
      };
    });
    setRows(built);
    setStep("review");
    if (!built.length) toast.error("Nenhuma linha de vinho foi identificada no documento.");
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setStep("loading");
    try {
      const all: SalesImportItem[] = [];
      for (const file of Array.from(files)) {
        const b64 = await fileToBase64(file);
        const res = await fromFile({ data: { fileBase64: b64, mimeType: file.type || "application/pdf" } });
        all.push(...(res as SalesImportItem[]));
      }
      buildRows(all);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler o documento.");
      setStep("upload");
    }
  }

  async function handleText() {
    if (text.trim().length < 10) return toast.error("Cole o texto da tabela de vendas.");
    setStep("loading");
    try {
      const res = await fromText({ data: { text } });
      buildRows(res as SalesImportItem[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler o texto.");
      setStep("upload");
    }
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const ready = rows.filter(
    (r) => r.selected && r.wineId && Number(r.qty) > 0 && (mode === "current" || Number(r.revenue) > 0),
  );

  function apply() {
    if (!ready.length) return toast.error("Nenhuma linha válida selecionada.");
    onApply(ready.map((r) => ({ wineId: r.wineId, qty: r.qty, revenue: r.revenue })));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="mt-6 w-full max-w-5xl rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
              Importar vendas com IA · {month}
            </h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "upload" && (
          <div className="space-y-5 p-6">
            <p className="text-sm text-muted-foreground">
              Envie o PDF, a planilha exportada ou a foto do relatório de vendas do restaurante. A IA
              identifica os rótulos, as quantidades e o faturamento — você confere tudo antes de aplicar.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Upload className="h-6 w-6" />
              Selecionar PDF, imagem ou CSV do relatório
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="application/pdf,image/*,text/csv,text/plain"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div>
              <label className="text-xs uppercase text-muted-foreground">Ou cole o texto da tabela</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Código  Produto  Qtd  Valor total..."
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleText}
                className="mt-2 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <FileText className="h-4 w-4" /> Ler texto
              </button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 p-16 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Lendo o relatório e cruzando com os rótulos cadastrados...
          </div>
        )}

        {step === "review" && (
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {rows.length} linha(s) lida(s) · {ready.length} pronta(s) para aplicar. Confira o rótulo
                vinculado e os valores antes de continuar.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("upload")}
                  className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Enviar outro documento
                </button>
                <button
                  onClick={apply}
                  disabled={!ready.length}
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Aplicar {ready.length} linha(s)
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2">Linha do relatório</th>
                    <th className="px-3 py-2">Rótulo cadastrado</th>
                    <th className="px-3 py-2 w-24">Qtd.</th>
                    <th className="px-3 py-2 w-32">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const weak = !r.wineId || r.score < 0.7 || r.confidence === "baixa";
                    return (
                      <tr key={r.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={(e) => update(r.key, { selected: e.target.checked })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {weak && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
                            <span className={weak ? "text-yellow-500" : ""}>{r.raw}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={r.wineId}
                            onChange={(e) => update(r.key, { wineId: e.target.value })}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                          >
                            <option value="">— não vincular —</option>
                            {wines.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.internal_code ? `${w.internal_code} · ` : ""}
                                {w.name}
                                {w.vintage ? ` ${w.vintage}` : ""}
                                {w.volume ? ` · ${w.volume}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={r.qty}
                            onChange={(e) => update(r.key, { qty: e.target.value })}
                            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm no-spin"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={r.revenue}
                            onChange={(e) => update(r.key, { revenue: e.target.value })}
                            placeholder={mode === "current" ? "opcional" : "obrigatório"}
                            className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm no-spin"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {mode === "current"
                ? "No mês corrente o faturamento é calculado pelo preço de venda cadastrado; o valor lido serve apenas de referência."
                : "No modo histórico o faturamento lido é usado para calcular o preço médio de cada rótulo."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
