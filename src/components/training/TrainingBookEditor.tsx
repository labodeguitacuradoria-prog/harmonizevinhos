import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, BookOpen, Download, FilePlus2, KeyRound, ListOrdered, Plus, Save, Send, Trash2, Wine as WineIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPT } from "@/lib/file-accept";
import { BookPreview, type BookPreviewHandle } from "@/components/training/BookPreview";
import {
  buildBookPdf, defaultPages, layoutBook, producerOf, typeLabel, wineTitle, type BookPage, type BookWine,
} from "@/lib/training-book";

const WINE_COLUMNS =
  "id, name, producer, vintage, volume, wine_type, style, country, region, appellation, grape, alcohol_pct, body, sugar_level, oak_months, aging, serving_temp_min, serving_temp_max, tasting_notes, pairing_notes, elaboration, sale_price, image_url, internal_code";

const uid = () => crypto.randomUUID();

async function pdfToPngs(file: File): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: Blob[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 2000 / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
    out.push(await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao converter o PDF."))), "image/png")));
  }
  return out;
}

export default function TrainingBookEditor({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<BookPreviewHandle>(null);
  const [pages, setPages] = useState<BookPage[] | null>(null);
  const [title, setTitle] = useState("Livro de Estudos");
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [addTerm, setAddTerm] = useState("");

  const { data: wines = [], isFetched: winesFetched } = useQuery({
    queryKey: ["book-wines", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select(WINE_COLUMNS).eq("restaurant_id", restaurantId).eq("active_on_menu", true).order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as BookWine[];
    },
  });
  const { data: book, isFetched } = useQuery({
    queryKey: ["training-book", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_books").select("*").eq("restaurant_id", restaurantId).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  useEffect(() => {
    if (!isFetched || !winesFetched || pages !== null) return;
    if (book) {
      setTitle(book.title);
      setPages((book.pages as unknown as BookPage[]) ?? []);
    } else {
      setPages(defaultPages(wines, uid));
      setDirty(true);
    }
  }, [isFetched, winesFetched, book, wines, pages]);

  const list = pages ?? [];
  const byId = useMemo(() => new Map(wines.map((w) => [w.id, w])), [wines]);
  const inBook = new Set(list.flatMap((p) => (p.type === "wine" ? [p.wineId] : [])));
  const missing = wines.filter((w) => !inBook.has(w.id));
  const { layout, index: bookIndex } = useMemo(() => layoutBook(list, wines), [list, wines]);

  const layoutIndexOf = (p: BookPage) =>
    layout.findIndex((l) =>
      p.type === "wine" ? l.kind === "wine" && l.wine.id === p.wineId : p.type === "custom" ? l.kind === "custom" && l.page.id === p.id : l.kind === "index",
    );

  const update = (next: BookPage[]) => {
    setPages(next);
    setDirty(true);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const remove = (i: number) => update(list.filter((_, k) => k !== i));
  const sortByProducer = () => {
    const wineItems = list.filter((p) => p.type === "wine") as Extract<BookPage, { type: "wine" }>[];
    const sorted = [...wineItems].sort((a, b) => {
      const wa = byId.get(a.wineId);
      const wb = byId.get(b.wineId);
      if (!wa || !wb) return 0;
      return producerOf(wa).localeCompare(producerOf(wb), "pt-BR") || wa.name.localeCompare(wb.name, "pt-BR");
    });
    let k = 0;
    update(list.map((p) => (p.type === "wine" ? sorted[k++] : p)));
  };

  async function save(extra?: Record<string, unknown>) {
    const payload = { restaurant_id: restaurantId, title: title.trim() || "Livro de Estudos", pages: list as never, ...extra };
    const { error } = await supabase.from("training_books").upsert(payload, { onConflict: "restaurant_id" });
    if (error) throw new Error(error.message);
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["training-book", restaurantId] });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy("Enviando páginas…");
    try {
      const added: BookPage[] = [];
      for (const file of Array.from(files)) {
        const blobs = /\.pdf$/i.test(file.name) ? await pdfToPngs(file) : [file];
        for (let i = 0; i < blobs.length; i++) {
          const ext = blobs[i] === file ? (file.name.split(".").pop() ?? "png").toLowerCase() : "png";
          const path = `training-books/${restaurantId}/pages/${uid()}.${ext}`;
          const { error } = await supabase.storage.from("product-media").upload(path, blobs[i], { contentType: blobs[i].type || undefined });
          if (error) throw error;
          added.push({ id: uid(), type: "custom", path, name: blobs.length > 1 ? `${file.name} · pág. ${i + 1}` : file.name });
        }
      }
      // Páginas novas entram antes do índice (como introdução), mantendo a ordem do arquivo.
      const idx = list.findIndex((p) => p.type === "index");
      const at = idx >= 0 ? idx : 0;
      update([...list.slice(0, at), ...added, ...list.slice(at)]);
      toast.success(`${added.length} página(s) adicionada(s). Use as setas para posicionar.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function makePdf() {
    return buildBookPdf({
      title: title.trim() || "Livro de Estudos",
      restaurantName,
      pages: list,
      wines,
      resolveCustomUrl: async (path) => (await supabase.storage.from("product-media").createSignedUrl(path, 600)).data?.signedUrl ?? null,
      onProgress: (d, t) => setBusy(`Montando página ${Math.min(d + 1, t)} de ${t}…`),
    });
  }

  async function download() {
    setBusy("Montando o livro…");
    try {
      const { blob } = await makePdf();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(title || "livro-de-estudos").replace(/[^\w\- ]+/g, "")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("Montando o livro…");
    try {
      const { blob, index } = await makePdf();
      setBusy("Publicando para a equipe…");
      const path = `training-books/${restaurantId}/livro.pdf`;
      const { error } = await supabase.storage.from("product-media").upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (error) throw error;
      await save({ pdf_path: path, book_index: index as never, published_at: new Date().toISOString() });
      toast.success("Livro publicado. A equipe já vê esta versão pelo link de treinamento.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao publicar.");
    } finally {
      setBusy(null);
    }
  }

  if (pages === null) return <p className="text-sm text-muted-foreground">Carregando o livro…</p>;

  const filteredMissing = missing.filter((w) => `${w.name} ${w.producer ?? ""}`.toLowerCase().includes(addTerm.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome do livro</label>
            <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
          </div>
          <Button variant="outline" onClick={() => save().then(() => toast.success("Livro salvo.")).catch((e) => toast.error(e.message))} disabled={!!busy || !dirty}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
          <Button variant="outline" onClick={download} disabled={!!busy}>
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          <Button onClick={publish} disabled={!!busy}>
            <Send className="h-4 w-4" /> Publicar para a equipe
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/access-links"><KeyRound className="h-4 w-4" /> Link da equipe</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {layout.length} páginas A4 · {inBook.size} rótulos ·{" "}
          {book?.published_at ? `publicado em ${new Date(book.published_at).toLocaleString("pt-BR")}` : "ainda não publicado"}
          {dirty && " · alterações não salvas"}
          {busy && ` · ${busy}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" multiple className="hidden" accept={ACCEPT.pdfOrImage} onChange={(e) => onFiles(e.target.files)} />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          <FilePlus2 className="h-4 w-4" /> Inserir páginas (imagem ou PDF)
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" disabled={!missing.length}>
              <Plus className="h-4 w-4" /> Adicionar rótulos ({missing.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <Input placeholder="Buscar rótulo…" value={addTerm} onChange={(e) => setAddTerm(e.target.value)} className="mb-2" />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredMissing.map((w) => (
                <button key={w.id} type="button" className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => update([...list, { id: uid(), type: "wine", wineId: w.id }])}>
                  {wineTitle(w)} <span className="text-xs text-muted-foreground">· {producerOf(w)}</span>
                </button>
              ))}
              {missing.length > 1 && (
                <Button size="sm" className="w-full mt-1" onClick={() => update([...list, ...missing.map((w) => ({ id: uid(), type: "wine" as const, wineId: w.id }))])}>
                  Adicionar todos
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" onClick={sortByProducer}><ListOrdered className="h-4 w-4" /> Ordenar por produtor</Button>
        {!list.some((p) => p.type === "index") && (
          <Button variant="outline" onClick={() => update([{ id: uid(), type: "index" }, ...list])}><BookOpen className="h-4 w-4" /> Incluir índice</Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Cada rótulo ocupa uma página A4 com os dados do cadastro. Antes do primeiro vinho de cada produtor entra uma página de abertura com o produtor centralizado e os rótulos que ele oferece. O índice no PDF é clicável.
      </p>

      <div className="grid gap-5 xl:grid-cols-[minmax(340px,440px)_1fr]">
      <ol className="space-y-1.5 xl:max-h-[calc(100vh-160px)] xl:overflow-y-auto xl:pr-1">
        {list.map((p, i) => {
          const w = p.type === "wine" ? byId.get(p.wineId) : undefined;
          const prevW = i > 0 && list[i - 1].type === "wine" ? byId.get((list[i - 1] as { wineId: string }).wineId) : undefined;
          const newProducer = w && (!prevW || producerOf(prevW) !== producerOf(w));
          return (
            <li key={p.id}>
              {newProducer && (
                <div className="mt-3 mb-1 text-center text-[11px] uppercase tracking-[0.2em] text-primary">{producerOf(w!)}</div>
              )}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                <span className="w-7 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                {p.type === "wine" ? <WineIcon className="h-4 w-4 text-primary" /> : p.type === "index" ? <BookOpen className="h-4 w-4 text-primary" /> : <FilePlus2 className="h-4 w-4 text-muted-foreground" />}
                <button type="button" className="flex-1 min-w-0 text-left" title="Ver no livro" onClick={() => { const k = layoutIndexOf(p); if (k >= 0) previewRef.current?.goTo(k); }}>
                  <div className="truncate text-sm">
                    {p.type === "wine" ? (w ? wineTitle(w) : "Rótulo removido da carta") : p.type === "index" ? "Índice dos rótulos (clicável)" : p.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.type === "wine" ? (w ? `${typeLabel(w.wine_type)} · ${producerOf(w)}` : "será ignorado") : p.type === "index" ? "gerado automaticamente" : "página inserida"}
                  </div>
                </button>
                <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(i)} aria-label="Excluir página"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="min-w-0">
        <BookPreview ref={previewRef} layout={layout} index={bookIndex} wines={wines} title={title.trim() || "Livro de Estudos"} restaurantName={restaurantName} />
      </div>
      </div>
    </div>
  );
}
