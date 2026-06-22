import { createFileRoute, Outlet, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Wine, LogOut, Home, Package, Share2, Users, BarChart3, ShieldCheck, CalendarRange } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando...
      </div>
    );
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <aside className="border-b border-border bg-card md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 border-b border-border px-5 py-5">
          <Wine className="h-6 w-6 text-primary" />
          <span className="page-title text-base">Cava</span>
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-1 md:pb-0">
          {role === "restaurant" && (
            <>
              <NavLink to="/app" icon={<Home className="h-4 w-4" />}>Início</NavLink>
              <NavLink to="/app/wines" icon={<Package className="h-4 w-4" />}>Vinhos</NavLink>
              <NavLink to="/app/sales" icon={<BarChart3 className="h-4 w-4" />}>Vendas</NavLink>
              <NavLink to="/app/sales-monthly" icon={<CalendarRange className="h-4 w-4" />}>Venda mensal</NavLink>
              <NavLink to="/app/sharing" icon={<Share2 className="h-4 w-4" />}>Compartilhamento</NavLink>
            </>
          )}
          {role === "supplier" && (
            <>
              <NavLink to="/supplier" icon={<Home className="h-4 w-4" />}>Painel</NavLink>
            </>
          )}
          {role === "admin" && (
            <>
              <NavLink to="/admin" icon={<ShieldCheck className="h-4 w-4" />}>Admin</NavLink>
              <NavLink to="/admin/suppliers" icon={<Users className="h-4 w-4" />}>Fornecedores</NavLink>
            </>
          )}
        </nav>
        <div className="mt-auto hidden md:block">
          <div className="border-t border-border p-4">
            <div className="mb-2 text-xs text-muted-foreground">{user.email}</div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/app" || to === "/admin" || to === "/supplier" }}
      className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      activeProps={{ className: "bg-accent text-foreground" }}
    >
      {icon}
      {children}
    </Link>
  );
}
