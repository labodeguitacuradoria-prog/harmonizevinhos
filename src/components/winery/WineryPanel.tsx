import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Globe, Loader2, Save, Sparkles } from "lucide-react";
import { MediaGallery } from "@/components/MediaUploader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractWinery } from "@/lib/winery.functions";
import { useAuth } from "@/hooks/use-auth";

export const wineryKey = (name: string) => name.trim().toLowerCase();

type Winery = { about: string; website: string; country: string; region: string; founded: string; photos: string[] };
const EMPTY: Winery = { about: "", website: "", country: "", region: "", founded: "", photos: [] };

/** Ficha da vinícola compartilhada por todos os rótulos do mesmo produtor. */
export function WineryPanel({ producer }: { producer: string }) {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const key = wineryKey(producer);
  const extract = useServerFn(extractWinery);
  const [f, setF] = useState<Winery>(EMPTY);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<"" | "ai" | "save">("");
  const [open, setOpen] = useState(false);

  const { data: row, isFetched } = useQuery({
    queryKey: ["winery", key],
    enabled: key.length > 1,
    queryFn: async () => (await supabase.from("wineries").select("*").eq("name_key", key).maybeSingle()).data,
  });
  useEffect(() => {
    if (!isFetched) return;
    setF(row ? { about: row.about ?? "", website: row.website ?? "", country: row.country ?? "", region: row.region ?? "", founded: row.founded ?? "", photos: row.photos ?? [] } : EMPTY);
  }, [row, isFetched]);

  if (key.length < 2) return <p className="text-xs text-[#666]">Preencha o Produtor para cadastrar a vinícola.</p>;

  async function persist(next: Winery) {
    const { error } = await supabase.from("wineries").upsert(
      { name: producer.trim(), name_key: key, about: next.about || null, website: next.website || null, country: next.country || null, region: next.region || null, founded: next.founded || null, photos: next.photos },
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
      setF((p) => ({ ...p, about: d.about ?? p.about, country: d.country ?? p.country, region: d.region ?? p.region, founded: d.founded ?? p.founded, website: d.website ?? p.website }));
      toast.success("Informações extraídas. Revise e clique em Salvar vinícola.");
    } catch { toast.error("Falha ao extrair informações."); } finally { setBusy(""); }
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
      <div className="grid gap-2 md:grid-cols-3">
        <input className={inp} placeholder="País" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
        <input className={inp} placeholder="Região" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
        <input className={inp} placeholder="Fundação (ano)" value={f.founded} onChange={(e) => setF({ ...f, founded: e.target.value })} />
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
