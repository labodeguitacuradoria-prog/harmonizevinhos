import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  Package,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { clearActiveScope, getActiveScope, setActiveRestaurant } from "@/lib/active-scope";
import { setModuleEntitlement } from "@/lib/modules.functions";
import { MODULES, MODULE_LABEL, type AppModule } from "@/lib/modules";
import {
  permanentlyDeleteRestaurant,
  restoreRestaurant,
  trashRestaurant,
} from "@/lib/restaurants-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/restaurants")({
  component: AdminRestaurants,
  head: () => ({
    meta: [
      { title: "Restaurantes cadastrados | Gestão de Vinhos" },
      { name: "description", content: "Administre, filtre, recupere e organize os restaurantes cadastrados." },
      { property: "og:title", content: "Restaurantes cadastrados | Gestão de Vinhos" },
      { property: "og:description", content: "Administre, filtre, recupere e organize os restaurantes cadastrados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  name: string;
  city: string | null;
  cnpj: string | null;
  legal_name: string | null;
  group_id: string | null;
  owner_id: string;
  created_at: string;
  deleted_at: string | null;
};

type Profile = { id: string; email: string | null; full_name: string | null };
type PendingAction = { kind: "trash" | "permanent"; row: Row; stage: 1 | 2 } | null;

function AdminRestaurants() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const trashFn = useServerFn(trashRestaurant);
  const restoreFn = useServerFn(restoreRestaurant);
  const permanentFn = useServerFn(permanentlyDeleteRestaurant);
  const [view, setView] = useState<"active" | "trash">("active");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const [group, setGroup] = useState("all");
  const [module, setModule] = useState("all");
  const [pending, setPending] = useState<PendingAction>(null);
  const [restoreRow, setRestoreRow] = useState<Row | null>(null);
  const [restoreOwner, setRestoreOwner] = useState("");

  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-restaurants"],
    enabled: role === "admin",
    queryFn: async () => {
      const [restsResult, winesResult, ordersResult, rolesResult, groupsResult, profilesResult, entitlementsResult] = await Promise.all([
        supabase.from("restaurants").select("id, name, city, cnpj, legal_name, group_id, owner_id, created_at, deleted_at").order("name"),
        supabase.from("wines").select("restaurant_id"),
        supabase.from("purchase_orders").select("restaurant_id"),
        supabase.from("user_roles").select("restaurant_id, user_id, role"),
        supabase.from("restaurant_groups").select("id, name").order("name"),
        supabase.from("profiles").select("id, email, full_name").order("email"),
        supabase.from("module_entitlements").select("restaurant_id, module, enabled"),
      ]);
      const firstError = [restsResult, winesResult, ordersResult, rolesResult, groupsResult, profilesResult, entitlementsResult].find((result) => result.error)?.error;
      if (firstError) throw new Error(firstError.message);

      const count = (list: { restaurant_id: string | null }[] | null) => {
        const counts = new Map<string, number>();
        for (const item of list ?? []) {
          if (item.restaurant_id) counts.set(item.restaurant_id, (counts.get(item.restaurant_id) ?? 0) + 1);
        }
        return counts;
      };
      const modules = new Map<string, Set<AppModule>>();
      for (const entitlement of entitlementsResult.data ?? []) {
        if (!entitlement.enabled) continue;
        const values = modules.get(entitlement.restaurant_id) ?? new Set<AppModule>();
        values.add(entitlement.module as AppModule);
        modules.set(entitlement.restaurant_id, values);
      }
      const profiles = (profilesResult.data ?? []) as Profile[];
      return {
        rows: (restsResult.data ?? []) as Row[],
        wineCount: count(winesResult.data),
        orderCount: count(ordersResult.data),
        userCount: count(rolesResult.data),
        groups: new Map((groupsResult.data ?? []).map((item) => [item.id, item.name] as const)),
        owners: new Map(profiles.map((profile) => [profile.id, profile.email ?? profile.full_name ?? "—"] as const)),
        profiles,
        modules,
      };
    },
  });

  const activeRows = (data?.rows ?? []).filter((row) => !row.deleted_at);
  const trashRows = (data?.rows ?? []).filter((row) => row.deleted_at);
  const sourceRows = view === "active" ? activeRows : trashRows;
  const cities = useMemo(() => Array.from(new Set(activeRows.map((row) => row.city).filter((value): value is string => Boolean(value)))).sort(), [activeRows]);
  const groups = useMemo(() => Array.from(data?.groups.entries() ?? []), [data?.groups]);
  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return sourceRows.filter((row) => {
      if (term && ![row.name, row.city, row.cnpj, row.legal_name, data?.owners.get(row.owner_id)].some((value) => (value ?? "").toLowerCase().includes(term))) return false;
      if (city !== "all" && row.city !== city) return false;
      if (group !== "all" && (group === "none" ? row.group_id !== null : row.group_id !== group)) return false;
      if (module !== "all" && !data?.modules.get(row.id)?.has(module as AppModule)) return false;
      return true;
    });
  }, [sourceRows, q, city, group, module, data?.owners, data?.modules]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-restaurants"] });
    await qc.invalidateQueries({ queryKey: ["auth-context"] });
  };
  const actionMutation = useMutation({
    mutationFn: async (action: Exclude<PendingAction, null>) => {
      if (action.kind === "trash") return trashFn({ data: { restaurant_id: action.row.id } });
      return permanentFn({ data: { restaurant_id: action.row.id } });
    },
    onSuccess: async (_, action) => {
      if (getActiveScope().activeRestaurantId === action.row.id) clearActiveScope();
      setPending(null);
      await refresh();
      toast.success(action.kind === "trash" ? "Restaurante movido para a lixeira." : "Restaurante excluído definitivamente. As contas dos usuários foram preservadas.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação."),
  });
  const restoreMutation = useMutation({
    mutationFn: () => {
      if (!restoreRow || !restoreOwner) throw new Error("Escolha o novo administrador.");
      return restoreFn({ data: { restaurant_id: restoreRow.id, owner_id: restoreOwner } });
    },
    onSuccess: async () => {
      setRestoreRow(null);
      setRestoreOwner("");
      await refresh();
      toast.success("Restaurante recuperado e novo administrador definido.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível recuperar o restaurante."),
  });

  function openAs(id: string, to: string) {
    setActiveRestaurant(id);
    navigate({ to });
  }

  function clearFilters() {
    setQ("");
    setCity("all");
    setGroup("all");
    setModule("all");
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="page-title text-xl">Restaurantes cadastrados</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Consulte unidades, pacotes, acessos e ações administrativas.</p>
        </div>
        <div className="flex rounded-md border border-border bg-card p-1">
          <Button size="sm" variant={view === "active" ? "default" : "ghost"} onClick={() => setView("active")}>
            Ativos <span className="text-xs opacity-70">{activeRows.length}</span>
          </Button>
          <Button size="sm" variant={view === "trash" ? "default" : "ghost"} onClick={() => setView("trash")}>
            <Trash2 /> Lixeira <span className="text-xs opacity-70">{trashRows.length}</span>
          </Button>
        </div>
      </div>

      <div className="sticky top-0 z-20 mt-4 border-y border-border bg-background py-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_180px_200px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nome, CNPJ, razão social ou responsável" className="pl-9" />
          </div>
          <FilterSelect value={city} onChange={setCity} placeholder="Todas as cidades" options={cities.map((value) => [value, value])} />
          <FilterSelect value={group} onChange={setGroup} placeholder="Todas as redes" options={[["none", "Sem rede"], ...groups]} />
          <FilterSelect value={module} onChange={setModule} placeholder="Todos os pacotes" options={MODULES.map((item) => [item.key, item.label])} />
          <Button variant="outline" size="sm" onClick={clearFilters} title="Limpar filtros" aria-label="Limpar filtros"><X /></Button>
        </div>
        <div className="mt-2 text-[11px] uppercase text-muted-foreground">{filteredRows.length} {filteredRows.length === 1 ? "restaurante" : "restaurantes"}</div>
      </div>

      <div className="mt-4 max-h-[calc(100vh-250px)] overflow-auto rounded-md border border-border bg-card">
        <table className="min-w-[1120px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface-2)] text-[10px] uppercase text-muted-foreground shadow-sm">
            <tr>
              <th className="px-3 py-3 text-left">Restaurante</th>
              <th className="px-3 py-3 text-left">Cidade / Rede</th>
              <th className="px-3 py-3 text-left">Responsável</th>
              <th className="px-3 py-3 text-center">Indicadores</th>
              <th className="px-3 py-3 text-left">Pacotes</th>
              {view === "trash" && <th className="px-3 py-3 text-left">Excluído em</th>}
              <th className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow colSpan={view === "trash" ? 7 : 6} text="Carregando..." />}
            {!isLoading && filteredRows.length === 0 && <EmptyRow colSpan={view === "trash" ? 7 : 6} text={view === "trash" ? "A lixeira está vazia." : "Nenhum restaurante encontrado."} />}
            {!isLoading && filteredRows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top hover:bg-accent/30">
                <td className="px-3 py-3">
                  <div className="font-semibold text-foreground">{row.name}</div>
                  <div className="mt-1 max-w-60 text-xs text-muted-foreground">{[row.legal_name, row.cnpj].filter(Boolean).join(" · ") || "Sem dados cadastrais"}</div>
                </td>
                <td className="px-3 py-3 text-xs">
                  <div>{row.city ?? "—"}</div>
                  <div className="mt-1 text-muted-foreground">{row.group_id ? data?.groups.get(row.group_id) ?? "Rede" : "Sem rede"}</div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{data?.owners.get(row.owner_id) ?? "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-center gap-3 text-center text-xs">
                    <Count label="Rótulos" value={data?.wineCount.get(row.id) ?? 0} />
                    <Count label="Pedidos" value={data?.orderCount.get(row.id) ?? 0} />
                    <Count label="Acessos" value={data?.userCount.get(row.id) ?? 0} />
                  </div>
                </td>
                <td className="max-w-80 px-3 py-3">
                  {view === "active" ? <ModuleToggles restaurantId={row.id} active={data?.modules.get(row.id) ?? new Set<AppModule>()} /> : <ModuleSummary active={data?.modules.get(row.id) ?? new Set<AppModule>()} />}
                </td>
                {view === "trash" && <td className="px-3 py-3 text-xs text-muted-foreground">{row.deleted_at ? new Date(row.deleted_at).toLocaleString("pt-BR") : "—"}</td>}
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    {view === "active" ? (
                      <>
                        <Action icon={<LayoutDashboard />} label="Abrir painel" onClick={() => openAs(row.id, "/app/dashboard")} />
                        <Action icon={<Package />} label="Produtos" onClick={() => openAs(row.id, "/app/wines")} />
                        <Action icon={<ClipboardList />} label="Pedidos" onClick={() => openAs(row.id, "/app/orders")} />
                        <Action icon={<Settings />} label="Cadastro" onClick={() => openAs(row.id, "/app/restaurant-profile")} />
                        <Action destructive icon={<Trash2 />} label="Mover para a lixeira" onClick={() => setPending({ kind: "trash", row, stage: 1 })} />
                      </>
                    ) : (
                      <>
                        <Action icon={<RotateCcw />} label="Recuperar restaurante" onClick={() => { setRestoreRow(row); setRestoreOwner(row.owner_id); }} />
                        <Action destructive icon={<Trash2 />} label="Excluir definitivamente" onClick={() => setPending({ kind: "permanent", row, stage: 1 })} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.stage === 1 ? "Confirmar ação" : "Tem certeza?"}</DialogTitle>
            <DialogDescription>
              {pending?.kind === "trash"
                ? pending.stage === 1
                  ? `Mover “${pending.row.name}” para a lixeira? O restaurante ficará inacessível, mas poderá ser recuperado.`
                  : `Confirme novamente: deseja mover “${pending.row.name}” para a lixeira?`
                : pending?.stage === 1
                  ? `Excluir definitivamente “${pending.row.name}”? Todos os dados e arquivos do restaurante serão removidos.`
                  : `Esta ação é irreversível. Tem certeza que deseja excluir definitivamente “${pending?.row.name}”? As contas dos usuários serão mantidas.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={actionMutation.isPending}
              onClick={() => {
                if (!pending) return;
                if (pending.stage === 1) setPending({ ...pending, stage: 2 });
                else actionMutation.mutate(pending);
              }}
            >
              {actionMutation.isPending ? "Aguarde..." : pending?.stage === 1 ? "Continuar" : pending?.kind === "trash" ? "Mover para a lixeira" : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(restoreRow)} onOpenChange={(open) => !open && setRestoreRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar restaurante</DialogTitle>
            <DialogDescription>Escolha quem será o administrador responsável por “{restoreRow?.name}”.</DialogDescription>
          </DialogHeader>
          <Select value={restoreOwner} onValueChange={setRestoreOwner}>
            <SelectTrigger><SelectValue placeholder="Escolha um usuário" /></SelectTrigger>
            <SelectContent>
              {(data?.profiles ?? []).map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>{profile.email ?? profile.full_name ?? profile.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Os demais usuários e seus acessos serão preservados. Links antes revogados continuarão revogados.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreRow(null)}>Cancelar</Button>
            <Button disabled={!restoreOwner || restoreMutation.isPending} onClick={() => restoreMutation.mutate()}>
              {restoreMutation.isPending ? "Recuperando..." : "Recuperar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (value: string) => void; placeholder: string; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Action({ icon, label, onClick, destructive = false }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return <Button size="icon" variant="ghost" className={destructive ? "text-destructive hover:text-destructive" : "text-primary"} title={label} aria-label={label} onClick={onClick}>{icon}</Button>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-muted-foreground">{text}</td></tr>;
}

function Count({ label, value }: { label: string; value: number }) {
  return <div className="min-w-12"><b className="block text-primary">{value}</b><span className="text-[9px] uppercase text-muted-foreground">{label}</span></div>;
}

function ModuleSummary({ active }: { active: Set<AppModule> }) {
  const values = active.has("full") ? ["full" as AppModule] : Array.from(active);
  return values.length ? <div className="flex flex-wrap gap-1">{values.map((key) => <span key={key} className="rounded border border-primary/40 px-1.5 py-0.5 text-[9px] uppercase text-primary">{MODULE_LABEL[key]}</span>)}</div> : <span className="text-xs text-muted-foreground">Sem pacote</span>;
}

function ModuleToggles({ restaurantId, active }: { restaurantId: string; active: Set<AppModule> }) {
  const qc = useQueryClient();
  const setModule = useServerFn(setModuleEntitlement);
  const mutation = useMutation({
    mutationFn: (variables: { module: AppModule; enabled: boolean }) => setModule({ data: { restaurant_id: restaurantId, ...variables } }),
    onSuccess: () => {
      toast.success("Pacotes atualizados.");
      qc.invalidateQueries({ queryKey: ["admin-restaurants"] });
      qc.invalidateQueries({ queryKey: ["module-entitlements"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao atualizar pacotes."),
  });
  return (
    <div className="flex flex-wrap gap-1">
      {MODULES.map((item) => {
        const enabled = active.has(item.key);
        return (
          <Button key={item.key} size="sm" variant={enabled ? "default" : "outline"} disabled={mutation.isPending} title={item.description} className="h-6 px-2 text-[9px] uppercase" onClick={() => mutation.mutate({ module: item.key, enabled: !enabled })}>
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}