import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, CheckCircle2, Circle, FileSpreadsheet, Printer, Sparkles, X } from "lucide-react";
import { DEMO_TASKS, type TaskKey } from "@/lib/manual/demo-tasks";
import { EXAMPLE_MENU, EXAMPLE_RESTAURANT, type ExampleSection } from "@/lib/manual/printed-menu-manual";



export const Route = createFileRoute("/_app/app/demo")({
  validateSearch: (s: Record<string, unknown>): { task?: TaskKey; model?: string; paper?: "A4" | "A5" } => {
    const t = DEMO_TASKS.find((x) => x.key === s.task);
    const out: { task?: TaskKey; model?: string; paper?: "A4" | "A5" } = t ? { task: t.key } : {};
    if (typeof s.model === "string" && ["classico", "moderno", "minimal"].includes(s.model)) out.model = s.model;
    if (s.paper === "A4" || s.paper === "A5") out.paper = s.paper;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Demonstração interativa · Carta de Vinhos" },
      { name: "description", content: "Aprenda na prática a montar e imprimir uma carta de vinhos com um exemplo real." },
    ],
  }),
  component: DemoPage,
});

const MODELS = [
  { key: "classico", label: "Clássico", font: "font-serif" },
  { key: "moderno", label: "Moderno", font: "font-sans" },
  { key: "minimal", label: "Minimal", font: "font-mono" },
];

