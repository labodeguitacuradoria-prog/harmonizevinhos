import type React from "react";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Home, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  INDEX_LINES_PER_PAGE, bodyDots, clean, producerAbout, producerMap, producerOf, studyCard, typeBand, typeKey, typeLabel, wineName, wineTitle,
  type BookIndexEntry, type BookWine, type Layout,
} from "@/lib/training-book";
import { computeWineryMap, loadCountries, svgDataUrl, wineryMapSvg } from "@/lib/winery-map";

// Simulação do papel impresso: as cores abaixo reproduzem o PDF (papel branco), não o tema da tela.
const PAGE_W = 794; // 210mm @96dpi
const PAGE_H = 1123; // 297mm
const MM = PAGE_W / 210;
const GOLD = "rgb(160,125,30)";
const INK = "rgb(35,35,35)";
const MUTED = "rgb(120,120,120)";

export type BookPreviewHandle = { goTo: (layoutIndex: number) => void };

function CustomImage({ path }: { path: string }) {
  const external = /^https?:\/\//.test(path);
  const { data: signed } = useQuery({
    queryKey: ["book-page-url", path],
    enabled: !external,
    staleTime: 8 * 60 * 1000,
    queryFn: async () => (await supabase.storage.from("product-media").createSignedUrl(path, 600)).data?.signedUrl ?? null,
  });
  const data = external ? path : signed;
  return data ? <img src={data} alt="" className="h-full w-full object-contain" /> : <div className="m-auto text-xs" style={{ color: MUTED }}>Carregando página…</div>;
}

/** Imagem do mapa salva no cadastro da vinícola (redesenhada se ainda não houver imagem salva). */
function ProducerMapImage({ map }: { map: NonNullable<ReturnType<typeof producerMap>> }) {
  const { data: shapes } = useQuery({ queryKey: ["country-shapes"], staleTime: Infinity, enabled: !map.svg, queryFn: loadCountries });
  const shape = shapes?.[map.iso3];
  const svg = map.svg ?? (shape ? wineryMapSvg(computeWineryMap(shape, { lat: map.lat, lng: map.lng, name: map.name, side: map.side })) : null);
  return svg ? <img src={svgDataUrl(svg)} alt={`Mapa com a localização de ${map.name}`} className="block h-auto w-full" /> : null;
}

