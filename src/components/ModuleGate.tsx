import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { MODULES, canAccessRoute, type AppModule } from "@/lib/modules";

/**
 * Envolve uma tela de módulo. Se o restaurante ativo não tiver o módulo liberado,
 * mostra a apresentação do módulo em vez da tela.
 */
export default function ModuleGate({
  route,
  children,
}: {
  route: string;
  children: React.ReactNode;
}) {
  const { role, modules, modulesLoading, loading } = useAuth();

  // Administrador geral e fornecedor não passam pelo controle de módulos.
  if (role === "admin" || role === "supplier") return <>{children}</>;
  if (loading || modulesLoading) return null;
  if (canAccessRoute(modules as AppModule[], route)) return <>{children}</>;

  const info = MODULES.find((m) => m.route === route);

  return (
    <div className="p-6 md:p-10">
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border"
          style={{
            borderColor: "color-mix(in oklab, var(--gold) 40%, transparent)",
            boxShadow: "0 0 15px color-mix(in oklab, var(--wine) 32%, transparent)",
          }}
        >
          <Lock className="h-5 w-5 text-primary" />
        </span>
        <h1 className="page-title mt-4 text-lg">{info?.label ?? "Módulo não liberado"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {info?.description ??
            "Este módulo não faz parte do seu plano atual."}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Este módulo ainda não está liberado para este restaurante. Fale com o administrador do
          sistema para incluí-lo no seu plano.
        </p>
        <Link
          to="/app"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