function DemoPage() {
  const { task, model: presetModel, paper: presetPaper } = Route.useSearch();
  const navigate = useNavigate();
  const [idx, setIdx] = useState(Math.max(0, DEMO_TASKS.findIndex((t) => t.key === task)));
  const current = DEMO_TASKS[idx];

  // estado da demonstração
  const [imported, setImported] = useState(idx > 0);
  const [model, setModel] = useState<string | null>(presetModel ?? (idx > 1 ? "classico" : null));
  const [paper, setPaper] = useState<"A4" | "A5" | null>(presetPaper ?? (idx > 1 ? "A4" : null));
  const [header, setHeader] = useState(idx > 1 ? EXAMPLE_RESTAURANT : "");
  const [sections, setSections] = useState<ExampleSection[]>(EXAMPLE_MENU);
  const [moved, setMoved] = useState(false);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [fields, setFields] = useState({ n: true, country: true, price: true });
  const [fieldsTouched, setFieldsTouched] = useState(false);
  const [printed, setPrinted] = useState(false);

  const checks: Record<TaskKey, { label: string; ok: boolean }[]> = {
    wines: [
      { label: "Clique em “Importar planilha”", ok: imported },
      { label: "Retire um rótulo da carta (desmarque a caixa)", ok: hidden.size > 0 },
    ],
    menu: [
      { label: "Escolha um modelo", ok: !!model },
      { label: "Escolha o tamanho do papel", ok: !!paper },
      { label: "Digite o nome no cabeçalho", ok: header.trim().length > 2 },
    ],
    sections: [{ label: "Mude a ordem de uma seção com as setas", ok: moved }],
    fields: [{ label: "Ligue ou desligue uma informação impressa", ok: fieldsTouched }],
    print: [{ label: "Clique em “Gerar PDF”", ok: printed }],
  };
  const done = checks[current.key].every((c) => c.ok);
  const allDone = (k: TaskKey) => checks[k].every((c) => c.ok);

  function go(i: number) {
    setIdx(i);
    navigate({ to: "/app/demo", search: { task: DEMO_TASKS[i].key }, replace: true });
    if (i > 0 && !imported) setImported(true);
    if (i > 1) {
      setModel((m) => m ?? "classico");
      setPaper((p) => p ?? "A4");
      setHeader((h) => h || EXAMPLE_RESTAURANT);
    }
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
    setMoved(true);
  }
  function toggleWine(n: number) {
    const s = new Set(hidden);
    s.has(n) ? s.delete(n) : s.add(n);
    setHidden(s);
  }
  const font = MODELS.find((m) => m.key === model)?.font ?? "font-serif";
  const totalWines = useMemo(() => sections.reduce((a, s) => a + s.wines.length, 0), [sections]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/50 bg-card px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={16} className="text-primary" />
          Você está na demonstração interativa (<b>Sabor da Terra</b>). Pronto para fazer a sua?
        </div>
        <div className="flex gap-2">
          <Link to="/app" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            Criar meu restaurante agora
          </Link>
          <Link to="/app" title="Sair da demonstração" className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-primary">
            <X size={14} />
          </Link>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {DEMO_TASKS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => go(i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase transition-colors ${i === idx ? "border-primary bg-[color:var(--surface-2)] text-primary" : "border-border bg-card text-muted-foreground hover:border-primary"}`}
          >
            {allDone(t.key) ? <CheckCircle2 size={13} className="text-primary" /> : <span>{i + 1}.</span>}
            {t.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Guia */}
        <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tarefa {idx + 1} de {DEMO_TASKS.length}</div>
          <h2 className="page-title mt-1 text-base">{current.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{current.goal}</p>
          <ul className="mt-4 space-y-2">
            {checks[current.key].map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />}
                <span className={c.ok ? "text-muted-foreground line-through" : ""}>{c.label}</span>
              </li>
            ))}
          </ul>
          {done && (
            <div className="mt-4 rounded-md border border-primary/40 bg-[color:var(--surface-2)] p-3 text-xs">
              <b className="text-primary">Muito bem!</b> Você concluiu esta tarefa.
            </div>
          )}
          <div className="mt-4 flex gap-2">
            {idx > 0 && (
              <button onClick={() => go(idx - 1)} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-primary">Voltar</button>
            )}
            {idx < DEMO_TASKS.length - 1 ? (
              <button disabled={!done} onClick={() => go(idx + 1)} className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
                Próxima tarefa
              </button>
            ) : (
              <Link to="/app" className={`flex-1 rounded-md bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground hover:opacity-90 ${done ? "" : "pointer-events-none opacity-40"}`}>
                Criar meu restaurante
              </Link>
            )}
          </div>
        </aside>

        {/* Área de prática */}
        <section className="rounded-xl border border-border bg-card p-5">
          {current.key === "wines" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="section-title !mb-0 !border-0 !pb-0">Cadastro de produtos</div>
                <button onClick={() => setImported(true)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${imported ? "border border-border text-muted-foreground" : "animate-pulse bg-primary text-primary-foreground"}`}>
                  <FileSpreadsheet size={14} /> {imported ? `${totalWines} rótulos importados` : "Importar planilha"}
                </button>
              </div>
              {!imported ? (
                <p className="mt-6 text-center text-sm text-muted-foreground">A planilha da carta do Sabor da Terra está pronta. Clique em “Importar planilha”.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-muted-foreground"><th className="w-8 py-1">Carta</th><th>Nº</th><th>Rótulo</th><th>País</th><th className="text-right">Preço</th></tr>
                  </thead>
                  <tbody>
                    {sections.flatMap((s) => s.wines).map((w) => (
                      <tr key={w.n} className="border-t border-border">
                        <td className="py-1.5"><input type="checkbox" checked={!hidden.has(w.n)} onChange={() => toggleWine(w.n)} className="accent-[color:var(--gold)]" /></td>
                        <td className="text-muted-foreground">{w.n}</td>
                        <td className={hidden.has(w.n) ? "text-muted-foreground line-through" : ""}>{w.name}</td>
                        <td className="text-muted-foreground">{w.country}</td>
                        <td className="text-right">R$ {w.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {current.key !== "wines" && (
            <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
              <div className="space-y-4">
                {current.key === "menu" && (
                  <>
                    <Group label="Modelo">
                      {MODELS.map((m) => <Chip key={m.key} on={model === m.key} onClick={() => setModel(m.key)}>{m.label}</Chip>)}
                    </Group>
                    <Group label="Papel">
                      {(["A4", "A5"] as const).map((p) => <Chip key={p} on={paper === p} onClick={() => setPaper(p)}>{p}</Chip>)}
                    </Group>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Cabeçalho</span>
                      <input value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Ex.: Sabor da Terra" className="mt-1 w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                    </label>
                  </>
                )}
                {current.key === "sections" && (
                  <Group label="Ordem das seções">
                    <div className="w-full space-y-1.5">
                      {sections.map((s, i) => (
                        <div key={s.title} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                          <span className="flex-1">{s.title}</span>
                          <button onClick={() => move(i, -1)} className="rounded p-1 text-primary hover:bg-[color:var(--surface-2)]" title="Subir"><ArrowUp size={14} /></button>
                          <button onClick={() => move(i, 1)} className="rounded p-1 text-primary hover:bg-[color:var(--surface-2)]" title="Descer"><ArrowDown size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </Group>
                )}
                {current.key === "fields" && (
                  <Group label="Informações impressas">
                    {([["n", "Número"], ["country", "País"], ["price", "Preço"]] as const).map(([k, l]) => (
                      <Chip key={k} on={fields[k]} onClick={() => { setFields({ ...fields, [k]: !fields[k] }); setFieldsTouched(true); }}>
                        {fields[k] && <Check size={12} />} {l}
                      </Chip>
                    ))}
                  </Group>
                )}
                {current.key === "print" && (
                  <button onClick={async () => {
                    const { jsPDF } = await import("jspdf");
                    const a5 = paper === "A5";
                    const doc = new jsPDF({ unit: "mm", format: a5 ? "a5" : "a4" });
                    const W = doc.internal.pageSize.getWidth();
                    const H = doc.internal.pageSize.getHeight();
                    const m = a5 ? 12 : 18;
                    const fam = model === "moderno" ? "helvetica" : model === "minimal" ? "courier" : "times";
                    let y = m + 6;
                    doc.setFont(fam, "bold").setFontSize(a5 ? 15 : 18).setTextColor(128, 0, 32);
                    doc.text((header || "Seu restaurante").toUpperCase(), W / 2, y, { align: "center" });
                    y += 6;
                    doc.setFont(fam, "normal").setFontSize(8).setTextColor(60, 40, 30);
                    doc.text("CARTA DE VINHOS", W / 2, y, { align: "center" });
                    y += 4;
                    doc.setDrawColor(128, 0, 32).line(m, y, W - m, y);
                    y += 8;
                    const fs = a5 ? 8.5 : 10;
                    for (const s of sections) {
                      const ws = s.wines.filter((w) => !hidden.has(w.n));
                      if (!ws.length) continue;
                      if (y > H - m - 12) { doc.addPage(); y = m + 6; }
                      doc.setFont(fam, "bold").setFontSize(fs + 1).setTextColor(128, 0, 32).text(s.title.toUpperCase(), m, y);
                      y += 6;
                      doc.setFont(fam, "normal").setFontSize(fs).setTextColor(42, 26, 18);
                      for (const w of ws) {
                        if (y > H - m) { doc.addPage(); y = m + 6; }
                        const label = `${fields.n ? `${w.n}  ` : ""}${w.name}${fields.country ? ` · ${w.country}` : ""}`;
                        doc.text(label, m, y, { maxWidth: W - 2 * m - 22 });
                        if (fields.price) doc.text(`R$ ${w.price}`, W - m, y, { align: "right" });
                        y += fs * 0.55;
                      }
                      y += 4;
                    }
                    doc.save(`carta-${(header || "demonstracao").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.pdf`);
                    setPrinted(true);
                  }} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                    <Printer size={16} /> Gerar PDF
                  </button>
                )}
              </div>

              {/* Prévia da carta */}
              <div className={`mx-auto w-full rounded-md bg-[#fbf8f1] p-6 text-[#2a1a12] shadow-lg ${paper === "A5" ? "max-w-[340px]" : "max-w-[480px]"} ${font}`}>
                <div className="border-b border-[#800020]/40 pb-3 text-center">
                  <div className="text-lg font-bold uppercase tracking-[0.2em] text-[#800020]">{header || "Seu restaurante"}</div>
                  <div className="text-[10px] uppercase tracking-widest">Carta de vinhos</div>
                </div>
                {sections.map((s) => {
                  const ws = s.wines.filter((w) => !hidden.has(w.n));
                  if (!ws.length) return null;
                  return (
                    <div key={s.title} className="mt-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#800020]">{s.title}</div>
                      {ws.map((w) => (
                        <div key={w.n} className="flex gap-2 text-[11px] leading-5">
                          {fields.n && <span className="w-5 text-[#8a6d3b]">{w.n}</span>}
                          <span className="flex-1">{w.name}{fields.country && <span className="text-[#8a6d3b]"> · {w.country}</span>}</span>
                          {fields.price && <span>R$ {w.price}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase transition-colors ${on ? "border-primary bg-[color:var(--surface-2)] text-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
      {children}
    </button>
  );
}
