import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Wine } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import { authErrorPt } from "@/lib/auth-errors";

const search = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  module: z.enum(["full", "dashboard", "pricing", "printed_menu", "pairing", "training"]).optional(),
});

const MODULE_TITLE: Record<string, string> = {
  full: "Gestão Completa dos Vinhos",
  dashboard: "Painel de controle",
  pricing: "Precificação",
  printed_menu: "Impressão de Cartas de Vinhos",
  pairing: "Harmonização",
  training: "Treinamento do Staff",
};

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Entrar — Gestão de Vinhos para Restaurantes" },
      { name: "description", content: "Acesse sua conta." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initialMode, module: chosenModule } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleInFlight = useRef(false);

  // Ao voltar para esta tela pelo histórico do navegador, nenhum estado antigo
  // pode deixar os botões travados.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setLoading(false);
      setGoogleBusy(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  // Prepara a autenticação assim que a tela abre, para que o clique em
  // "Continuar com Google" não precise esperar essa preparação.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Vindo da escolha de um pacote, a tela permanece aberta mesmo com sessão.
      if (!chosenModule && data.session) navigate({ to: "/app" });
    });
  }, [chosenModule, navigate]);

  // Assim que o Google devolver a sessão, entra no painel sem depender de
  // outro clique.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && googleInFlight.current) {
        googleInFlight.current = false;
        try { sessionStorage.removeItem("oauth-pending"); } catch { /* ignora */ }
        navigate({ to: "/app" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    try {
      // A escolha do pacote vale tanto para uma conta nova quanto para quem
      // entra novamente para acrescentar outro módulo à conta existente.
      if (chosenModule) {
        localStorage.setItem("signup-module", chosenModule);
      } else {
        localStorage.removeItem("signup-module");
      }
    } catch {
      /* ignora */
    }
  }, [chosenModule]);

  async function handleForgot() {
    if (!email.includes("@")) {
      toast.error("Digite seu e-mail no campo acima para receber o link.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um e-mail com o link para criar uma nova senha.");
    } catch (err) {
      toast.error(authErrorPt(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já está conectado.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(authErrorPt(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (googleInFlight.current) return;
    googleInFlight.current = true;
    setGoogleBusy(true);
    let keepBusy = false;
    try {
      try { sessionStorage.setItem("oauth-pending", String(Date.now())); } catch { /* ignora */ }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.redirected) {
        // O navegador está indo para o Google: mantém o aviso "Abrindo o Google…".
        keepBusy = true;
        return;
      }
      if (result.error) {
        try { sessionStorage.removeItem("oauth-pending"); } catch { /* ignora */ }
        const msg = result.error.message ?? "";
        if (/cancel/i.test(msg)) {
          toast.info("Login com Google cancelado.");
        } else if (/popup/i.test(msg)) {
          toast.error("O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.");
        } else {
          toast.error("Não foi possível entrar com Google. Tente novamente.");
        }
        return;
      }
      try { sessionStorage.removeItem("oauth-pending"); } catch { /* ignora */ }
      navigate({ to: "/app" });
    } catch {
      toast.error("Não foi possível entrar com Google. Tente novamente.");
    } finally {
      googleInFlight.current = false;
      if (!keepBusy) setGoogleBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <BrandLogo className="mb-6" />
        <h1 className="text-2xl font-semibold">
          {mode === "signin" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Acesse o painel do seu restaurante."
            : "Crie sua conta de restaurante em segundos."}
        </p>
        {chosenModule && (
          <div className="mt-3 rounded-md border border-primary/40 bg-[color:var(--wine)]/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Pacote escolhido: {MODULE_TITLE[chosenModule]}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleBusy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          {googleBusy ? "Abrindo o Google…" : "Continuar com Google"}
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <Input label="E-mail" type="email" value={email} onChange={setEmail} required />

          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={setPassword}
            required
            minLength={6}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Mínimo de 6 caracteres, de qualquer tipo.</span>
            {mode === "signin" && (
              <button type="button" onClick={handleForgot} className="font-medium text-primary hover:underline">
                Esqueci minha senha
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Novo por aqui?" : "Já tem conta?"}{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  required,
  minLength,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
