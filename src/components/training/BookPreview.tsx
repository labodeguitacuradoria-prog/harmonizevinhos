import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  INDEX_LINES_PER_PAGE, TYPE_COLOR, producerOf, techRows, typeLabel, wineTitle,
  type BookIndexEntry, type BookWine, type Layout,
} from "@/lib/training-book";

// Simulação do papel impresso: as cores abaixo reproduzem o PDF (papel branco), não o tema da tela.
const PAGE_W = 794; // 210mm @96dpi
const PAGE_H = 1123; // 297mm
const MM = PAGE_W / 210;
const GOLD = "rgb(160,125,30)";
const INK = "rgb(35,35,35)";
const MUTED = "rgb(120,120,120)";

export type BookPreviewHandle = { goTo: (layoutIndex: number) => void };

function CustomImage({ path }: { path: string }) {
  const { data } = useQuery({
    queryKey: ["book-page-url", path],
    staleTime: 8 * 60 * 1000,
    queryFn: async () => (await supabase.storage.from("product-media").createSignedUrl(path, 600)).data?.signedUrl ?? null,
  });
  return data ? <img src={data} alt="" className="h-full w-full object-contain" /> : <div className="m-auto text-xs" style={{ color: MUTED }}>Carregando página…</div>;
}

function Footer({ n, title, restaurantName, back }: { n: number; title: string; restaurantName: string; back: boolean }) {
  return (
    <div className="absolute flex items-center justify-between" style={{ left: 18 * MM, right: 18 * MM, bottom: 7 * MM, borderTop: "1px solid #ddd", paddingTop: 6, fontSize: 11, color: MUTED }}>
      <span className="truncate">{title} · {restaurantName}</span>
      {back && <span style={{ color: GOLD }}>‹ Voltar ao índice</span>}
      <span>{n}</span>
    </div>
  );
}

function PageBody({ l, n, index, wines, title, restaurantName }: { l: Layout; n: number; index: BookIndexEntry[]; wines: BookWine[]; title: string; restaurantName: string }) {
  const pad = 18 * MM;
  if (l.kind === "custom") return <div className="flex h-full w-full"><CustomImage path={l.page.path} /></div>;
  if (l.kind === "index") {
    const lines: { t: "p" | "w"; text: string; page: number }[] = [];
    for (const e of index) {
      lines.push({ t: "p", text: e.producer, page: e.page });
      for (const w of e.wines) lines.push({ t: "w", text: w.name, page: w.page });
      lines.push({ t: "w", text: "", page: 0 });
    }
    const slice = lines.slice(l.part * INDEX_LINES_PER_PAGE, (l.part + 1) * INDEX_LINES_PER_PAGE);
    return (
      <div style={{ padding: `${24 * MM}px ${pad}px` }}>
        <div className="text-center" style={{ fontFamily: "Times New Roman, serif", fontWeight: 700, fontSize: 32, color: INK }}>
          {l.part === 0 ? "Índice dos rótulos" : "Índice (continuação)"}
        </div>
        {l.part === 0 && <div className="text-center" style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Toque no nome do vinho para ir direto à página.</div>}
        <div style={{ marginTop: 10 * MM }}>
          {slice.map((ln, i) => (
            <div key={i} className="flex items-end gap-2" style={{ height: 5.4 * MM, fontSize: ln.t === "p" ? 13.5 : 13 }}>
              {ln.text && (ln.t === "p" ? (
                <span style={{ color: GOLD, fontWeight: 700 }}>{ln.text.toUpperCase()}</span>
              ) : (
                <>
                  <span className="truncate" style={{ color: INK, paddingLeft: 5 * MM }}>{ln.text}</span>
                  <span className="flex-1" style={{ borderBottom: "1px dotted #bbb", marginBottom: 4 }} />
                  <span style={{ color: INK }}>{ln.page}</span>
                </>
              ))}
            </div>
          ))}
        </div>
        <Footer n={n} title={title} restaurantName={restaurantName} back={false} />
      </div>
    );
  }
  if (l.kind === "producer") {
    const ws = l.wineIds.map((id) => wines.find((w) => w.id === id)).filter(Boolean) as BookWine[];
    const pageOf = (id: string) => index.flatMap((e) => e.wines).find((x) => x.id === id)?.page ?? n;
    return (
      <div className="flex flex-col items-center text-center" style={{ paddingTop: 82 * MM, paddingLeft: pad, paddingRight: pad }}>
        <div style={{ fontSize: 12, letterSpacing: 4, color: MUTED }}>PRODUTOR</div>
        <div style={{ width: 40 * MM, height: 1.5, background: GOLD, margin: "14px 0 18px" }} />
        <div style={{ fontFamily: "Times New Roman, serif", fontWeight: 700, fontSize: 40, lineHeight: 1.1, color: INK }}>{l.producer}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>{ws.length} {ws.length === 1 ? "rótulo" : "rótulos"} neste livro</div>
        <div style={{ marginTop: 28 }} className="space-y-4">
          {ws.map((w) => (
            <div key={w.id}>
              <div style={{ fontSize: 16, color: INK }}>{wineTitle(w)}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{typeLabel(w.wine_type)} · página {pageOf(w.id)}</div>
            </div>
          ))}
        </div>
        <Footer n={n} title={title} restaurantName={restaurantName} back />
      </div>
    );
  }
  const w = l.wine;
  const c = TYPE_COLOR[w.wine_type ?? ""] ?? [160, 125, 30];
  const num = index.flatMap((e) => e.wines).findIndex((x) => x.id === w.id) + 1;
  const origin = [w.region, w.country].filter(Boolean).join(" · ");
  const blocks: [string, string | null][] = [["Na taça e na boca", w.tasting_notes], ["Como é feito", w.elaboration], ["Combina com", w.pairing_notes]];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between font-bold" style={{ height: 12 * MM, background: `rgb(${c.join(",")})`, color: "#fff", padding: `0 ${pad}px`, fontSize: 12, letterSpacing: 2 }}>
        <span>{typeLabel(w.wine_type).toUpperCase()}</span>
        <span>Nº {String(num).padStart(3, "0")}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col" style={{ padding: `${8 * MM}px ${pad}px ${22 * MM}px` }}>
        <div className="text-center" style={{ color: GOLD, fontSize: 13, letterSpacing: 2 }}>{producerOf(w).toUpperCase()}</div>
        <div className="text-center" style={{ fontFamily: "Times New Roman, serif", fontWeight: 700, fontSize: 29, lineHeight: 1.15, color: INK, marginTop: 6 }}>{wineTitle(w)}</div>
        {origin && <div className="text-center" style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{origin}</div>}
        <div className="flex" style={{ gap: 8 * MM, marginTop: 7 * MM }}>
          <div className="flex shrink-0 items-center justify-center" style={{ width: 60 * MM, height: 100 * MM, border: "1px solid #e6e6e6", borderRadius: 6, padding: 3 * MM }}>
            {w.image_url ? <img src={w.image_url} alt={w.name} className="max-h-full max-w-full object-contain" /> : <span style={{ fontSize: 11, color: MUTED }}>Sem foto</span>}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden" style={{ maxHeight: 100 * MM }}>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, marginBottom: 8 }}>FICHA TÉCNICA</div>
            {techRows(w).map(([k, v]) => (
              <div key={k} className="flex" style={{ fontSize: 12, marginBottom: 6 }}>
                <span className="shrink-0 font-bold" style={{ width: 30 * MM, color: MUTED }}>{k}</span>
                <span style={{ color: INK }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden" style={{ marginTop: 8 * MM }}>
          {blocks.filter(([, t]) => t?.trim()).map(([k, t]) => (
            <div key={k} style={{ marginBottom: 6 * MM }}>
              <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, marginBottom: 4 }}>{k.toUpperCase()}</div>
              <div style={{ color: INK, fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-line" }}>{t!.trim()}</div>
            </div>
          ))}
          <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, marginBottom: 4 }}>MINHAS ANOTAÇÕES</div>
          {Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ height: 8 * MM, borderBottom: "1px solid #e1e1e1" }} />)}
        </div>
      </div>
      <Footer n={n} title={title} restaurantName={restaurantName} back />
    </div>
  );
}

