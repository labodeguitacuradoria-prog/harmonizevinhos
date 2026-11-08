import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MENU_LOOKS } from "@/lib/menu-appearance";
import { EXAMPLE_MENU } from "@/lib/manual/printed-menu-manual";

export default function MenuShowcase() {
  const navigate = useNavigate();
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h2 className="text-xs font-bold uppercase text-primary">O que você pode criar e imprimir</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {MENU_LOOKS.map((look) => (
          <Button key={look.key} variant="ghost" aria-label={`Experimentar ${look.title}`}
            onClick={() => navigate({ to: "/app/demo", search: { task: "menu", look: look.key } })}
            className="group h-auto min-w-0 flex-col items-stretch justify-start whitespace-normal rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-card focus-visible:border-primary">
            <div className="flex h-[166px] items-center justify-center">
              <div className={`menu-sample palette-${look.palette} menu-font-${look.font} h-[150px] overflow-hidden p-2 shadow-md ${look.paper === "DL" ? "w-[72px]" : "w-[106px]"}`}>
                <div className="menu-sample-heading border-b border-current pb-1 text-center">
                  {look.logo && <div className="menu-example-logo mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full border border-current text-[8px]">ST</div>}
                  <div className="text-[7px] font-bold">Sabor da Terra</div>
                  <div className="text-[4px]">CARTA DE VINHOS</div>
                </div>
                <div className={look.cols ? "grid grid-cols-2 gap-x-1" : ""}>
                  {(look.paper === "DL" ? EXAMPLE_MENU.slice(-1) : EXAMPLE_MENU.slice(0, 4)).map((section) => (
                    <div key={section.title} className="mt-1">
                      <div className="menu-sample-heading text-[5.5px] font-bold">{section.title}</div>
                      {section.wines.slice(0, look.cols ? 4 : 3).map((wine) => (
                        <div key={wine.n} className="flex gap-1 text-[4px] leading-[6px]">
                          <span className="min-w-0 flex-1 truncate">{wine.name}</span><span>{wine.price}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2">
              <h3 className="text-xs font-semibold text-foreground">{look.title}</h3>
              <span className="text-[10px] text-muted-foreground">{look.paper}</span>
            </div>
          </Button>
        ))}
      </div>
    </section>
  );
}
