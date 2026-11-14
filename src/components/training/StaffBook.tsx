import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGuestTrainingBook } from "@/lib/guest-access.functions";

export default function StaffBook({ token }: { token: string }) {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["guest-book", token],
    retry: false,
    queryFn: () => getGuestTrainingBook({ data: { token } }),
  });
  const pdfUrl = `/api/public/training-book?token=${encodeURIComponent(token)}`;
  const index = data && data.ok && data.book ? data.book.index : [];
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return index;
    return index
      .map((e) => (e.producer.toLowerCase().includes(t) ? e : { ...e, wines: e.wines.filter((w) => w.name.toLowerCase().includes(t)) }))
      .filter((e) => e.wines.length);
  }, [index, term]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Abrindo o livro…</div>;
  if (!data || !data.ok) return <div className="flex min-h-screen items-center justify-center bg-background p-6 text-sm">{(data as { message?: string })?.message ?? "Link inválido."}</div>;
  if (!data.book)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div><BookOpen className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 text-sm">O Livro de Estudos de {data.restaurantName} ainda não foi publicado.</p></div>
      </div>
    );

  const open = (p: number) => {
    setPage(p);
    if (window.innerWidth < 768) window.open(`${pdfUrl}#page=${p}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-lg uppercase tracking-[0.15em] text-primary">{data.book.title}</h1>
          <p className="text-xs text-muted-foreground">{data.restaurantName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild><a href={pdfUrl} target="_blank" rel="noreferrer"><BookOpen className="h-4 w-4" /> Abrir livro</a></Button>
          <Button size="sm" asChild><a href={`${pdfUrl}&download=1`}><Download className="h-4 w-4" /> Baixar / imprimir</a></Button>
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar vinho ou produtor…" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <div className="max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-card p-2">
            {filtered.map((e) => (
              <div key={`${e.producer}-${e.page}`} className="mb-2">
                <button type="button" onClick={() => open(e.page)} className="w-full px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wider text-primary">{e.producer}</button>
                {e.wines.map((w) => (
                  <button key={w.id} type="button" onClick={() => open(w.page)}
                    className={`flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent ${page === w.page ? "bg-accent" : ""}`}>
                    <span className="truncate">{w.name}</span><span className="text-xs text-muted-foreground">{w.page}</span>
                  </button>
                ))}
              </div>
            ))}
            {!filtered.length && <p className="p-2 text-sm text-muted-foreground">Nenhum vinho encontrado.</p>}
          </div>
        </aside>
        <iframe key={page} title="Livro de Estudos" src={`${pdfUrl}#page=${page}`} className="hidden h-[82vh] w-full rounded-xl border border-border bg-card md:block" />
      </div>
    </div>
  );
}
