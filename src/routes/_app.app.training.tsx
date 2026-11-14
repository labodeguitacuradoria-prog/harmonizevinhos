import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import ModuleGate from "@/components/ModuleGate";
import TrainingBookEditor from "@/components/training/TrainingBookEditor";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/app/training")({
  head: () => ({
    meta: [
      { title: "Livro de Estudos da equipe — Treinamento" },
      {
        name: "description",
        content: "Monte o Livro de Estudos A4 da equipe com uma página por rótulo, agrupado por produtor, com índice clicável e link para o salão.",
      },
      { property: "og:title", content: "Livro de Estudos da equipe — Treinamento" },
      { property: "og:description", content: "Livro A4 com os rótulos da carta para a equipe estudar e imprimir." },
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

function TrainingPage() {
  const { restaurantId, memberships } = useAuth();
  const name = memberships.find((m) => m.restaurantId === restaurantId)?.name ?? "";
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <GraduationCap className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl uppercase tracking-[0.15em] text-primary">Livro de Estudos</h1>
          <p className="text-xs text-muted-foreground">Uma página A4 por rótulo, com os dados do cadastro. Insira suas próprias páginas, ordene e publique para a equipe.</p>
        </div>
      </header>
      {restaurantId ? (
        <TrainingBookEditor restaurantId={restaurantId} restaurantName={name} />
      ) : (
        <p className="text-sm text-muted-foreground">Selecione um restaurante para montar o livro.</p>
      )}
    </div>
  );
}