export const BookPreview = forwardRef<BookPreviewHandle, { layout: Layout[]; index: BookIndexEntry[]; wines: BookWine[]; title: string; restaurantName: string }>(
  function BookPreview({ layout, index, wines, title, restaurantName }, ref) {
    const [zoom, setZoom] = useState(0.5);
    const [mode, setMode] = useState<"all" | "one">("all");
    const [cur, setCur] = useState(0);
    const scroller = useRef<HTMLDivElement>(null);
    const safeCur = Math.min(cur, Math.max(0, layout.length - 1));

    useImperativeHandle(ref, () => ({
      goTo: (i) => {
        setCur(i);
        requestAnimationFrame(() => scroller.current?.querySelector(`[data-book-page="${i}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      },
    }));

    const shown = useMemo(() => (mode === "all" ? layout.map((l, i) => [l, i] as const) : layout[safeCur] ? [[layout[safeCur], safeCur] as const] : []), [layout, mode, safeCur]);

    return (
      <div className="flex h-full flex-col rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <Button size="sm" variant={mode === "all" ? "default" : "outline"} onClick={() => setMode("all")}>Todas</Button>
          <Button size="sm" variant={mode === "one" ? "default" : "outline"} onClick={() => setMode("one")}>Uma a uma</Button>
          <Button size="icon" variant="ghost" aria-label="Página anterior" disabled={safeCur === 0} onClick={() => { setMode("one"); setCur(safeCur - 1); }}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-xs tabular-nums text-muted-foreground">Página {layout.length ? safeCur + 1 : 0} de {layout.length}</span>
          <Button size="icon" variant="ghost" aria-label="Próxima página" disabled={safeCur >= layout.length - 1} onClick={() => { setMode("one"); setCur(safeCur + 1); }}><ChevronRight className="h-4 w-4" /></Button>
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))}><ZoomOut className="h-4 w-4" /></Button>
            {[0.5, 0.75, 1].map((z) => (
              <Button key={z} size="sm" variant={zoom === z ? "default" : "ghost"} onClick={() => setZoom(z)}>{z * 100}%</Button>
            ))}
            <Button size="icon" variant="ghost" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}><ZoomIn className="h-4 w-4" /></Button>
          </div>
        </div>
        <div ref={scroller} className="flex-1 overflow-auto bg-muted/40 p-4" style={{ maxHeight: "calc(100vh - 160px)" }}>
          <div className="flex flex-col items-center gap-5">
            {shown.map(([l, i]) => (
              <div key={i} data-book-page={i} style={{ width: PAGE_W * zoom, height: PAGE_H * zoom }} className="shrink-0">
                <div className="relative overflow-hidden shadow-xl" style={{ width: PAGE_W, height: PAGE_H, background: "#fff", fontFamily: "Helvetica, Arial, sans-serif", transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                  <PageBody l={l} n={i + 1} index={index} wines={wines} title={title} restaurantName={restaurantName} />
                </div>
              </div>
            ))}
            {!layout.length && <p className="text-sm text-muted-foreground">O livro ainda não tem páginas.</p>}
          </div>
        </div>
      </div>
    );
  },
);
