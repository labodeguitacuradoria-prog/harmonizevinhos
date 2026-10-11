import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StockImportDialog } from "@/components/StockImportDialog";
import { Upload, ClipboardList, ClipboardCheck, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/app/estoque")({
  component: EstoqueHub,
  head: () => ({
    meta: [
      { title: "Estoque — Contagem e revisão | Gestão de Vinhos" },
      {
        name: "description",
        content:
          "Central de estoque do restaurante: registre a contagem de garrafas e revise as contagens enviadas pela equipe.",
      },
      { property: "og:title", content: "Estoque — Contagem e revisão | Gestão de Vinhos" },
      {
        property: "og:description",
        content: "Registre a contagem de garrafas e revise as contagens da equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const items = [
  {
    to: "/app/stock-counts",
    title: "Contagem",
    desc: "Registrar a contagem de garrafas em adega, salão e demais locais.",
    icon: ClipboardList,
  },
  {
    to: "/app/stock-counts-admin",
    title: "Revisão da contagem",
    desc: "Conferir, ajustar e fechar as sessões de contagem enviadas pela equipe.",
    icon: ClipboardCheck,
  },
] as const;

function EstoqueHub() {
  const [importOpen, setImportOpen] = useState(false);
  return (
    <div className="p-6 md:p-10">
      <div>
        <h1 className="page-title">Estoque</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha entre registrar uma contagem ou revisar as contagens já enviadas.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary hover:bg-accent sm:col-span-2"
        >
          <div className="rounded-lg border border-border bg-background p-3 text-primary group-hover:border-primary">
            <Upload className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold uppercase tracking-wider text-primary">Importar estoque</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Envie PDF, foto, planilha ou texto. Os rótulos são localizados pelo código e os não encontrados podem ser criados.
            </div>
          </div>
        </button>
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 transition hover:border-primary hover:bg-accent"
            >
              <div className="rounded-lg border border-border bg-background p-3 text-primary group-hover:border-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold uppercase tracking-wider text-primary">
                    {it.title}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{it.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>
      {importOpen && <StockImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}
