import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, KeyRound, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { bookWinesQuery, pairingGuidesQuery } from "@/components/training/book-data";
import { QuickGuideViewer } from "@/components/training/QuickGuideViewer";
import { buildQuickCards, buildQuickGuidePdf, houseDishesByWine, type QuickCard } from "@/lib/quick-guide";
import { defaultPages, toDataUrl } from "@/lib/training-book";

const DEFAULT_TITLE = "Guia Rápido de Salão";

async function dataUrlToBlob(d: string) {
  return (await fetch(d)).blob();
}

export default function QuickGuideEditor({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const qc = useQueryClient();
  const { data: wines = [], isFetched } = useQuery(bookWinesQuery(restaurantId));
  const { data: guides = [] } = useQuery(pairingGuidesQuery(restaurantId));
  const { data: book } = useQuery({
    queryKey: ["training-book", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_books").select("*").eq("restaurant_id", restaurantId).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const [titleDraft, setTitle] = useState<string | null>(null);
  const title = titleDraft ?? book?.quick_title ?? DEFAULT_TITLE;
  const [busy, setBusy] = useState<string | null>(null);

  const house = useMemo(() => houseDishesByWine(guides), [guides]);
  const cards = useMemo(() => buildQuickCards(wines, house), [wines, house]);
  const imageById = useMemo(() => new Map(wines.map((w) => [w.id, w.image_url])), [wines]);
  const autoPitch = cards.filter((c) => c.pitchAuto).length;
  const withHouse = cards.filter((c) => c.houseDishes).length;

  async function build() {
    const photos = new Map<string, Awaited<ReturnType<typeof toDataUrl>>>();
    let done = 0;
    const queue = wines.filter((w) => w.image_url);
    const worker = async () => {
      while (queue.length) {
        const w = queue.shift()!;
        photos.set(w.id, await toDataUrl(w.image_url!, 700));
        setBusy(`Preparando fotos ${++done} de ${wines.filter((x) => x.image_url).length}…`);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    const final: QuickCard[] = cards.map((c) => ({ ...c, hasPhoto: !!photos.get(c.id) }));
    setBusy("Montando o PDF…");
    const blob = await buildQuickGuidePdf({ title: title.trim() || DEFAULT_TITLE, restaurantName, cards: final, photos });
    return { blob, photos, cards: final };
  }

  async function download() {
    setBusy("Montando o guia…");
    try {
      const { blob } = await build();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(title || DEFAULT_TITLE).replace(/[^\w\- ]+/g, "").trim() || "guia"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("Montando o guia…");
    try {
      const { blob, photos, cards: final } = await build();
      setBusy("Publicando para a equipe…");
      const base = `training-books/${restaurantId}`;
      const store = supabase.storage.from("product-media");
      const items = [...photos.entries()].filter(([, img]) => img);
      for (let i = 0; i < items.length; i += 6) {
        await Promise.all(
          items.slice(i, i + 6).map(async ([id, img]) => {
            const { error } = await store.upload(`${base}/guia/${id}.jpg`, await dataUrlToBlob(img!.data), { upsert: true, contentType: "image/jpeg" });
            if (error) throw error;
          }),
        );
      }
      const pdfPath = `${base}/guia-rapido.pdf`;
      const { error: upErr } = await store.upload(pdfPath, blob, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;
      const patch = {
        quick_title: title.trim() || DEFAULT_TITLE,
        quick_cards: final as never,
        quick_pdf_path: pdfPath,
        quick_published_at: new Date().toISOString(),
      };
      const { error } = book
        ? await supabase.from("training_books").update(patch).eq("restaurant_id", restaurantId)
        : await supabase.from("training_books").insert({ restaurant_id: restaurantId, pages: defaultPages(wines, () => crypto.randomUUID()) as never, ...patch });
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["training-book", restaurantId] });
      toast.success("Guia publicado. A equipe já vê esta versão pelo link de treinamento.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao publicar.");
    } finally {
      setBusy(null);
    }
  }

  if (!isFetched) return <p className="text-sm text-muted-foreground">Carregando os rótulos…</p>;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome do guia</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Button variant="outline" onClick={download} disabled={!!busy || !cards.length}>
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          <Button onClick={publish} disabled={!!busy || !cards.length}>
            <Send className="h-4 w-4" /> Publicar para a equipe
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/access-links"><KeyRound className="h-4 w-4" /> Link da equipe</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {cards.length} rótulos ·{" "}
          {book?.quick_published_at ? `publicado em ${new Date(book.quick_published_at).toLocaleString("pt-BR")}` : "ainda não publicado"}
          {busy && ` · ${busy}`}
        </p>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <p>Uma ficha curta por rótulo, com palavras-chave para o garçom consultar em segundos. O PDF abre no celular e funciona sem internet, com índice clicável.</p>
        <p>
          <b className="text-foreground">Fale assim à mesa:</b>{" "}
          {autoPitch
            ? <>{autoPitch} {autoPitch === 1 ? "rótulo ainda usa" : "rótulos ainda usam"} uma frase automática. Escreva a frase de cada vinho no <Link to="/app/wines" search={{ wine: undefined }} className="text-primary underline">cadastro do vinho</Link>, aba Características.</>
            : "todos os rótulos têm a frase escrita no cadastro."}
        </p>
        <p>
          <b className="text-foreground">Combina com:</b>{" "}
          {withHouse
            ? `${withHouse} de ${cards.length} rótulos mostram os pratos da casa da Harmonização do cardápio; os demais usam a harmonização do cadastro.`
            : "ainda não há Harmonização do cardápio salva; usamos a harmonização do cadastro de cada vinho."}
        </p>
      </div>

      {cards.length ? (
        <div className="mx-auto w-full max-w-[420px] rounded-[22px] border border-border bg-muted p-2.5">
          <QuickGuideViewer cards={cards} photoUrl={(c) => imageById.get(c.id) ?? null} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum rótulo ativo na carta.</p>
      )}
    </div>
  );
}
