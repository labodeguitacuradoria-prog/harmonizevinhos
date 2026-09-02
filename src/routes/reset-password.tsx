import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Redefinir senha | La Bodeguita Vinhos" },
      {
        name: "description",
        content:
          "Defina uma nova senha para acessar a gestão de vinhos do seu restaurante no La Bodeguita Vinhos.",
      },
      { property: "og:title", content: "Redefinir senha | La Bodeguita Vinhos" },
      {
        property: "og:description",
        content: "Defina uma nova senha para acessar o La Bodeguita Vinhos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 8) return setErr("A senha deve ter ao menos 8 caracteres.");
    if (password !== confirm) return setErr("As senhas não coincidem.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setErr(error.message);
    setErr(null);
    setDone(true);
    setTimeout(() => navigate({ to: "/app" }), 1200);
  };

  const input =
    "w-full rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="page-title text-base">Definir nova senha</h1>
        </div>
        {done ? (
          <p className="mt-4 text-sm text-primary">Senha atualizada. Entrando…</p>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              type="password"
              placeholder="Nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
            <input
              type="password"
              placeholder="Confirmar senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={input}
            />
            {err && <div className="text-xs text-red-400">{err}</div>}
            <button
              onClick={submit}
              disabled={saving}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar senha"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
