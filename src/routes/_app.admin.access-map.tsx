import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminInviteAccess,
  adminRemoveAccess,
  listAllAccessMap,
} from "@/lib/access.functions";
import { ShieldCheck, UserPlus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/access-map")({
  component: AccessMapAdmin,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin global",
  rest_admin: "Administrador",
  rest_owner: "Chef / Owner",
  staff: "Staff",
  restaurant: "Restaurante",
  owner: "Owner",
  supplier: "Fornecedor",
};

function AccessMapAdmin() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listAllAccessMap);
  const inviteFn = useServerFn(adminInviteAccess);
  const removeFn = useServerFn(adminRemoveAccess);

  const [filterEmail, setFilterEmail] = useState("");
  const [filterRest, setFilterRest] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-access-map"],
    enabled: role === "admin",
    queryFn: () => listFn(),
  });

  const restaurants = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.restaurant_id) map.set(r.restaurant_id, r.restaurant_name ?? "—");
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (filterEmail && !(r.email ?? "").toLowerCase().includes(filterEmail.toLowerCase()))
      return false;
    if (filterRest && r.restaurant_id !== filterRest) return false;
    if (filterRole && r.role !== filterRole) return false;
    return true;
  });

  const removeMut = useMutation({
    mutationFn: async (user_role_id: string) => removeFn({ data: { user_role_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-access-map"] }),
  });

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="page-title text-xl">Mapa de acessos</h1>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <UserPlus size={14} /> Convidar
        </button>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <input
          placeholder="Filtrar por e-mail"
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          className="rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <select
          value={filterRest}
          onChange={(e) => setFilterRest(e.target.value)}
          className="rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Todos os restaurantes</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Todos os papéis</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--surface-2)] text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">E-mail</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Papel</th>
              <th className="px-3 py-2 text-left">Restaurante</th>
              <th className="px-3 py-2 text-left">Desde</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((r) => (
                <tr key={r.user_role_id} className="border-t border-border">
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.full_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-md border border-primary/50 bg-[color:var(--wine)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {ROLE_LABEL[r.role] ?? r.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.restaurant_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Remover vínculo?")) removeMut.mutate(r.user_role_id);
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <AdminInviteDialog
          restaurants={restaurants}
          onClose={() => setInviteOpen(false)}
          inviteFn={inviteFn}
          onDone={() => {
            setInviteOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-access-map"] });
          }}
        />
      )}
      {err && <div className="mt-2 text-xs text-red-400">{err}</div>}
    </div>
  );
}

function AdminInviteDialog({
  restaurants,
  onClose,
  inviteFn,
  onDone,
}: {
  restaurants: { id: string; name: string }[];
  onClose: () => void;
  inviteFn: any;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [restaurantId, setRestaurantId] = useState<string>(restaurants[0]?.id ?? "");
  const [role, setRole] = useState<string>("staff");
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: async () =>
      inviteFn({ data: { restaurant_id: restaurantId, email, role } }),
    onSuccess: onDone,
    onError: (e: any) => setErr(e?.message ?? "Falha"),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
        <h2 className="page-title text-base">Convidar usuário</h2>
        <div className="mt-4 space-y-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="staff">Staff</option>
            <option value="rest_owner">Chef / Owner</option>
            <option value="rest_admin">Administrador</option>
          </select>
          {err && <div className="text-xs text-red-400">{err}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!email || !restaurantId) return;
              mut.mutate();
            }}
            disabled={mut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending ? "Enviando..." : "Convidar"}
          </button>
        </div>
      </div>
    </div>
  );
}
