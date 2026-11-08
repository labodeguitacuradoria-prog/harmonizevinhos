import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { setActiveGroup, setActiveRestaurant } from "@/lib/active-scope";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createRestaurantWithAccess } from "@/lib/access.functions";
import { claimSignupModule } from "@/lib/modules.functions";
import AccessMapDialog from "@/components/AccessMapDialog";
import MenuShowcase from "@/components/MenuShowcase";
import { Building2, Layers, Plus, Users, X, ArrowRight, Moon, Sun, GraduationCap, FileSpreadsheet, Printer } from "lucide-react";
import { EXAMPLE_RESTAURANT } from "@/lib/manual/printed-menu-manual";
import { DEMO_TASKS as LEARN_TASKS } from "@/lib/manual/demo-tasks";

function LearnDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  function start(task: (typeof LEARN_TASKS)[number]["key"]) {
    onClose();
    navigate({ to: "/app/demo", search: { task } });
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-primary">
          <X size={18} />
        </button>
        <h2 className="page-title text-base">Aprenda com uma carta de demonstração</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Vamos usar a carta do <b className="text-foreground">{EXAMPLE_RESTAURANT}</b> como exemplo: uma carta feita em
          planilha e impressa em PDF. Você acompanha, passo a passo, como ela vira uma carta profissional no sistema.
        </p>
        <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary">
          <FileSpreadsheet size={14} /> Planilha <ArrowRight size={12} /> <Printer size={14} /> Carta impressa
        </div>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          O que você quer aprender?
        </div>
        <div className="mt-2 space-y-2">
          {LEARN_TASKS.map((t) => (
            <button
              key={t.title}
              onClick={() => start(t.key)}
              className="group flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-primary"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{t.title}</span>
                <span className="block text-[11px] text-muted-foreground">{t.goal}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-primary" />
            </button>
          ))}
        </div>
        <button
          onClick={() => start("wines")}
          className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Fazer a demonstração completa
        </button>
      </div>
    </div>
  );
}
import { useEntitlements } from "@/hooks/use-entitlements";
import { MODULES, SINGLE_MODULES, type AppModule } from "@/lib/modules";


