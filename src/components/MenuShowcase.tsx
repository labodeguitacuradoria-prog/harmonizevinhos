import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EXAMPLE_MENU, EXAMPLE_RESTAURANT } from "@/lib/manual/printed-menu-manual";

type Look = {
  key: string;
  title: string;
  format: string;
  style: string;
  ideal: string;
  model: "classico" | "moderno" | "minimal";
  paper: "A4" | "A5";
  font: string;
  cols?: boolean;
  slim?: boolean;
  upper?: boolean;
};

const LOOKS: Look[] = [
  { key: "nobre", title: "Clássica Nobre", format: "A4", style: "Serifada, seções em caixa alta e preços pontilhados.", ideal: "Cantinas, steakhouses e casas tradicionais.", model: "classico", paper: "A4", font: "font-serif", upper: true },
  { key: "duas", title: "Duas colunas", format: "A4", style: "Alta densidade: muitos rótulos em poucas folhas.", ideal: "Cartas extensas que querem economizar páginas.", model: "moderno", paper: "A4", font: "font-sans", cols: true },
  { key: "contemp", title: "Contemporânea", format: "A4", style: "Sem serifa, muito respiro, foco em uva e região.", ideal: "Alta gastronomia e bistrôs autorais.", model: "minimal", paper: "A4", font: "font-sans" },
  { key: "taca", title: "Taças da semana", format: "Slim 10×21", style: "Faixa vertical para pranchetas estreitas.", ideal: "Destacar taças e a seleção do sommelier.", model: "moderno", paper: "A5", font: "font-serif", slim: true },
  { key: "mesa", title: "Mesa compacta", format: "A5", style: "Meia folha A4, ideal para menus sazonais.", ideal: "Pranchetas de madeira e cartas curtas.", model: "classico", paper: "A5", font: "font-serif" },
];

function Mini({ look }: { look: Look }) {
  const sections = EXAMPLE_MENU.slice(0, look.slim ? 2 : look.cols ? 4 : 3);
  return (
    <div className={`mx-auto h-56 overflow-hidden rounded-sm bg-[#fbf8f1] p-3 text-[#2a1a12] shadow-lg ${look.slim ? "w-24" : look.paper === "A5" ? "w-32" : "w-40"} ${look.font}`}>
      <div className={`border-b border-[#2a1a12]/30 pb-1 text-center text-[7px] font-bold ${look.upper ? "uppercase tracking-[0.2em]" : ""}`}>
        {EXAMPLE_RESTAURANT}
      </div>
      <div className={look.cols ? "mt-1 grid grid-cols-2 gap-x-2" : "mt-1"}>
        {sections.map((s) => (
          <div key={s.title} className="mt-1">
            <div className={`text-[5.5px] font-bold text-[#800020] ${look.upper ? "uppercase tracking-widest" : ""}`}>{s.title}</div>
            {s.wines.slice(0, look.slim ? 3 : 4).map((w) => (
              <div key={w.n} className="flex items-baseline gap-0.5 text-[4.5px] leading-[7px]">
                <span className="truncate">{w.name}</span>
                {look.upper && <span className="flex-1 border-b border-dotted border-[#2a1a12]/40" />}
                <span className="ml-auto shrink-0">{w.price}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MenuShowcase() {
  const navigate = useNavigate();
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">O que você pode criar e imprimir</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {LOOKS.map((l) => (
          <div key={l.key} className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
            <div className="rounded-md bg-muted/40 py-4"><Mini look={l} /></div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{l.title}</h3>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{l.format}</span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{l.style}</p>
            <p className="mt-1 text-[11px] text-primary">{l.ideal}</p>
            <button
              onClick={() => navigate({ to: "/app/demo", search: { task: "menu", model: l.model, paper: l.paper } })}
              className="mt-auto pt-3 text-left text-[12px] font-semibold text-primary hover:underline"
            >
              Experimentar na demonstração →
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
