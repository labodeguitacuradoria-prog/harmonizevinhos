import { createFileRoute, Outlet, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Wine, LogOut, Home, Package, Share2, Users, BarChart3, ShieldCheck, CalendarRange, ClipboardList, Database, Building2, FolderCog, LayoutDashboard, Coins, DollarSign, Map, UtensilsCrossed, BookOpen, ScrollText, ShoppingCart, Menu, X, KeyRound, GraduationCap } from "lucide-react";
import RestaurantContextSwitcher from "@/components/RestaurantContextSwitcher";
import { canAccessRoute, type AppModule } from "@/lib/modules";
import { useServerFn } from "@tanstack/react-start";
import { claimSignupModule } from "@/lib/modules.functions";
import { clearActiveScope } from "@/lib/active-scope";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, role, restaurantId, modules } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const claimedForUser = useRef<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const adminScopedRestaurant = role === "admin" ? restaurantId : null;
  const claimModule = useServerFn(claimSignupModule);


  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Aplica o pacote escolhido na tela inicial ao entrar pela primeira vez.
  useEffect(() => {
    if (loading || !user) return;
    if (claimedForUser.current === user.id) return;
    let chosen: string | null = null;
    try {
      chosen = localStorage.getItem("signup-module");
    } catch {
      chosen = null;
    }
    if (!chosen) return;
    claimedForUser.current = user.id;
    claimModule({ data: { module: chosen } })
      .then(async (res: any) => {
        // Sem restaurante ainda: guarda o pacote para aplicar ao criar o primeiro.
        if (res?.applied === false && !memberships.length) return;
        try {
          localStorage.removeItem("signup-module");
        } catch {
          /* ignora */
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["auth-context", user.id] }),
          queryClient.invalidateQueries({ queryKey: ["module-entitlements"] }),
        ]);
        router.invalidate();
      })
      .catch(() => {
        claimedForUser.current = null;
      });
  }, [loading, user, claimModule, queryClient, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando...
      </div>
    );
  }

  async function handleSignOut() {
    clearActiveScope();
    claimedForUser.current = null;
    try {
      localStorage.removeItem("signup-module");
    } catch {
      /* ignora indisponibilidade do armazenamento */
    }

    queryClient.clear();

    // A biblioteca de autenticação pode aguardar indefinidamente um bloqueio do
    // navegador. A saída local é iniciada, mas nunca impede o retorno ao portal.
    const signOut = supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    let clearStoredSession: Promise<unknown> = Promise.resolve();
    if (projectUrl) {
      try {
        const projectRef = new URL(projectUrl).hostname.split(".")[0];
        const storage = brokeredPreviewStorage();
        clearStoredSession = Promise.resolve(
          storage?.removeItem(`sb-${projectRef}-auth-token`),
        ).catch(() => undefined);
      } catch {
        clearStoredSession = Promise.resolve();
      }
    }
    await Promise.race([
      Promise.allSettled([signOut, clearStoredSession]),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
    ]);

    // A nova carga elimina listeners, transições e permissões da conta anterior.
    window.location.replace("/");
  }

  const restaurantNav = (rail: boolean) => {
    const items: { to: string; icon: React.ReactNode; label: string }[] = [
      { to: "/app", icon: <Home className="h-4 w-4" />, label: "Início" },
      { to: "/app/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, label: "Painel" },
      { to: "/app/price-analysis", icon: <DollarSign className="h-4 w-4" />, label: "Preços" },
      { to: "/app/pairings", icon: <UtensilsCrossed className="h-4 w-4" />, label: "Harmonizações" },
      { to: "/app/cadastros", icon: <FolderCog className="h-4 w-4" />, label: "Cadastros" },
      { to: "/app/wines", icon: <Package className="h-4 w-4" />, label: "Produtos" },
      { to: "/app/wine-menu", icon: <ScrollText className="h-4 w-4" />, label: "Carta" },
      { to: "/app/training", icon: <GraduationCap className="h-4 w-4" />, label: "Treinamento" },
      { to: "/app/orders", icon: <ShoppingCart className="h-4 w-4" />, label: "Pedidos" },
      { to: "/app/estoque", icon: <ClipboardList className="h-4 w-4" />, label: "Estoque" },
      { to: "/app/sales", icon: <BarChart3 className="h-4 w-4" />, label: "Vendas" },
      { to: "/app/corkage-fees", icon: <Coins className="h-4 w-4" />, label: "Rolha" },
      { to: "/app/sharing", icon: <Share2 className="h-4 w-4" />, label: "Compartilhar" },
      { to: "/app/access-links", icon: <KeyRound className="h-4 w-4" />, label: "Links de acesso" },
    ];
    const visible =
      role === "admin"
        ? items
        : items.filter((it) => canAccessRoute(modules as AppModule[], it.to));
    return (
      <>
        {visible.map((it) => (
          <NavLink key={it.to} to={it.to} rail={rail} icon={it.icon}>
            {it.label}
          </NavLink>
        ))}
      </>
    );
  };


  const renderNav = (rail: boolean) => (
    <>
      {role === "restaurant" && restaurantNav(rail)}
      {role === "supplier" && (
        <>
          <NavLink to="/supplier" rail={rail} icon={<LayoutDashboard className="h-4 w-4" />}>Painel</NavLink>
          <NavLink to="/supplier/products" rail={rail} icon={<Package className="h-4 w-4" />}>Produtos</NavLink>
        </>
      )}

      {role === "admin" && (
        <>
          <NavLink to="/admin" rail={rail} icon={<ShieldCheck className="h-4 w-4" />}>Admin</NavLink>
          <NavLink to="/admin/restaurants" rail={rail} icon={<Building2 className="h-4 w-4" />}>Restaurantes</NavLink>
          <NavLink to="/admin/access-map" rail={rail} icon={<Map className="h-4 w-4" />}>Acessos</NavLink>
          <NavLink to="/admin/suppliers" rail={rail} icon={<Users className="h-4 w-4" />}>Fornecedores</NavLink>
          <NavLink to="/app/catalog-admin" rail={rail} icon={<Database className="h-4 w-4" />}>Catálogo</NavLink>
          <NavLink to="/app/supplier-catalog-admin" rail={rail} icon={<Users className="h-4 w-4" />}>Cat. Fornec.</NavLink>
          <NavLink to="/app/pairings" rail={rail} icon={<UtensilsCrossed className="h-4 w-4" />}>Harmonizações</NavLink>
          <NavLink to="/app/pairing-knowledge" rail={rail} icon={<BookOpen className="h-4 w-4" />}>Sommelier</NavLink>
          {adminScopedRestaurant && (
            <>
              <div className={rail ? "my-2 border-t border-border" : "my-2 border-t border-border"} />
              {restaurantNav(rail)}
            </>
          )}
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
            <nav className="flex flex-col gap-1.5 p-3" onClick={() => setMenuOpen(false)}>
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

      <aside className="no-scrollbar relative hidden bg-card md:flex md:w-[92px] md:shrink-0 md:flex-col md:border-r md:border-border md:overflow-y-auto">
        <div className="flex flex-col items-center gap-2 border-b border-border px-2 py-5">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border"
            style={{
              borderColor: "color-mix(in oklab, var(--gold) 40%, transparent)",
              background: "var(--card-raw)",
              boxShadow: "0 0 15px color-mix(in oklab, var(--wine) 32%, transparent)",
            }}
          >
            <Wine className="h-6 w-6 text-primary" />
          </div>
          <span className="text-center text-[8px] font-bold uppercase leading-tight tracking-[0.25em] text-primary">
            Gestão de<br />Vinhos
          </span>
        </div>
        {role === "restaurant" && <RestaurantContextSwitcher compact />}
        <nav className="flex flex-col gap-1.5 px-2 pt-3">
          {renderNav(true)}
        </nav>
        <div className="mt-auto px-2 py-4">
          <button
            onClick={handleSignOut}
            title={user.email ?? "Sair"}
            className="flex w-full flex-col items-center gap-1 rounded-md py-3 text-muted-foreground opacity-50 transition-opacity hover:opacity-100"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[7px] font-medium uppercase tracking-[0.2em]">Sair</span>
          </button>
        </div>
        <div
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-px md:block"
          style={{ background: "var(--border-gold-hairline)" }}
        />
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
        className="flex flex-col items-center gap-1.5 rounded-lg px-0.5 py-2.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        activeProps={{ className: "nav-active text-primary" }}
      >
        {icon}
        <span className="w-full break-words text-center text-[7px] font-medium normal-case leading-[1.25] tracking-[0.02em]">
          {children}
        </span>
      </Link>
    );
  }
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[10px] font-medium normal-case tracking-[0.02em] text-muted-foreground hover:bg-white/5 hover:text-foreground"
      activeProps={{ className: "nav-active text-primary" }}
    >
      {icon}
      {children}
    </Link>
  );
}

