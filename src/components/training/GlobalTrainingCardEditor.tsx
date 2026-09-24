import { useEffect, useState } from "react";
import { Eye, FileText, Save, Sparkles } from "lucide-react";
import { prefillTrainingFromWine } from "@/lib/training-prefill";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateGlobalTrainingCard, saveGlobalTrainingCard } from "@/lib/global-training.functions";
import StoryCard, { type StoryCardData } from "./StoryCard";
import { normalizedBottleBlob } from "./NormalizedBottleImage";
import { TrainingTextarea } from "./TrainingRichText";
import { Button } from "@/components/ui/button";

const EMPTY = { compact_summary: "", grapes_line: "", making_line: "", origin_story: "", name_meaning: "", mouthfeel: "", pairings: [] as string[], sales_pitch: "", fun_fact: "", do_not_confuse: "" };

export default function GlobalTrainingCardEditor({ wine }: { wine: StoryCardData & { id?: string } }) {
  const [draft, setDraft] = useState(EMPTY);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [busy, setBusy] = useState(false);
  const catalogId = wine.id;

  const [saved, setSaved] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!catalogId) { setDraft(prefillTrainingFromWine(wine)); return; }
    void supabase.from("global_wine_story_cards").select("*").eq("catalog_id", catalogId).maybeSingle().then(({ data }) => {
      if (!data) { setDraft(prefillTrainingFromWine(wine)); setSaved(false); setSavedImageUrl(null); return; }
      setSaved(true);
      setSavedImageUrl(data.image_url ?? null);
      setDraft({ compact_summary: data.compact_summary ?? "", grapes_line: data.grapes_line ?? "", making_line: data.making_line ?? "", origin_story: data.origin_story ?? "", name_meaning: data.name_meaning ?? "", mouthfeel: data.mouthfeel ?? "", pairings: data.pairings ?? [], sales_pitch: data.sales_pitch ?? "", fun_fact: data.fun_fact ?? "", do_not_confuse: data.do_not_confuse ?? "" });
      setStatus(data.status as "draft" | "published");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogId]);

  function fillFromRecord() {
    const pre = prefillTrainingFromWine(wine);
    setDraft((d) => {
      const out: any = { ...d };
      for (const [k, v] of Object.entries(pre)) {
        const cur = (d as any)[k];
        const empty = Array.isArray(cur) ? cur.length === 0 : !String(cur ?? "").trim();
        if (empty) out[k] = v;
      }
      return out;
    });
    toast.success("Campos vazios preenchidos com os dados do cadastro.");
  }

  async function generate() {
    if (!catalogId) return toast.error("Salve o rótulo antes de criar a ficha.");
    setBusy(true);
    try { setDraft(await generateGlobalTrainingCard({ data: { catalog_id: catalogId } })); setStatus("draft"); setSaved(true); toast.success("Ficha global criada como rascunho."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao gerar ficha."); }
    finally { setBusy(false); }
  }

  async function save(nextStatus: "draft" | "published") {
    if (!catalogId) return toast.error("Salve o rótulo antes de criar a ficha.");
    setBusy(true);
    try {
      let imageUrl = savedImageUrl;
      if (wine.image_url) {
        const blob = await normalizedBottleBlob(wine.image_url);
        if (!blob) throw new Error("Não foi possível padronizar a imagem deste rótulo. Verifique a imagem principal e tente novamente.");
        const path = `catalog/training-images/${catalogId}.jpg`;
        const { error: uploadError } = await supabase.storage.from("product-media").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true });
        if (uploadError) throw uploadError;
        imageUrl = `/api/public/catalog-file?path=${encodeURIComponent(path)}`;
      }
      await saveGlobalTrainingCard({ data: { catalog_id: catalogId, status: nextStatus, image_url: imageUrl, ...draft } });
      setSavedImageUrl(imageUrl);
      setStatus(nextStatus); setSaved(true); toast.success(nextStatus === "published" ? "Ficha global publicada com a imagem padronizada." : "Rascunho e imagem padronizada salvos.");
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar ficha."); }
    finally { setBusy(false); }
  }

  const fields = [["grapes_line", "Uvas"], ["making_line", "Como é feito"], ["origin_story", "De onde vem"], ["name_meaning", "Por que esse nome"], ["mouthfeel", "Como é na boca"], ["sales_pitch", "Fale assim na mesa"], ["fun_fact", "Curiosidade"], ["do_not_confuse", "Não confunda"]] as const;
  return <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase text-primary">Ficha global · {!saved ? "Não salva (pré-preenchida com o cadastro)" : status === "published" ? "Publicada" : "Rascunho"}</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={fillFromRecord} disabled={busy}><FileText /> Usar dados do cadastro</Button><Button type="button" size="sm" variant="outline" onClick={generate} disabled={busy}><Sparkles /> Aprimorar com IA</Button></div></div>
      <label className="block text-xs font-semibold text-primary">Resumo para apresentar ao cliente<TrainingTextarea value={draft.compact_summary} onChange={(value) => setDraft(d => ({ ...d, compact_summary: value }))} rows={4} className="w-full rounded-md border border-primary/50 bg-background p-2 text-base text-foreground" /></label>
      <div className="grid gap-2 md:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="text-xs text-muted-foreground">{label}<TrainingTextarea value={draft[key]} onChange={(value) => setDraft(d => ({ ...d, [key]: value }))} rows={2} className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground" /></label>)}</div>
      <label className="block text-xs text-muted-foreground">Combina com (um prato por linha)<textarea value={draft.pairings.join("\n")} onChange={(e) => setDraft(d => ({ ...d, pairings: e.target.value.split("\n").filter(Boolean).slice(0, 5) }))} rows={3} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground" /></label>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => save("draft")} disabled={busy}><Save /> Salvar rascunho global</Button><Button type="button" onClick={() => save("published")} disabled={busy}><Eye /> Publicar ficha global</Button></div>
    </div>
    <div><div className="mb-2 text-xs font-bold uppercase text-primary">Como o staff verá</div><div className="h-[620px]"><StoryCard card={{ ...wine, ...draft, image_url: savedImageUrl || wine.image_url }} /></div></div>
  </div>;
}