function Footer({ n, title, restaurantName, back }: { n: number; title: string; restaurantName: string; back: boolean }) {
  return (
    <div className="absolute grid items-center" style={{ gridTemplateColumns: "1fr auto 1fr", left: 18 * MM, right: 18 * MM, bottom: 6 * MM, borderTop: "1px solid #ddd", paddingTop: 7, fontSize: 13.5, color: MUTED }}>
      <span className="truncate">{title} · {restaurantName}</span>
      <span style={{ fontWeight: 700 }}>{n}</span>
      <span className="flex justify-end">{back && <Home size={20} color={GOLD} aria-label="Índice" />}</span>
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
      <div className="flex flex-col items-center text-center" style={{ paddingTop: 42 * MM, paddingLeft: pad, paddingRight: pad }}>
        {ws.find((w) => w.winery_photo)?.winery_photo && (
          <div style={{ width: 120 * MM, height: 50 * MM, marginTop: -30 * MM, marginBottom: 10 * MM, overflow: "hidden", borderRadius: 8 }}>
            <CustomImage path={ws.find((w) => w.winery_photo)!.winery_photo!} />
          </div>
        )}
        <div style={{ fontSize: 12, letterSpacing: 4, color: MUTED }}>PRODUTOR</div>
        <div style={{ width: 40 * MM, height: 1.5, background: GOLD, margin: "14px 0 18px" }} />
        <div style={{ fontFamily: "Times New Roman, serif", fontWeight: 700, fontSize: 40, lineHeight: 1.1, color: INK }}>{l.producer}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>{ws.length} {ws.length === 1 ? "rótulo" : "rótulos"} neste livro</div>
        {(() => { const about = producerAbout(ws); return about ? (
          <div style={{ marginTop: 26, maxWidth: 150 * MM }}>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>SOBRE A VINÍCOLA</div>
            <div style={{ color: INK, fontSize: 13, lineHeight: 1.55 }}>{about}</div>
          </div>) : null; })()}
        {(() => {
          const pmap = producerMap(ws, l.producer);
          const list = (align: "center" | "left") => (
            <div className="space-y-4" style={{ textAlign: align }}>
              {ws.map((w) => (
                <div key={w.id}>
                  <div style={{ fontSize: 16, color: INK }}>{wineTitle(w)}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{typeLabel(w.wine_type)} · página {pageOf(w.id)}</div>
                </div>
              ))}
            </div>
          );
          if (!pmap) return <div style={{ marginTop: 28 }}>{list("center")}</div>;
          return (
            <div className="flex w-full items-start" style={{ marginTop: 28, gap: 8 * MM, textAlign: "left" }}>
              <div style={{ width: 84 * MM }} className="shrink-0">
                <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 2, marginBottom: 4 }}>ONDE FICA</div>
                <ProducerMapImage map={pmap} />
              </div>
              <div className="min-w-0 flex-1" style={{ paddingTop: 18 }}>{list("left")}</div>
            </div>
          );
        })()}
        <Footer n={n} title={title} restaurantName={restaurantName} back />
      </div>
    );
  }
  const w = l.wine;
  const card = studyCard(w);
  const band = typeBand(w.wine_type);
  const rgb = (c: number[]) => `rgb(${c.join(",")})`;
  const col = rgb(band.accent);
  const soft = `rgba(${band.accent.join(",")},0.14)`;
  const DARK = "rgb(38,52,44)";
  const label = (t: string) => <div style={{ color: GOLD, fontWeight: 700, fontSize: 15, letterSpacing: 1.5, marginBottom: 9 }}>{t}</div>;
  const dots = bodyDots(w.body);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-start" style={{ fontSize: 14.5, padding: "7px 0", borderBottom: "1px dotted #ccc", lineHeight: 1.35 }}>
      <span className="shrink-0 font-bold" style={{ width: 27 * MM, color: MUTED }}>{k}</span><span style={{ color: INK }}>{v}</span>
    </div>
  );
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between font-bold" style={{ height: 15 * MM, background: rgb(band.bg), color: rgb(band.fg), padding: `0 ${pad}px`, fontSize: 15, letterSpacing: 2 }}>
        <span>🍷 {card.header}</span>
        {card.code && <span style={{ background: "#fff", color: rgb(typeKey(w.wine_type) === "sparkling" ? band.fg : band.bg), borderRadius: 99, padding: "4px 14px", fontSize: 14.5 }}>Nº {card.code}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ padding: `${8 * MM}px ${pad}px ${20 * MM}px` }}>
        <div className="flex" style={{ gap: 8 * MM }}>
          <div className="flex shrink-0 items-center justify-center" style={{ width: 64 * MM, height: 96 * MM, border: "1px solid #e4e4e4", borderRadius: 10, padding: 4 * MM, boxShadow: "0 4px 14px rgba(0,0,0,.08)", background: "#fff" }}>
            {w.image_url ? <img src={w.image_url} alt={w.name} className="max-h-full max-w-full object-contain" /> : <span style={{ fontSize: 13, color: MUTED }}>Sem foto</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ color: GOLD, fontWeight: 700, fontSize: 14.5, letterSpacing: 1.5 }}>{producerOf(w).toUpperCase()}</div>
            <div style={{ fontFamily: "Times New Roman, serif", fontWeight: 700, fontSize: 33, lineHeight: 1.1, color: DARK, marginTop: 8 }}>{wineName(w)}</div>
            {(w.country || w.region) && <div style={{ fontSize: 16.5, fontWeight: 700, color: INK, marginTop: 10 }}>{[w.country, w.region].filter(Boolean).join(" • ")}</div>}
            {w.appellation && <div style={{ fontSize: 14, color: MUTED, marginTop: 3 }}>{clean(w.appellation)}</div>}
            {card.price && <div style={{ fontSize: 24, fontWeight: 700, color: col, marginTop: 10 }}>{card.price}</div>}
            <div className="flex flex-wrap" style={{ gap: 7, marginTop: 12 }}>
              {card.grapes.slice(0, 6).map((g) => <span key={g} style={{ background: DARK, color: "#fff", borderRadius: 99, padding: "4px 13px", fontSize: 14 }}>{g}</span>)}
            </div>
            <div style={{ marginTop: 12 }}>
              {w.body && row("Corpo", <span className="flex items-center gap-2"><span style={{ color: col, letterSpacing: 2, fontSize: 16 }}>{"●".repeat(dots)}{"○".repeat(5 - dots)}</span>{clean(w.body).toLowerCase()}</span>)}
              {w.sugar_level && row("Açúcar", clean(w.sugar_level).toLowerCase())}
              {card.maturation && row("Maturação", card.maturation)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 9 * MM }} className="flex flex-col" >
          {card.aromas.length > 0 && <div style={{ marginBottom: 6 * MM }}>{label("👃 AROMAS")}
            <div className="flex flex-wrap" style={{ gap: 8 }}>{card.aromas.map((a) => <span key={a.label} style={{ border: `1px solid ${col}`, borderRadius: 99, padding: "5px 14px", fontSize: 15, color: INK }}>{a.icon} {a.label}</span>)}</div></div>}
          {card.mouth && <div style={{ marginBottom: 6 * MM }}>{label("🍷 PALADAR")}<div style={{ fontSize: 16.5, color: INK, lineHeight: 1.4 }}>{card.mouth}</div></div>}
          {(card.temp || card.dishes.length > 0) && <div className="flex" style={{ gap: 8 * MM, marginBottom: 6 * MM }}>
            {card.temp && <div style={{ width: "28%" }}>{label("🌡️ SERVIR A")}<div style={{ fontSize: 21, fontWeight: 700, color: INK }}>{card.temp}</div></div>}
            {card.dishes.length > 0 && <div className="flex-1">{label("🍽️ COMBINA COM")}<div className="flex flex-wrap" style={{ gap: 8 }}>{card.dishes.map((d) => <span key={d} style={{ background: soft, borderRadius: 99, padding: "5px 14px", fontSize: 15, color: INK }}>{d}</span>)}</div></div>}
          </div>}
          <div style={{ border: `1px solid ${DARK}`, borderRadius: 8, padding: "14px 18px", background: "#fcfcfa", marginBottom: 5 * MM }}>
            {label("💬 FALE ASSIM À MESA")}<div style={{ fontStyle: "italic", fontSize: 16.5, color: INK, lineHeight: 1.4 }}>“{card.say}”</div>
          </div>
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
