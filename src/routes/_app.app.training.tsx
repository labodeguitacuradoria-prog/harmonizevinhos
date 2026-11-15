import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Smartphone } from "lucide-react";
import ModuleGate from "@/components/ModuleGate";
import TrainingBookEditor from "@/components/training/TrainingBookEditor";
import QuickGuideEditor from "@/components/training/QuickGuideEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/app/training")({
  head: () => ({
    meta: [
      { title: "Treinamento da equipe — Livro de Estudos e Guia Rápido de Salão" },
      {
        name: "description",
        content: "Monte o Livro de Estudos A4 para imprimir e o Guia Rápido de Salão em PDF para o celular do garçom, com os rótulos da carta.",
      },
      { property: "og:title", content: "Treinamento da equipe — Livro de Estudos e Guia Rápido" },
      { property: "og:description", content: "Livro A4 para estudar e guia de bolso offline para consultar durante o serviço." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModuleGate route="/app/training">
      <TrainingPage />
    </ModuleGate>
  ),
});

const OPTIONS = [
  { value: "book", icon: BookOpen, title: "Livro de Estudos", text: "Folhas A4 para imprimir e estudar. Páginas podem ser trocadas no fichário." },
  { value: "guide", icon: Smartphone, title: "Guia Rápido de Salão", text: "Fichas curtas no celular do garçom. PDF com links, funciona sem internet." },
] as const;

function TrainingPage() {
  const { restaurantId, memberships } = useAuth();
  const name = memberships.find((m) => m.restaurantId === restaurantId)?.name ?? "";
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <GraduationCap className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl uppercase tracking-[0.15em] text-primary">Treinamento</h1>
          <p className="text-xs text-muted-foreground">Dois materiais diferentes, feitos com os dados do cadastro: um para estudar, outro para consultar durante o serviço.</p>
        </div>
      </header>
      {restaurantId ? (
        <Tabs defaultValue="book">
          <TabsList className="mb-5 grid h-auto w-full grid-cols-2 gap-3 bg-transparent p-0">
            {OPTIONS.map(({ value, icon: Icon, title, text }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex h-full flex-col items-start gap-1 whitespace-normal rounded-xl border border-border bg-card px-4 py-3 text-left data-[state=active]:border-primary data-[state=active]:bg-accent data-[state=active]:shadow-none"
              >
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
                  <Icon className="h-4 w-4" /> {title}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{text}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="book" forceMount className="data-[state=inactive]:hidden">
            <TrainingBookEditor restaurantId={restaurantId} restaurantName={name} />
          </TabsContent>
          <TabsContent value="guide">
            <QuickGuideEditor restaurantId={restaurantId} restaurantName={name} />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="text-sm text-muted-foreground">Selecione um restaurante para montar o material.</p>
      )}
    </div>
  );
}
