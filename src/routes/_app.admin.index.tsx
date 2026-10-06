import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck, Users, Map, Building2, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminHome,
  head: () => ({
    meta: [
      { title: "Administração | La Bodeguita" },
      { name: "description", content: "Administração geral da plataforma La Bodeguita." },
      { property: "og:title", content: "Administração | La Bodeguita" },
      { property: "og:description", content: "Administração geral da plataforma La Bodeguita." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminHome() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Gerencie fornecedores, restaurantes e usuários.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link to="/admin/suppliers" className="flex items-start gap-3 rounded-lg border border-border bg-card p-5 hover:bg-accent">
          <Users className="mt-1 h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Fornecedores</div>
            <div className="text-sm text-muted-foreground">Cadastre fornecedores e vincule usuários.</div>
          </div>
        </Link>
        <Link to="/admin/access-map" className="flex items-start gap-3 rounded-lg border border-border bg-card p-5 hover:bg-accent">
          <Map className="mt-1 h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Mapa de acessos</div>
            <div className="text-sm text-muted-foreground">Convide, remova e visualize usuários por restaurante.</div>
          </div>
        </Link>
        <Link to="/admin/restaurants" className="flex items-start gap-3 rounded-lg border border-border bg-card p-5 hover:bg-accent">
          <Building2 className="mt-1 h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Restaurantes cadastrados</div>
            <div className="text-sm text-muted-foreground">Abra cada restaurante para ajustar problemas e corrigir erros.</div>
          </div>
        </Link>
        <Link to="/admin/marketing-materials" className="flex items-start gap-3 rounded-lg border border-border bg-card p-5 hover:bg-accent">
          <Megaphone className="mt-1 h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Materiais de Divulgação</div>
            <div className="text-sm text-muted-foreground">Acesse apresentações e materiais oficiais do aplicativo.</div>
          </div>
        </Link>
      </div>

    </div>
  );
}
