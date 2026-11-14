import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Globe, Loader2, LocateFixed, MapPin, Save, Sparkles } from "lucide-react";
import { MediaGallery } from "@/components/MediaUploader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractWinery, geocodeWinery } from "@/lib/winery.functions";
import { computeWineryMap, countryBounds, insideCountry, loadCountries, resolveCountry, wineryMapSvg, type LabelSide } from "@/lib/winery-map";
import { WineryMap } from "@/components/winery/WineryMap";
import { useAuth } from "@/hooks/use-auth";

export const wineryKey = (name: string) => name.trim().toLowerCase();

type Winery = {
  about: string; website: string; country: string; region: string; city: string; founded: string; photos: string[];
  lat: number | null; lng: number | null; side: LabelSide; source: "auto" | "manual" | null; locLabel: string;
};
const EMPTY: Winery = { about: "", website: "", country: "", region: "", city: "", founded: "", photos: [], lat: null, lng: null, side: "auto", source: null, locLabel: "" };

/** Ficha da vinícola compartilhada por todos os rótulos do mesmo produtor. */
export function WineryPanel({ producer, country = "", region = "" }: { producer: string; country?: string; region?: string }) {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const key = wineryKey(producer);
  const extract = useServerFn(extractWinery);
  const geocode = useServerFn(geocodeWinery);
  const { data: shapes } = useQuery({ queryKey: ["country-shapes"], staleTime: Infinity, queryFn: loadCountries });
  const autoTried = useRef("");
  const [f, setF] = useState<Winery>(EMPTY);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<"" | "ai" | "save" | "geo">("");
  const [open, setOpen] = useState(false);

  const { data: row, isFetched } = useQuery({
    queryKey: ["winery", key],
    enabled: key.length > 1,
    queryFn: async () => (await supabase.from("wineries").select("*").eq("name_key", key).maybeSingle()).data,
  });
  useEffect(() => {
    if (!isFetched) return;
    setF(row ? {
      about: row.about ?? "", website: row.website ?? "", country: row.country || country, region: row.region || region, city: row.city ?? "", founded: row.founded ?? "", photos: row.photos ?? [],
      lat: row.latitude, lng: row.longitude, side: (row.map_label_side as LabelSide) ?? "auto", source: (row.location_source as Winery["source"]) ?? null, locLabel: row.location_label ?? "",
    } : { ...EMPTY, country, region });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, isFetched]);

  const name = producer.trim();
  const iso3 = resolveCountry(f.country);
  const shape = iso3 && shapes ? shapes[iso3] : null;
  const outside = !!shape && f.lat != null && f.lng != null && !insideCountry(shape, f.lat, f.lng);

  // Opção A: localiza automaticamente assim que houver país e ainda não houver ponto.
  useEffect(() => {
    if (!open || !isFetched || !shape || f.lat != null || busy) return;
    const k = iso3 ?? "";
    if (autoTried.current === k) return;
    autoTried.current = k;
    void locate(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isFetched, shape, f.lat]);

  if (key.length < 2) return <p className="text-xs text-[#666]">Preencha o Produtor para cadastrar a vinícola.</p>;

  async function persist(next: Winery) {
    const iso = resolveCountry(next.country);
    const shp = iso && shapes ? shapes[iso] : null;
    const hasPoint = next.lat != null && next.lng != null;
    const svg = shp && hasPoint ? wineryMapSvg(computeWineryMap(shp, { lat: next.lat!, lng: next.lng!, name, side: next.side })) : null;
    const { error } = await supabase.from("wineries").upsert(
      {
        name, name_key: key, about: next.about || null, website: next.website || null, country: next.country || null, region: next.region || null,
        city: next.city || null, founded: next.founded || null, photos: next.photos,
        latitude: hasPoint ? next.lat : null, longitude: hasPoint ? next.lng : null, map_country: hasPoint ? iso : null,
        map_label_side: next.side, location_source: hasPoint ? next.source : null, location_label: hasPoint ? next.locLabel || null : null, map_svg: svg,
      },
      { onConflict: "name_key" },
    );
    if (error) throw new Error(error.message);
    qc.invalidateQueries({ queryKey: ["winery", key] });
    qc.invalidateQueries({ queryKey: ["book-wines"] });
  }
  async function save() {
    setBusy("save");
    try { await persist(f); toast.success("Vinícola salva — vale para todos os rótulos deste produtor."); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  }
  async function runAi() {
    setBusy("ai");
    try {
      const r = await extract({ data: { producer: producer.trim(), url: f.website.trim() || undefined, text: pasted.trim() || undefined } });
      if (!r.ok) { toast.error(r.error); return; }
      const d = r.data;
      const next = { ...f, about: d.about ?? f.about, country: d.country ?? f.country, region: d.region ?? f.region, city: d.city ?? f.city, founded: d.founded ?? f.founded, website: d.website ?? f.website };
      setF(next);
      toast.success("Informações extraídas. Revise e clique em Salvar vinícola.");
      if (next.lat == null && resolveCountry(next.country)) { autoTried.current = resolveCountry(next.country)!; setBusy(""); await locate(next); }
    } catch { toast.error("Falha ao extrair informações."); } finally { setBusy(""); }
  }
  async function locate(base: Winery) {
    const iso = resolveCountry(base.country);
    const shp = iso && shapes ? shapes[iso] : null;
    if (!shp) { toast.error("Preencha o País (ex.: Brasil, Chile, França) para gerar o mapa."); return; }
    setBusy("geo");
    try {
      const r = await geocode({ data: { name, city: base.city.trim() || undefined, region: base.region.trim() || undefined, country: base.country.trim(), iso2: shp.iso2.length === 2 ? shp.iso2 : undefined, bbox: countryBounds(shp) } });
      if (!r.ok) { toast.error(r.error); return; }
      const next: Winery = { ...base, lat: r.data.lat, lng: r.data.lng, source: "auto", locLabel: `${r.data.precision}: ${r.data.label}` };
      setF(next);
      await persist(next);
      toast.success(r.data.precision === "vinícola" ? "Vinícola localizada no mapa." : `Ponto marcado pela ${r.data.precision}. Ajuste no mapa se quiser.`);
    } catch { toast.error("Falha ao localizar. Clique no mapa para marcar o ponto."); } finally { setBusy(""); }
  }
  async function moveTo(p: { lat: number; lng: number }) {
    const next: Winery = { ...f, lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5), source: "manual", locLabel: "ajustado manualmente" };
    setF(next);
    try { await persist(next); toast.success("Localização ajustada e salva."); } catch (e) { toast.error((e as Error).message); }
  }
  async function setSide(side: LabelSide) {
    const next = { ...f, side };
    setF(next);
    try { await persist(next); } catch (e) { toast.error((e as Error).message); }
  }
  async function setPhotos(photos: string[]) {
    const next = { ...f, photos };
    setF(next);
    try { await persist(next); } catch (e) { toast.error((e as Error).message); }
  }

  const filled = !!(f.about.trim() || f.photos.length);
  const inp = "w-full rounded border border-[#2a2a2a] bg-[#0b0b0b] px-2 py-1.5 text-sm text-white focus:border-[#D4AF37] outline-none";
  return (
    <div className="rounded-lg border border-[#D4AF37]/40 bg-[#141414] md:col-span-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 p-3 text-left">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Sobre a vinícola · {producer}</span>
        <span className="flex items-center gap-2 text-[10px] text-[#888]">
          {filled ? <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">Preenchida{f.photos.length ? ` · ${f.photos.length} foto${f.photos.length > 1 ? "s" : ""}` : ""}</span> : <span>Não preenchida</span>}
          <ChevronDown className={`h-4 w-4 text-[#D4AF37] transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="space-y-3 border-t border-[#2a2a2a] p-3">
      <p className="text-[10px] text-[#888]">Compartilhado por todos os rótulos deste produtor.</p>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <input className={inp} placeholder="Site da vinícola (página Sobre / História)" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        <button type="button" onClick={runAi} disabled={!!busy} className="flex items-center justify-center gap-1 rounded border border-[#D4AF37] px-3 py-1.5 text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black disabled:opacity-50">
          {busy === "ai" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Extrair com IA
        </button>
      </div>
      <textarea className={inp} rows={2} placeholder="Opcional: cole aqui um texto sobre a vinícola (ficha técnica, catálogo) para a IA usar" value={pasted} onChange={(e) => setPasted(e.target.value)} />
      <div className="grid gap-2 md:grid-cols-4">
        <input className={inp} placeholder="País" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
        <input className={inp} placeholder="Região" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
        <input className={inp} placeholder="Cidade" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        <input className={inp} placeholder="Fundação (ano)" value={f.founded} onChange={(e) => setF({ ...f, founded: e.target.value })} />
      </div>
      <div className="rounded-lg border border-[#2a2a2a] bg-[#0b0b0b] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]"><MapPin className="h-3 w-3" /> Localização no mapa</span>
          <div className="flex flex-wrap items-center gap-1">
            {(["auto", "left", "right"] as const).map((s) => (
              <button key={s} type="button" disabled={!shape || f.lat == null} onClick={() => setSide(s)} className={`rounded border px-2 py-1 text-[10px] font-bold uppercase disabled:opacity-40 ${f.side === s ? "border-[#D4AF37] text-[#D4AF37]" : "border-[#2a2a2a] text-[#888] hover:border-[#D4AF37]"}`}>
                {s === "auto" ? "Nome: auto" : s === "left" ? "À esquerda" : "À direita"}
              </button>
            ))}
            <button type="button" onClick={() => locate(f)} disabled={!!busy || !shape} className="flex items-center gap-1 rounded border border-[#D4AF37] px-2 py-1 text-[10px] font-bold uppercase text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black disabled:opacity-40">
              {busy === "geo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />} Localizar automaticamente
            </button>
          </div>
        </div>
        {!f.country.trim() ? (
          <p className="text-xs text-[#666]">Preencha o País (e, se souber, Região e Cidade) para gerar o mapa automaticamente.</p>
        ) : !iso3 ? (
          <p className="text-xs text-[#888]">País “{f.country}” ainda não disponível no mapa. Use o nome em português, ex.: Brasil, Chile, França, Itália.</p>
        ) : !shape ? (
          <p className="flex items-center gap-1 text-xs text-[#888]"><Loader2 className="h-3 w-3 animate-spin" /> Carregando mapa…</p>
        ) : f.lat == null || f.lng == null ? (
          <p className="flex items-center gap-1 text-xs text-[#888]">{busy === "geo" ? <><Loader2 className="h-3 w-3 animate-spin" /> Localizando a vinícola…</> : "Clique em Localizar automaticamente."}</p>
        ) : (
          <>
            <div className="mx-auto max-w-md rounded-md bg-white p-2"><WineryMap shape={shape} lat={f.lat} lng={f.lng} name={name} side={f.side} onMove={moveTo} /></div>
            <p className="mt-2 text-[10px] text-[#888]">
              {f.source === "manual" ? "Ponto ajustado manualmente." : `Ponto automático (${f.locLabel || "localização"}).`} Clique ou arraste no mapa para ajustar — salva na hora e vale para o Livro de Estudos.
            </p>
            {outside && <p className="mt-1 text-[10px] text-amber-400">O ponto está fora de {shape.pt ?? f.country}. Clique em Localizar automaticamente.</p>}
          </>
        )}
      </div>
      <textarea className={inp} rows={5} placeholder="História da vinícola — aparece na página do produtor no Livro de Estudos" value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} />
      <div>
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Fotos da vinícola</span>
        <MediaGallery label="" values={f.photos} onChange={setPhotos} folder={restaurantId ? `wines/${restaurantId}/wineries` : "catalog/wineries"} />
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-[#666]"><Globe className="h-3 w-3" /> A primeira foto ilustra a página do produtor no livro.</span>
        <button type="button" onClick={save} disabled={!!busy} className="flex items-center gap-1 rounded bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50">
          {busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar vinícola
        </button>
      </div>
      </div>}
    </div>
  );
}