export const Route = createFileRoute("/_app/app/")({
  head: () => ({ meta: [
    { title: "Meus restaurantes e modelos de cartas · La Bodeguita" },
    { name: "description", content: "Acesse seus restaurantes e explore modelos de cartas de vinhos para impressão." },
    { property: "og:title", content: "Meus restaurantes e modelos de cartas · La Bodeguita" },
    { property: "og:description", content: "Cartas de vinhos com identidade, fundos e fontes para seu restaurante." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HomePage,
});

const ROLE_LABEL: Record<string, string> = {
  rest_admin: "Administrador",
  rest_owner: "Chef / Owner",
  staff: "Staff",
  restaurant: "Restaurante",
  owner: "Owner",
};

function HomePage() {
  const { role, memberships, groups, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const [newOpen, setNewOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<{ id: string; name: string } | null>(null);
  const { byRestaurant } = useEntitlements(memberships.map((m) => m.restaurantId));

  useEffect(() => {
    if (loading) return;
    if (role === "supplier") navigate({ to: "/supplier" });
    if (role === "admin") navigate({ to: "/admin" });
  }, [role, loading, navigate]);

  if (loading) return null;
  if (role && role !== "restaurant") return null;

  function modulesOf(id: string): AppModule[] {
    return byRestaurant.get(id) ?? [];
  }

  function homeRouteFor(id: string) {
    const mods = modulesOf(id);
    if (mods.includes("full") || mods.includes("dashboard")) return "/app/dashboard";
    const first = SINGLE_MODULES.find((m) => mods.includes(m.key));
    return first?.route ?? "/app/wines";
  }

  function openUnit(id: string) {
    setActiveRestaurant(id);
    navigate({ to: homeRouteFor(id) });
  }
  function openGroup(id: string) {
    setActiveGroup(id);
    navigate({ to: "/app/dashboard" });
  }

  const eligibleGroupIds = new Set(
    memberships
      .filter((m) => (m.role === "rest_admin" || m.role === "rest_owner") && m.groupId)
      .map((m) => m.groupId!),
  );
  const visibleGroups = groups.filter((g) => eligibleGroupIds.has(g.id));

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title truncate text-lg sm:text-xl">Meus restaurantes</h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:mt-1 sm:text-[12px]">
            Selecione um restaurante para gerenciar ou crie um novo.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary transition-colors hover:border-primary sm:px-3"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            <span className="hidden sm:inline">{theme === "dark" ? "Claro" : "Escuro"}</span>
          </button>
          <button
            onClick={() => setNewOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:px-4"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Novo restaurante</span><span className="sm:hidden">Novo</span>
          </button>
        </div>

      </div>

      {memberships.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-8 sm:flex-row">
          <button
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={16} /> Criar meu primeiro restaurante
          </button>
          <button
            onClick={() => setLearnOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary"
          >
            <GraduationCap size={16} /> Aprender como o sistema funciona
          </button>
        </div>
      ) : null}
      {memberships.length === 0 && <MenuShowcase />}
      {memberships.length === 0 ? null : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card sm:mt-6">
          {memberships.map((m, i) => {
            const canManage = m.role === "rest_admin" || m.role === "rest_owner";
            const groupName = groups.find((g) => g.id === m.groupId)?.name;
            const meta = [m.city, groupName].filter(Boolean).join(" · ") || "—";
            const mods = modulesOf(m.restaurantId);
            const planLabel = mods.includes("full")
              ? "Pacote completo"
              : SINGLE_MODULES.filter((s) => mods.includes(s.key))
                  .map((s) => s.label)
                  .join(" · ") || "Sem módulo liberado";
            return (
              <div
                key={m.restaurantId}
                className={`group flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[color:var(--wine)]/10 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <button
                  onClick={() => openUnit(m.restaurantId)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  title="Entrar no restaurante"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-primary/70" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {m.name}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {planLabel}
                    </span>
                  </span>
                  <span className="hidden shrink-0 truncate text-[10px] text-muted-foreground sm:inline md:max-w-[180px]">
                    {meta}
                  </span>
                  <span className="shrink-0 rounded border border-primary/40 bg-[color:var(--wine)]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                {canManage && (
                  <button
                    onClick={() => setAccessFor({ id: m.restaurantId, name: m.name })}
                    className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground hover:text-primary sm:px-2"
                    title="Gerenciar acessos"
                  >
                    <Users size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {visibleGroups.length > 0 && (
        <>
          <h2 className="page-title mt-6 text-sm sm:text-base">Minhas redes</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
            {visibleGroups.map((g, i) => {
              const units = memberships.filter((m) => m.groupId === g.id);
              return (
                <div
                  key={g.id}
                  className={`group flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-[color:var(--wine)]/10 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <button
                    onClick={() => openGroup(g.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    title="Ver consolidado"
                  >
                    <Layers className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {g.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {units.length} unid.
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <NewRestaurantDialog open={newOpen} onClose={() => setNewOpen(false)} />
      {learnOpen && <LearnDialog onClose={() => setLearnOpen(false)} />}
      {accessFor && (
        <AccessMapDialog
          open={!!accessFor}
          onClose={() => setAccessFor(null)}
          restaurantId={accessFor.id}
          restaurantName={accessFor.name}
        />
      )}
    </div>
  );
}

function NewRestaurantDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { groups } = useAuth();
  const qc = useQueryClient();
  const createFn = useServerFn(createRestaurantWithAccess);
  const claimFn = useServerFn(claimSignupModule);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [groupChoice, setGroupChoice] = useState<string>("none"); // 'none' | 'new' | groupId
  const [newGroup, setNewGroup] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: name.trim(),
        city: city.trim() || null,
        group_id: groupChoice !== "none" && groupChoice !== "new" ? groupChoice : null,
        new_group_name: groupChoice === "new" ? newGroup.trim() : null,
      };
      return createFn({ data: payload });
    },
    onSuccess: async (res: any) => {
      setName("");
      setCity("");
      setGroupChoice("none");
      setNewGroup("");
      setErr(null);
      let chosen: string | null = null;
      try {
        chosen = localStorage.getItem("signup-module");
      } catch {
        chosen = null;
      }
      if (chosen) {
        try {
          await claimFn({ data: { module: chosen } });
          localStorage.removeItem("signup-module");
        } catch {
          /* mantém pacote padrão */
        }
      }
      qc.invalidateQueries();
      if (res?.id) setActiveRestaurant(res.id);
      onClose();
    },
    onError: (e: any) => setErr(e?.message ?? "Falha ao criar restaurante"),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-primary"
        >
          <X size={18} />
        </button>
        <h2 className="page-title text-base">Novo restaurante</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Nome do restaurante *
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Cidade
            </span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Rede
            </span>
            <select
              value={groupChoice}
              onChange={(e) => setGroupChoice(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="none">Sem rede</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="new">+ Criar nova rede</option>
            </select>
          </label>
          {groupChoice === "new" && (
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Nome da nova rede *
              </span>
              <input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </label>
          )}
          {err && <div className="text-xs text-red-400">{err}</div>}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!name.trim()) return setErr("Informe o nome");
              if (groupChoice === "new" && !newGroup.trim())
                return setErr("Informe o nome da nova rede");
              mut.mutate();
            }}
            disabled={mut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending ? "Criando..." : "Criar restaurante"}
          </button>
        </div>
      </div>
    </div>
  );
}
