import { createFileRoute, Outlet, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Wine, LogOut, Home, Package, Share2, Users, BarChart3, ShieldCheck, CalendarRange, ClipboardList, ClipboardCheck, Database, Building2, FolderCog, LayoutDashboard, Coins, Sparkles, Map, UtensilsCrossed, BookOpen, Menu, X } from "lucide-react";
import RestaurantContextSwitcher from "@/components/RestaurantContextSwitcher";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const renderNav = (rail: boolean) => (
    <>
      {role === "restaurant" && (
        <>
          <NavLink to="/app" rail={rail} icon={<Home className="h-4 w-4" />}>Início</NavLink>
          <NavLink to="/app/dashboard" rail={rail} icon={<LayoutDashboard className="h-4 w-4" />}>Painel</NavLink>
          <NavLink to="/app/price-analysis" rail={rail} icon={<Sparkles className="h-4 w-4" />}>Preços</NavLink>
          <NavLink to="/app/pairings" rail={rail} icon={<UtensilsCrossed className="h-4 w-4" />}>Harmonizações</NavLink>
          <NavLink to="/app/cadastros" rail={rail} icon={<FolderCog className="h-4 w-4" />}>Cadastros</NavLink>
          <NavLink to="/app/wines" rail={rail} icon={<Package className="h-4 w-4" />}>Produtos</NavLink>
          <NavLink to="/app/wine-menu" rail={rail} icon={<ScrollText className="h-4 w-4" />}>Carta</NavLink>
          <NavLink to="/app/suppliers" rail={rail} icon={<Users className="h-4 w-4" />}>Fornecedores</NavLink>
          <NavLink to="/app/stock-counts" rail={rail} icon={<ClipboardList className="h-4 w-4" />}>Contagem</NavLink>
          <NavLink to="/app/stock-counts-admin" rail={rail} icon={<ClipboardCheck className="h-4 w-4" />}>Revisão</NavLink>
          <NavLink to="/app/sales" rail={rail} icon={<BarChart3 className="h-4 w-4" />}>Vendas</NavLink>
          <NavLink to="/app/sales-monthly" rail={rail} icon={<CalendarRange className="h-4 w-4" />}>Venda mensal</NavLink>
          <NavLink to="/app/corkage-fees" rail={rail} icon={<Coins className="h-4 w-4" />}>Rolha</NavLink>
          <NavLink to="/app/sharing" rail={rail} icon={<Share2 className="h-4 w-4" />}>Compartilhar</NavLink>
          <NavLink to="/app/catalog-admin" rail={rail} icon={<Database className="h-4 w-4" />}>Catálogo</NavLink>
          <NavLink to="/app/restaurant-profile" rail={rail} icon={<Building2 className="h-4 w-4" />}>Restaurante</NavLink>
        </>
      )}
      {role === "supplier" && (
        <NavLink to="/supplier" rail={rail} icon={<Home className="h-4 w-4" />}>Painel</NavLink>
      )}
      {role === "admin" && (
        <>
          <NavLink to="/admin" rail={rail} icon={<ShieldCheck className="h-4 w-4" />}>Admin</NavLink>
          <NavLink to="/admin/access-map" rail={rail} icon={<Map className="h-4 w-4" />}>Acessos</NavLink>
          <NavLink to="/admin/suppliers" rail={rail} icon={<Users className="h-4 w-4" />}>Fornecedores</NavLink>
          <NavLink to="/app/catalog-admin" rail={rail} icon={<Database className="h-4 w-4" />}>Catálogo</NavLink>
          <NavLink to="/app/supplier-catalog-admin" rail={rail} icon={<Users className="h-4 w-4" />}>Cat. Fornec.</NavLink>
          <NavLink to="/app/pairings" rail={rail} icon={<UtensilsCrossed className="h-4 w-4" />}>Harmonizações</NavLink>
          <NavLink to="/app/pairing-knowledge" rail={rail} icon={<BookOpen className="h-4 w-4" />}>Sommelier</NavLink>
        </>
      )}
    </>
  );


  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Wine className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            Gestão de Vinhos
          </span>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-primary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile right drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 md:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className="flex h-full w-[78%] max-w-[300px] flex-col overflow-y-auto border-l border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Menu</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Fechar menu" className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {role === "restaurant" && <RestaurantContextSwitcher />}
            <nav className="flex flex-col gap-1 p-3" onClick={() => setMenuOpen(false)}>
              {renderNav(false)}

            </nav>
            <div className="mt-auto border-t border-border p-4">
              <div className="mb-2 truncate text-xs text-muted-foreground">{user.email}</div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="no-scrollbar hidden bg-card md:flex md:w-[92px] md:shrink-0 md:flex-col md:border-r md:border-border md:overflow-y-auto">
        <div className="flex flex-col items-center gap-1 border-b border-border px-2 py-4">
          <Wine className="h-6 w-6 text-primary" />
          <span className="text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-primary">
            Gestão de<br />Vinhos
          </span>
        </div>
        {role === "restaurant" && <RestaurantContextSwitcher compact />}
        <nav className="flex flex-col gap-1 px-2 pt-2">
          {renderNav(true)}
        </nav>
        <div className="mt-auto border-t border-border px-2 py-3">
          <button
            onClick={handleSignOut}
            title={user.email ?? "Sair"}
            className="flex w-full flex-col items-center gap-1 rounded-md py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-[9px] font-medium uppercase tracking-wide">Sair</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon,
  children,
  rail,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  rail?: boolean;
}) {
  const exact = to === "/app" || to === "/admin" || to === "/supplier";
  if (rail) {
    return (
      <Link
        to={to}
        activeOptions={{ exact }}
        className="flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        activeProps={{ className: "bg-accent text-primary" }}
      >
        {icon}
        <span className="w-full text-center text-[9px] font-medium uppercase leading-tight tracking-wide">
          {children}
        </span>
      </Link>
    );
  }
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      activeProps={{ className: "bg-accent text-foreground" }}
    >
      {icon}
      {children}
    </Link>
  );
}

