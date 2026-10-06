import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MediaUploader } from "@/components/MediaUploader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Video = { id: string; title: string; category: string; description: string | null; video_url: string; status: string; sort_order: number; recommended_for_all: boolean };
const CATEGORIES = ["Serviço", "Estilos de vinho", "Degustação", "Harmonização", "Taças e conservação", "Atendimento"];

export default function TrainingLibraryManager({ restaurantId, admin = false, presentation = "section" }: { restaurantId?: string | null; admin?: boolean; presentation?: "section" | "dialog" }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Video> | null>(null);
  const [open, setOpen] = useState(false);
  const { data: videos = [] } = useQuery({ queryKey: ["training-library", admin], queryFn: async () => { const q = supabase.from("training_library_videos").select("*").order("sort_order"); const { data, error } = admin ? await q : await q.eq("status", "published"); if (error) throw error; return (data ?? []) as Video[]; } });
  const { data: enabled = [] } = useQuery({ queryKey: ["restaurant-training-videos", restaurantId], enabled: !!restaurantId, queryFn: async () => { const { data, error } = await supabase.from("restaurant_training_videos").select("video_id").eq("restaurant_id", restaurantId as string).eq("enabled", true); if (error) throw error; return (data ?? []).map(x => x.video_id); } });

  async function toggle(videoId: string, on: boolean) { if (!restaurantId) return; const result = on ? await supabase.from("restaurant_training_videos").upsert({ restaurant_id: restaurantId, video_id: videoId, enabled: true }, { onConflict: "restaurant_id,video_id" }) : await supabase.from("restaurant_training_videos").delete().eq("restaurant_id", restaurantId).eq("video_id", videoId); if (result.error) return toast.error(result.error.message); await qc.invalidateQueries({ queryKey: ["restaurant-training-videos", restaurantId] }); }
  async function save() { if (!editing?.title?.trim() || !editing.video_url?.trim() || !editing.category) return toast.error("Informe título, categoria e vídeo."); const payload = { title: editing.title.trim(), category: editing.category, description: editing.description ?? null, video_url: editing.video_url.trim(), status: editing.status ?? "draft", sort_order: editing.sort_order ?? videos.length, recommended_for_all: !!editing.recommended_for_all }; const result = editing.id ? await supabase.from("training_library_videos").update(payload).eq("id", editing.id) : await supabase.from("training_library_videos").insert(payload); if (result.error) return toast.error(result.error.message); setEditing(null); await qc.invalidateQueries({ queryKey: ["training-library"] }); toast.success("Vídeo salvo na biblioteca."); }
  async function remove(id: string) { if (!confirm("Excluir este vídeo da biblioteca?")) return; const { error } = await supabase.from("training_library_videos").delete().eq("id", id); if (error) return toast.error(error.message); await qc.invalidateQueries({ queryKey: ["training-library"] }); }

  const shown = admin ? videos : videos.filter(v => v.status === "published");
  const enabledCount = admin ? shown.filter(v => v.status === "published").length : enabled.length;

  const content = <section className={presentation === "dialog" ? "min-w-0" : "rounded-lg border border-border bg-card"}>
    {presentation === "section" ? <button type="button" onClick={() => setOpen(o => !o)}
      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left">
      <span className="flex items-center gap-2 text-sm font-bold uppercase text-primary">
        <BookOpen className="h-4 w-4 shrink-0" />
        <span className="truncate">{admin ? "Biblioteca de Treinamento" : "Fundamentos para a equipe"}</span>
        <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-muted-foreground">
          {admin ? `${enabledCount} publicado(s)` : `${enabledCount} de ${shown.length} ativo(s)`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {admin ? (
          <Button type="button" size="sm" variant="outline" onClick={e => { e.stopPropagation(); setEditing({ category: CATEGORIES[0], status: "draft", sort_order: videos.length }); setOpen(true); }}>
            <Plus /> Novo vídeo
          </Button>
        ) : null}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </span>
    </button> : null}
    {open || presentation === "dialog" ? (
      <div className={presentation === "dialog" ? "min-w-0" : "border-t border-border px-4 pb-4 pt-1"}>
        <p className="py-2 text-xs text-muted-foreground">{admin ? "Vídeos gerais que os restaurantes podem incluir no treinamento." : "Escolha os vídeos básicos que aparecerão no link da equipe."}</p>
        <div className="divide-y divide-border">{videos.map(video => <div key={video.id} className="flex items-start gap-3 py-2">{!admin ? <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--gold)]" checked={enabled.includes(video.id)} onChange={e => toggle(video.id, e.target.checked)} /> : null}<div className="min-w-0 flex-1"><div className="font-medium text-foreground">{video.title}</div><div className="text-xs text-muted-foreground">{video.category}{video.description ? ` · ${video.description}` : ""}</div></div>{admin ? <><Button type="button" size="sm" variant="outline" onClick={() => setEditing(video)}>Editar</Button><Button type="button" size="icon" variant="outline" aria-label="Excluir vídeo" onClick={() => remove(video.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></> : null}</div>)}{videos.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhum vídeo publicado ainda.</p> : null}</div>
        {editing ? <div className="mt-4 space-y-3 border-t border-border pt-4"><div className="grid gap-3 md:grid-cols-2"><input value={editing.title ?? ""} onChange={e => setEditing(v => ({ ...v, title: e.target.value }))} placeholder="Título" className="rounded-md border border-input bg-background px-3 py-2 text-sm" /><select value={editing.category ?? CATEGORIES[0]} onChange={e => setEditing(v => ({ ...v, category: e.target.value }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><textarea value={editing.description ?? ""} onChange={e => setEditing(v => ({ ...v, description: e.target.value }))} placeholder="Descrição curta" className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" /></div><input value={editing.video_url ?? ""} onChange={e => setEditing(v => ({ ...v, video_url: e.target.value }))} placeholder="URL do vídeo" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><MediaUploader label="Ou envie um arquivo" value={/\.(mp4|webm|mov)(\?|$)/i.test(editing.video_url ?? "") ? editing.video_url ?? null : null} onChange={url => setEditing(v => ({ ...v, video_url: url ?? "" }))} folder="training-library" accept="video/*" kind="file" /><div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={editing.status === "published"} onChange={e => setEditing(v => ({ ...v, status: e.target.checked ? "published" : "draft" }))} /> Publicado</label><label><input type="checkbox" checked={!!editing.recommended_for_all} onChange={e => setEditing(v => ({ ...v, recommended_for_all: e.target.checked }))} /> Recomendado para todos</label></div><div className="flex gap-2"><Button type="button" onClick={save}>Salvar</Button><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button></div></div> : null}
      </div>
    ) : null}
  </section>;

  if (presentation === "section") return content;

  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) setEditing(null); }}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline"><BookOpen /> Biblioteca de Treinamento</Button>
    </DialogTrigger>
    <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto no-scrollbar" aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle className="pr-6 text-primary">Biblioteca de Treinamento</DialogTitle>
      </DialogHeader>
      {admin ? <div><Button type="button" size="sm" onClick={() => setEditing({ category: CATEGORIES[0], status: "draft", sort_order: videos.length })}><Plus /> Novo vídeo</Button></div> : null}
      {content}
    </DialogContent>
  </Dialog>;
}