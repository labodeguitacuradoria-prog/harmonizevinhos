import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listRestaurantAccess,
  inviteRestaurantUser,
  removeRestaurantAccess,
} from "@/lib/access.functions";

const ROLE_LABELS: Record<string, string> = {
  rest_admin: "Administrador",
  rest_owner: "Chef / Owner",
  staff: "Staff",
  restaurant: "Restaurante (legado)",
  owner: "Owner (legado)",
  supplier: "Fornecedor",
};

type RoleOption = "rest_owner" | "staff" | "supplier";

export default function AccessMapDialog({
  open,
  onClose,
  restaurantId,
  restaurantName,
}: {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRestaurantAccess);
  const inviteFn = useServerFn(inviteRestaurantUser);
  const removeFn = useServerFn(removeRestaurantAccess);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleOption>("staff");
  const [supplierId, setSupplierId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["access-map", restaurantId],
    enabled: open,
    queryFn: () => listFn({ data: { restaurant_id: restaurantId } }),
  });

  // Fornecedores vinculados a este restaurante (via access ou via wines).
  const { data: suppliers = [] } = useQuery({
    queryKey: ["access-map-suppliers", restaurantId],
    enabled: open,
    queryFn: async () => {
      const [{ data: acc }, { data: wineSup }] = await Promise.all([
        supabase
          .from("restaurant_supplier_access")
          .select("supplier_id")
          .eq("restaurant_id", restaurantId),
        supabase
          .from("wines")
          .select("supplier_id")
          .eq("restaurant_id", restaurantId)
          .not("supplier_id", "is", null),
      ]);
      const ids = new Set<string>();
      for (const a of acc ?? []) if (a.supplier_id) ids.add(a.supplier_id);
      for (const w of wineSup ?? []) if (w.supplier_id) ids.add(w.supplier_id as string);
      if (ids.size === 0) return [] as { id: string; name: string }[];
      const { data: sup } = await supabase
        .from("suppliers")
        .select("id, name")
        .in("id", Array.from(ids));
      return (sup ?? []) as { id: string; name: string }[];
    },
  });

  const suppliersSorted = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers],
  );

  const inviteMut = useMutation({
    mutationFn: async () =>
      inviteFn({
        data: {
          restaurant_id: restaurantId,
          email,
          role,
          supplier_id: role === "supplier" ? supplierId : null,
        },
      }),
    onSuccess: () => {
      setEmail("");
      setSupplierId("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["access-map", restaurantId] });
    },
    onError: (e: any) => setErr(e?.message ?? "Falha ao convidar"),
  });

  const removeMut = useMutation({
    mutationFn: async (user_role_id: string) => removeFn({ data: { user_role_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access-map", restaurantId] }),
    onError: (e: any) => setErr(e?.message ?? "Falha ao remover"),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-primary"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
        <h2 className="page-title text-base">Mapa de acessos — {restaurantName}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Convide Chef/Owner, Staff e usuários de Fornecedores.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-2)] text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">E-mail</th>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Papel</th>
                <th className="px-3 py-2 text-left">Desde</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    Nenhum usuário vinculado.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.user_role_id} className="border-t border-border">
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.full_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-md border border-primary/50 bg-[color:var(--wine)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {ROLE_LABELS[r.role] ?? r.role}
                      {r.role === "supplier" && r.supplier_name ? ` — ${r.supplier_name}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Remover acesso?")) removeMut.mutate(r.user_role_id);
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:text-red-400"
                      aria-label="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-[color:var(--surface-2)] p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Convidar usuário
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as RoleOption);
                setSupplierId("");
              }}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="staff">Staff</option>
              <option value="rest_owner">Chef / Owner</option>
              <option value="supplier">Fornecedor</option>
            </select>
            <button
              onClick={() => {
                if (!email.trim()) return;
                if (role === "supplier" && !supplierId) {
                  setErr("Selecione o fornecedor.");
                  return;
                }
                inviteMut.mutate();
              }}
              disabled={inviteMut.isPending}
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <UserPlus size={14} /> {inviteMut.isPending ? "Enviando..." : "Convidar"}
            </button>
          </div>

          {role === "supplier" && (
            <div className="mt-2">
              {suppliersSorted.length === 0 ? (
                <div className="rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                  Nenhum fornecedor vinculado a este restaurante. Cadastre em{" "}
                  <b>Cadastros → Fornecedores</b> ou vincule ao menos um vinho a um fornecedor antes
                  de convidar o usuário.
                </div>
              ) : (
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">Selecione o fornecedor…</option>
                  {suppliersSorted.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {err && <div className="mt-2 text-xs text-red-400">{err}</div>}
          <p className="mt-2 text-[10px] text-muted-foreground">
            O convidado receberá um e-mail para definir a senha. Após o cadastro, o acesso já estará
            vinculado a este restaurante.
          </p>
        </div>
      </div>
    </div>
  );
}
