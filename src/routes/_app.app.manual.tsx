import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, CheckCircle2, Download, MapPin, Lightbulb, Wine, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EXAMPLE_MENU, EXAMPLE_RESTAURANT, MANUAL_PDF_URL, MANUAL_REVISION, MANUAL_VERSION,
  PRINTED_MENU_FAQ, PRINTED_MENU_STEPS,
} from "@/lib/manual/printed-menu-manual";

export const Route = createFileRoute("/_app/app/manual")({
  head: () => ({
    meta: [
      { title: "Manual de operação — Impressão de Cartas | La Bodeguita" },
      { name: "description", content: "Passo a passo didático para montar, salvar e imprimir a carta de vinhos, com a carta do Sabor da Terra como exemplo." },
      { property: "og:title", content: "Manual de operação — Impressão de Cartas" },
      { property: "og:description", content: "Aprenda a criar sua carta de vinhos impressa passo a passo." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManualPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR");

function ManualPage() {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const total = PRINTED_MENU_STEPS.length;
  const count = Object.values(done).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Manual de operação · Módulo 1</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold uppercase tracking-[2px] text-primary">
            <BookOpen className="h-5 w-5" /> Impressão de Cartas
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Versão {MANUAL_VERSION} · revisado em {MANUAL_REVISION}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={MANUAL_PDF_URL} download><Download /> Baixar PDF</a>
          </Button>
          <Button asChild size="sm">
            <Link to="/app/wine-menu"><ExternalLink /> Abrir a Carta</Link>
          </Button>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase text-primary">Como usar este manual</h2>
        <p className="text-sm leading-relaxed">
          Vamos montar juntos a carta do <b>{EXAMPLE_RESTAURANT}</b>: 21 itens em 5 seções. Siga os passos na ordem,
          faça o exemplo no aplicativo e marque <b>Feito</b> quando o resultado bater com o "Confira".
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(count / total) * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{count} de {total} passos concluídos</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-primary">
          <Wine className="h-4 w-4" /> A carta de exemplo
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {EXAMPLE_MENU.map((s) => (
            <div key={s.title}>
              <p className="mb-1 border-b border-border pb-1 text-xs font-semibold uppercase text-primary">{s.title}</p>
              <ul className="space-y-0.5 text-sm">
                {s.wines.map((w) => (
                  <li key={w.n} className="flex gap-2">
                    <span className="w-5 text-right tabular-nums text-muted-foreground">{w.n}</span>
                    <span className="flex-1">{w.name} <span className="text-muted-foreground">· {w.country}</span></span>
                    <span className="tabular-nums">{brl(w.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <ol className="space-y-4">
        {PRINTED_MENU_STEPS.map((s, i) => (
          <li key={s.title} className={`rounded-xl border bg-card p-5 ${done[i] ? "border-primary" : "border-border"}`}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">
                <span className="mr-2 text-primary tabular-nums">Passo {i + 1}.</span>{s.title}
              </h2>
              <Button size="sm" variant={done[i] ? "default" : "outline"} onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}>
                <CheckCircle2 /> {done[i] ? "Feito" : "Marcar feito"}
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{s.goal}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary"><MapPin className="h-3.5 w-3.5" /> {s.where}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
              {s.actions.map((a) => <li key={a}>{a}</li>)}
            </ol>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase text-primary">Exemplo · Sabor da Terra</p>{s.example}
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase text-primary">Confira</p>{s.check}
              </div>
            </div>
            {s.tip && (
              <p className="mt-3 flex gap-2 border-l-2 border-primary pl-3 text-sm text-muted-foreground">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {s.tip}
              </p>
            )}
          </li>
        ))}
      </ol>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase text-primary">Dúvidas frequentes</h2>
        <dl className="space-y-3 text-sm">
          {PRINTED_MENU_FAQ.map((f) => (
            <div key={f.q}><dt className="font-semibold">{f.q}</dt><dd className="text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
      </section>
    </div>
  );
}
