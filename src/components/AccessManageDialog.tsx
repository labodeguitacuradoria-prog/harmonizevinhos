import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, KeyRound, Mail, RefreshCw, Repeat } from "lucide-react";
import {
  changeAccessRole,
  sendAccessPasswordReset,
  adminSetUserPassword,
  adminChangeUserEmail,
  transferAccess,
} from "@/lib/access.functions";

export type ManageTarget = {
  user_role_id: string;
  email: string | null;
  full_name?: string | null;
  role: string;
  supplier_id?: string | null;
  restaurant_name?: string | null;
};

const ROLE_OPTIONS = [
  { value: "staff", label: "Staff" },
  { value: "rest_owner", label: "Chef / Owner" },
  { value: "rest_admin", label: "Administrador do restaurante" },
  { value: "supplier", label: "Fornecedor" },
];

export default function AccessManageDialog({
  target,
  onClose,
  onChanged,
  isGlobalAdmin,
  suppliers = [],
}: {
  target: ManageTarget;
  onClose: () => void;
  onChanged: () => void;
  isGlobalAdmin: boolean;
  suppliers?: { id: string; name: string }[];
}) {
  const roleFn = useServerFn(changeAccessRole);
  const resetFn = useServerFn(sendAccessPasswordReset);
  const setPwFn = useServerFn(adminSetUserPassword);
  const emailFn = useServerFn(adminChangeUserEmail);
  const transferFn = useServerFn(transferAccess);

  const [role, setRole] = useState(target.role);
  const [supplierId, setSupplierId] = useState(target.supplier_id ?? "");
  const [newEmail, setNewEmail] = useState(target.email ?? "");
  const [transferEmail, setTransferEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const wrap = <T,>(fn: (v: T) => Promise<any>, ok: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        setErr(null);
        setMsg(ok);
        onChanged();
      },
      onError: (e: any) => {
        setMsg(null);
        setErr(e?.message ?? "Falha na operação");
      },
    });

  const roleMut = wrap(
    () =>
      roleFn({
        data: {
          user_role_id: target.user_role_id,
          role: role as any,
          supplier_id: role === "supplier" ? supplierId || null : null,
        },
      }),
    "Papel atualizado.",
  );
  const resetMut = wrap(
    () => resetFn({ data: { user_role_id: target.user_role_id } }),
    "E-mail de redefinição de senha enviado.",
  );
  const pwMut = wrap(
    () => setPwFn({ data: { user_role_id: target.user_role_id, password } }),
    "Senha redefinida.",
  );
  const emailMut = wrap(
    () => emailFn({ data: { user_role_id: target.user_role_id, email: newEmail.trim() } }),
    "E-mail de acesso alterado.",
  );
  const transferMut = wrap(
    () => transferFn({ data: { user_role_id: target.user_role_id, email: transferEmail.trim() } }),
    "Acesso transferido para o novo e-mail.",
  );

  const input =
    "w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none";
  const btn =
    "flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60";
  const section = "rounded-lg border border-border bg-[color:var(--surface-2)] p-4";
  const label = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-primary"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
        <h2 className="page-title text-base">Gerenciar acesso</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {target.email ?? "—"}
          {target.full_name ? ` · ${target.full_name}` : ""}
          {target.restaurant_name ? ` · ${target.restaurant_name}` : ""}
        </p>

        {(msg || err) && (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${
              err ? "border-red-500/40 text-red-400" : "border-primary/40 text-primary"
            }`}
          >
            {err ?? msg}
          </div>
        )}

        <div className="mt-4 space-y-4">
          <div className={section}>
            <div className={label}>Papel</div>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>
              {ROLE_OPTIONS.filter((o) => isGlobalAdmin || o.value !== "rest_admin").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {role === "supplier" && (
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={`${input} mt-2`}
              >
                <option value="">Selecione o fornecedor…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => roleMut.mutate(undefined as any)}
              disabled={roleMut.isPending}
              className={`${btn} mt-3 w-full`}
            >
              <RefreshCw size={14} /> Salvar papel
            </button>
          </div>

          <div className={section}>
            <div className={label}>Senha</div>
            <button
              onClick={() => resetMut.mutate(undefined as any)}
              disabled={resetMut.isPending}
              className={`${btn} w-full`}
            >
              <Mail size={14} /> Enviar e-mail de redefinição
            </button>
            {isGlobalAdmin && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  placeholder="Nova senha (mín. 8 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={input}
                />
                <button
                  onClick={() => pwMut.mutate(undefined as any)}
                  disabled={pwMut.isPending || password.length < 8}
                  className={btn}
                >
                  <KeyRound size={14} /> Definir
                </button>
              </div>
            )}
          </div>

          {isGlobalAdmin && (
            <div className={section}>
              <div className={label}>E-mail de acesso</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={input}
                />
                <button
                  onClick={() => emailMut.mutate(undefined as any)}
                  disabled={emailMut.isPending || !newEmail.includes("@")}
                  className={btn}
                >
                  Substituir
                </button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                A pessoa passará a entrar com o novo e-mail, mantendo histórico e vínculos.
              </p>
            </div>
          )}

          <div className={section}>
            <div className={label}>Transferir para outra pessoa</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="email"
                placeholder="novo.responsavel@exemplo.com"
                value={transferEmail}
                onChange={(e) => setTransferEmail(e.target.value)}
                className={input}
              />
              <button
                onClick={() => {
                  if (!confirm("Transferir este acesso e remover o atual?")) return;
                  transferMut.mutate(undefined as any);
                }}
                disabled={transferMut.isPending || !transferEmail.includes("@")}
                className={btn}
              >
                <Repeat size={14} /> Transferir
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Cria o mesmo papel para o novo e-mail (com convite) e remove o acesso anterior.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
