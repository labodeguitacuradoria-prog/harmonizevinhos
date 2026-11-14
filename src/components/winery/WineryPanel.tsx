import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, ImagePlus, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractWinery } from "@/lib/winery.functions";
import { useAuth } from "@/hooks/use-auth";

export const wineryKey = (name: string) => name.trim().toLowerCase();

type Winery = { about: string; website: string; country: string; region: string; founded: string; photos: string[] };
const EMPTY: Winery = { about: "", website: "", country: "", region: "", founded: "", photos: [] };

function Photo({ path, onRemove }: { path: string; onRemove: () => void }) {
  const { data } = useQuery({
    queryKey: ["winery-photo", path],
    staleTime: 8 * 60 * 1000,
    queryFn: async () => (await supabase.storage.from("product-media").createSignedUrl(path, 600)).data?.signedUrl ?? null,
  });
  return (
    <div className="relative h-20 w-28 overflow-hidden rounded border border-[#2a2a2a] bg-black">
      {data && <img src={data} alt="Foto da vinícola" className="h-full w-full object-cover" />}
      <button type="button" onClick={onRemove} aria-label="Remover foto" className="absolute right-1 top-1 rounded bg-black/70 p-1 text-red-400"><Trash2 className="h-3 w-3" /></button>
    </div>
  );
}

/** Ficha da vinícola compartilhada por todos os rótulos do mesmo produtor. */
export function WineryPanel({ producer }: { producer: string }) {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const key = wineryKey(producer);
  const extract = useServerFn(extractWinery);
  const [f, setF] = useState<Winery>(EMPTY);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<"" | "ai" | "save" | "photo">("");
  const picker = useRef<HTMLInputElement>(null);

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
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("photo");
    try {
      const added: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${restaurantId ? `wines/${restaurantId}` : "catalog"}/wineries/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-media").upload(path, file, { contentType: file.type || undefined });
        if (error) throw new Error(error.message);
        added.push(path);
      }
      const next = { ...f, photos: [...f.photos, ...added] };
      setF(next);
      await persist(next);
      toast.success("Fotos adicionadas.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); if (picker.current) picker.current.value = ""; }
  }

  const inp = "w-full rounded border border-[#2a2a2a] bg-[#0b0b0b] px-2 py-1.5 text-sm text-white focus:border-[#D4AF37] outline-none";
  return (
    <div className="space-y-3 rounded-lg border border-[#D4AF37]/40 bg-[#141414] p-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Sobre a vinícola · {producer}</span>
        <span className="text-[10px] text-[#888]">Compartilhado por todos os rótulos deste produtor</span>
      </div>
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
      <div className="flex flex-wrap items-center gap-2">
        {f.photos.map((p) => (
          <Photo key={p} path={p} onRemove={() => setF({ ...f, photos: f.photos.filter((x) => x !== p) })} />
        ))}
        <button type="button" onClick={() => picker.current?.click()} disabled={!!busy} className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded border border-dashed border-[#2a2a2a] text-[10px] text-[#888] hover:border-[#D4AF37] hover:text-[#D4AF37]">
          {busy === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Fotos da vinícola
        </button>
        <input ref={picker} type="file" multiple accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => upload(e.target.files)} />
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-[#666]"><Globe className="h-3 w-3" /> A primeira foto ilustra a página do produtor no livro.</span>
        <button type="button" onClick={save} disabled={!!busy} className="flex items-center gap-1 rounded bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50">
          {busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar vinícola
        </button>
      </div>
    </div>
  );
}
