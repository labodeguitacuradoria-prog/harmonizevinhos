import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Users, Building2, ScrollText, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/app/cadastros")({
  component: CadastrosHub,
});

const items = [
  {
    to: "/app/wines",
    title: "Produtos",
    desc: "Cadastro e gestão dos rótulos do restaurante (vinhos, taças e demais itens).",
    icon: Package,
  },
  {
    to: "/app/wine-menu",
    title: "Carta impressa",
    desc: "Monte a carta de vinhos em modelos prontos e imprima sempre com os preços atualizados.",
    icon: ScrollText,
  },
  {
    to: "/app/suppliers",
    title: "Fornecedores",
    desc: "Dados institucionais dos fornecedores e materiais (listas de preço, apresentações).",
    icon: Users,
  },
  {
    to: "/app/restaurant-profile",
    title: "Restaurante",
    desc: "Dados institucionais: razão social, CNPJ, endereço, horários e contatos.",
    icon: Building2,
  },
] as const;

function CadastrosHub() {
  return (
    <div className="p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary uppercase" style={{ letterSpacing: "2px" }}>
          Cadastros
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Central de cadastros do restaurante. Escolha o que deseja gerenciar.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <div className="font-semibold uppercase tracking-wider text-sm text-primary">
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
    </div>
  );
}
