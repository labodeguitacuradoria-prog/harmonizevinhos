import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { setActiveGroup, setActiveRestaurant } from "@/lib/active-scope";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createRestaurantWithAccess } from "@/lib/access.functions";
import AccessMapDialog from "@/components/AccessMapDialog";
import { Building2, Layers, Plus, Users, X, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/app/")({
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
  const [newOpen, setNewOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (role === "supplier") navigate({ to: "/supplier" });
    if (role === "admin") navigate({ to: "/admin" });
  }, [role, loading, navigate]);

  if (loading) return null;
  if (role && role !== "restaurant") return null;

  function openUnit(id: string) {
    setActiveRestaurant(id);
    navigate({ to: "/app/dashboard" });
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
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-xl">Meus restaurantes</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Selecione um restaurante para gerenciar ou crie um novo. Você pode participar de
            vários restaurantes e visualizar redes de forma consolidada.
          </p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus size={16} /> Novo restaurante
        </button>
      </div>

      {memberships.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">
            Você ainda não tem restaurantes cadastrados.
          </div>
          <button
            onClick={() => setNewOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={16} /> Criar meu primeiro restaurante
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => {
            const canManage = m.role === "rest_admin" || m.role === "rest_owner";
            const groupName = groups.find((g) => g.id === m.groupId)?.name;
            return (
              <div
                key={m.restaurantId}
                className="flex flex-col rounded-xl border border-border bg-card p-5 transition hover:border-primary"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md border border-primary/40 bg-[color:var(--wine)]/20 p-2">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-foreground">
                      {m.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {[m.city, groupName ? `Rede: ${groupName}` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="rounded-md border border-primary/50 bg-[color:var(--wine)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => openUnit(m.restaurantId)}
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:opacity-90"
                  >
                    Entrar <ArrowRight size={14} />
                  </button>
                  {canManage && (
                    <button
                      onClick={() => setAccessFor({ id: m.restaurantId, name: m.name })}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      <Users size={13} /> Acessos
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visibleGroups.length > 0 && (
        <>
          <h2 className="page-title mt-10 text-base">Minhas redes</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Visualização consolidada disponível apenas para administradores e chef/owner.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGroups.map((g) => {
              const units = memberships.filter((m) => m.groupId === g.id);
              return (
                <div key={g.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md border border-primary/40 bg-[color:var(--wine)]/20 p-2">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-foreground">{g.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {units.length} unidade(s)
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openGroup(g.id)}
                    className="mt-4 flex items-center gap-2 rounded-md border border-primary/50 px-3 py-2 text-sm font-semibold text-primary hover:bg-[color:var(--wine)]/20"
                  >
                    Ver consolidado <ArrowRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <NewRestaurantDialog open={newOpen} onClose={() => setNewOpen(false)} />
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
    onSuccess: (res: any) => {
      setName("");
      setCity("");
      setGroupChoice("none");
      setNewGroup("");
      setErr(null);
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
