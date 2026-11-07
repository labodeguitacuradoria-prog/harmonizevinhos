import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";
import { MENU_MISSIONS, type TourMission } from "@/lib/manual/menu-tour-missions";

type Rect = { top: number; left: number; width: number; height: number };

export function MenuGuidedTour() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mission, setMission] = useState<TourMission | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const current = mission?.steps[step];

  const measure = useCallback(() => {
    if (!current) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current, measure]);

  useEffect(() => {
    if (!mission) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mission]);

  function start(m: TourMission) {
    setPickerOpen(false);
    setStep(0);
    setMission(m);
  }
  function close() {
    setMission(null);
    setRect(null);
  }

  // Balão: abaixo do alvo se houver espaço, senão acima; centralizado se não houver alvo.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(340, vw - 24);
  let cardStyle: React.CSSProperties = { left: (vw - cardW) / 2, top: vh / 2 - 120, width: cardW };
  if (rect) {
    const left = Math.max(12, Math.min(rect.left, vw - cardW - 12));
    const below = rect.top + rect.height + 12;
    cardStyle = below + 230 < vh
      ? { left, top: below, width: cardW }
      : { left, top: Math.max(12, rect.top - 242), width: cardW };
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/10"
        >
          <Sparkles className="h-3.5 w-3.5" /> Guia interativo
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-border bg-card p-2 shadow-lg">
            <div className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              O que você quer fazer hoje?
            </div>
            {MENU_MISSIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => start(m)}
                className="block w-full rounded-md px-3 py-2 text-left hover:bg-accent"
              >
                <span className="block text-xs font-bold text-foreground">{m.title}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {m.goal} · {m.steps.length} passos
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {mission && current && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[1000]" role="dialog" aria-label={mission.title}>
            {rect ? (
              <div
                className="pointer-events-none fixed rounded-xl border-2 border-primary transition-all duration-300"
                style={{ ...rect, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.7), 0 0 24px var(--gold, #D4AF37)" }}
              />
            ) : (
              <div className="fixed inset-0 bg-black/70" />
            )}
            <div
              className="fixed rounded-xl border border-primary bg-card p-4 shadow-2xl"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {mission.title} · Passo {step + 1} de {mission.steps.length}
                </div>
                <button type="button" onClick={close} aria-label="Fechar guia" className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 text-sm font-semibold text-foreground">{current.goal}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{current.text}</p>
              {current.check && (
                <p className="mt-2 rounded-md bg-primary/10 px-2 py-1.5 text-[11px] text-foreground">
                  <b className="text-primary">Confira:</b> {current.check}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-1">
                  {mission.steps.map((_, i) => (
                    <span key={i} className={`h-1.5 w-4 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
                  ))}
                </div>
                <div className="flex gap-2">
                  {step > 0 && (
                    <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center rounded-md border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-accent">
                      <ChevronLeft className="h-3.5 w-3.5" /> Voltar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (step + 1 < mission.steps.length ? setStep(step + 1) : close())}
                    className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold uppercase text-primary-foreground hover:opacity-90"
                  >
                    {step + 1 < mission.steps.length ? <>Próximo <ChevronRight className="h-3.5 w-3.5" /></> : "Concluir missão"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
