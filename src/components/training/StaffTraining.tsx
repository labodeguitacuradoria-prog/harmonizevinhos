import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon, X, ChevronLeft, ChevronRight, Trophy, Check, Wine as WineIcon, Search, BookOpen, PlayCircle } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import StoryCard, { DetailedStoryCard, type StoryCardData } from "@/components/training/StoryCard";
import { Button } from "@/components/ui/button";
import { getGuestTrainingCards, saveGuestQuizAttempt } from "@/lib/guest-access.functions";

type Card = StoryCardData & { wine_id: string; video_urls?: string[]; video_status?: string | null };

const TYPE_TABS: { key: string; label: string; re: RegExp | null }[] = [
  { key: "all", label: "Todos", re: null },
  { key: "sparkling", label: "Espumantes", re: /espum|sparkl|champ|prosec|cava/i },
  { key: "white", label: "Brancos", re: /branco|white/i },
  { key: "rose", label: "Rosés", re: /ros[eé]/i },
  { key: "red", label: "Tintos", re: /tinto|red/i },
  { key: "sweet", label: "Sobremesa / Fortificados", re: /sobremesa|dessert|fortific|licoroso|porto/i },
];

const STUDIED_KEY = "training-studied";

function loadStudied(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STUDIED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function StaffTraining({ token }: { token: string }) {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState("all");
  const [term, setTerm] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [studied, setStudied] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadStudied(),
  );
  const [quiz, setQuiz] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["guest-training", token],
    retry: false,
    queryFn: () => getGuestTrainingCards({ data: { token } }),
  });

  const cards = (data && data.ok ? (data.cards as Card[]) : []) ?? [];

  const filtered = useMemo(() => {
    const re = TYPE_TABS.find((t) => t.key === tab)?.re ?? null;
    const q = term.trim().toLowerCase();
    return cards.filter((c) => {
      const bag = `${c.style ?? ""} ${c.wine_type ?? ""}`;
      if (re && !re.test(bag)) return false;
      if (q && !`${c.name} ${c.producer ?? ""} ${c.grapes_line ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [cards, tab, term]);

  function toggleStudied(id: string) {
    setStudied((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      try {
        localStorage.setItem(STUDIED_KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!data || !data.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center text-sm text-foreground">
          {(data as { message?: string } | undefined)?.message ?? "Link inválido."}
        </div>
      </div>
    );
  }

  if (quiz) {
    return <Quiz token={token} cards={cards} onExit={() => setQuiz(false)} />;
  }

  const open = openIndex !== null ? filtered[openIndex] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            {data.restaurantName}
          </span>
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-primary"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => window.close()}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {open ? (
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              onClick={() => setOpenIndex(null)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-primary"
            >
              Voltar à lista
            </button>
            <button
              onClick={() => toggleStudied(open.wine_id)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${
                studied.includes(open.wine_id)
                  ? "border-primary/60 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Check className="h-3.5 w-3.5" /> Estudado
            </button>
          </div>
          {showDetails ? <DetailedStoryCard card={open} /> : <StoryCard card={open} />}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDetails((value) => !value)}>
              <BookOpen /> {showDetails ? "Ver ficha rápida" : "Ver mais informações"}
            </Button>
            {open.video_urls?.length ? (
              <Button size="sm" onClick={() => setShowVideo(true)}>
                <PlayCircle /> Assistir em 30 segundos
              </Button>
            ) : <div />}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 pb-6">
            <button
              disabled={openIndex === 0}
              onClick={() => setOpenIndex((i) => Math.max(0, (i ?? 0) - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs text-primary disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              disabled={openIndex === filtered.length - 1}
              onClick={() => setOpenIndex((i) => Math.min(filtered.length - 1, (i ?? 0) + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs text-primary disabled:opacity-40"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar rótulo"
                className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-2 text-sm text-foreground"
              />
            </div>
            <button
              onClick={() => setQuiz(true)}
              disabled={cards.length < 3}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Trophy className="h-3.5 w-3.5" /> Desafio
            </button>
          </div>

          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase ${
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ul className="mt-3 space-y-2 pb-8">
            {filtered.map((c, i) => (
              <li key={c.wine_id}>
                <button
                  onClick={() => { setOpenIndex(i); setShowDetails(false); setShowVideo(false); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2 text-left"
                >
                  <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-background">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="h-full w-full object-contain" />
                    ) : (
                      <WineIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                      {c.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {[c.style || c.wine_type, c.country].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {studied.includes(c.wine_id) ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Nenhuma ficha publicada para este filtro.
              </li>
            ) : null}
          </ul>
        </div>
      )}
      {showVideo && open?.video_urls?.length ? (
        <VideoViewer title={open.name} urls={open.video_urls} onClose={() => setShowVideo(false)} />
      ) : null}
    </div>
  );
}

function VideoViewer({ title, urls, onClose }: { title: string; urls: string[]; onClose: () => void }) {
  const [part, setPart] = useState(0);
  const current = urls[part];
  if (!current) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-3">
      <div className="w-full max-w-sm">
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          <Button variant="outline" size="icon" onClick={onClose} aria-label="Fechar vídeo"><X /></Button>
        </div>
        <video
          key={current}
          src={current}
          controls
          autoPlay
          playsInline
          onEnded={() => part < urls.length - 1 ? setPart((value) => value + 1) : undefined}
          className="aspect-[9/16] w-full bg-card object-contain"
        />
        <div className="mt-2 text-center text-xs text-muted-foreground">Trecho {part + 1} de {urls.length}</div>
      </div>
    </div>
  );
}

type Question = { prompt: string; options: string[]; answer: string };

function buildQuiz(cards: Card[]): Question[] {
  const pick = <T,>(arr: T[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
  const qs: Question[] = [];
  for (const c of pick(cards, Math.min(10, cards.length))) {
    const kinds: Question[] = [];
    if (c.country) {
      const wrong = pick(
        cards.map((x) => x.country).filter((v): v is string => !!v && v !== c.country),
        2,
      );
      if (wrong.length) {
        kinds.push({
          prompt: `De que país é o ${c.name}?`,
          options: pick([c.country, ...wrong], 3),
          answer: c.country,
        });
      }
    }
    if (c.pairings?.length) {
      const right = c.pairings[0];
      const wrong = pick(
        cards.flatMap((x) => (x.wine_id === c.wine_id ? [] : (x.pairings ?? []))),
        2,
      );
      if (wrong.length) {
        kinds.push({
          prompt: `Com o que o ${c.name} combina?`,
          options: pick([right, ...wrong], 3),
          answer: right,
        });
      }
    }
    if (c.grapes_line) {
      const wrong = pick(
        cards
          .map((x) => x.grapes_line)
          .filter((v): v is string => !!v && v !== c.grapes_line),
        2,
      );
      if (wrong.length) {
        kinds.push({
          prompt: `Quais uvas fazem o ${c.name}?`,
          options: pick([c.grapes_line, ...wrong], 3),
          answer: c.grapes_line,
        });
      }
    }
    const chosen = pick(kinds, 1)[0];
    if (chosen) qs.push(chosen);
  }
  return qs.slice(0, 10);
}

function Quiz({ token, cards, onExit }: { token: string; cards: Card[]; onExit: () => void }) {
  const [questions] = useState(() => buildQuiz(cards));
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const q = questions[step];
  const done = !q;

  if (done && !saved && questions.length) {
    setSaved(true);
    saveGuestQuizAttempt({
      data: { token, score, total: questions.length },
    }).catch(() => undefined);
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground">
        <p className="text-sm text-muted-foreground">
          Ainda não há fichas suficientes para o desafio.
        </p>
        <button onClick={onExit} className="mt-3 rounded-md border border-border px-3 py-2 text-xs text-primary">
          Voltar
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <Trophy className="h-10 w-10 text-primary" />
        <div className="mt-3 text-2xl font-bold text-primary">
          {score} de {questions.length}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {score === questions.length
            ? "Perfeito! Você está pronto para o salão."
            : "Boa! Revise as fichas e tente de novo."}
        </p>
        <button
          onClick={onExit}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Voltar às fichas
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
          Desafio {step + 1}/{questions.length}
        </span>
        <button onClick={onExit} aria-label="Sair do desafio" className="text-muted-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>
      <h2 className="mt-4 text-base font-semibold leading-snug">{q.prompt}</h2>
      <div className="mt-4 space-y-2">
        {q.options.map((o) => {
          const state =
            chosen === null
              ? "border-border"
              : o === q.answer
                ? "border-primary text-primary"
                : o === chosen
                  ? "border-destructive text-destructive"
                  : "border-border opacity-60";
          return (
            <button
              key={o}
              disabled={chosen !== null}
              onClick={() => {
                setChosen(o);
                if (o === q.answer) setScore((s) => s + 1);
              }}
              className={`w-full rounded-xl border bg-card p-3 text-left text-sm ${state}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {chosen !== null ? (
        <button
          onClick={() => {
            setChosen(null);
            setStep((s) => s + 1);
          }}
          className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Continuar
        </button>
      ) : null}
    </div>
  );
}
