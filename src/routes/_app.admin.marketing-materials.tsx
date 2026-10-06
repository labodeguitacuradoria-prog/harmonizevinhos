import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Download, FilePenLine, Megaphone, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/admin/marketing-materials")({
  component: MarketingMaterials,
  head: () => ({
    meta: [
      { title: "Materiais de Divulgação | La Bodeguita" },
      {
        name: "description",
        content: "Biblioteca administrativa de apresentações e materiais de divulgação da La Bodeguita.",
      },
      { property: "og:title", content: "Materiais de Divulgação | La Bodeguita" },
      {
        property: "og:description",
        content: "Apresentações e materiais comerciais da plataforma La Bodeguita.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const presentationPath = "/materials/Cuidadoria-de-Vinhos-La-Bodeguita.pptx";

function MarketingMaterials() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  if (loading || role !== "admin") {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Materiais de Divulgação</h1>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Apresentações e arquivos oficiais para divulgar a plataforma La Bodeguita.
      </p>

      <section className="mt-7" aria-labelledby="presentations-title">
        <div className="mb-3 flex items-center gap-2">
          <Presentation className="h-4 w-4 text-primary" />
          <h2 id="presentations-title" className="text-sm font-semibold uppercase text-primary">
            Apresentações
          </h2>
        </div>

        <article className="border border-border bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-primary/40 bg-accent">
              <FilePenLine className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Cuidadoria de Vinhos & La Bodeguita</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pitch deck editável com 11 slides sobre a metodologia, a plataforma e os modelos de adoção.
              </p>
              <p className="mt-2 text-xs uppercase text-muted-foreground">PowerPoint · PPTX · Editável</p>
            </div>
          </div>
          <Button asChild className="mt-4 w-full sm:mt-0 sm:w-auto">
            <a href={presentationPath} download="Cuidadoria-de-Vinhos-La-Bodeguita.pptx">
              <Download className="h-4 w-4" />
              Baixar apresentação
            </a>
          </Button>
        </article>
      </section>
    </div>
  );
}