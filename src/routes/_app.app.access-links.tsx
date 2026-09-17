import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { publicOrigin } from "@/lib/public-origin";
import { toast } from "sonner";
import { KeyRound, Copy, Trash2, Ban, Smartphone, Monitor, Unlink } from "lucide-react";
import {
  createAccessLink,
  revokeAccessLink,
  deleteAccessLink,
  unbindAccessLinkDevices,
} from "@/lib/access-links.functions";

export const Route = createFileRoute("/_app/app/access-links")({
  head: () => ({
    meta: [
      { title: "Links de acesso rápido — Gestão de Vinhos" },
      { name: "description", content: "Crie links travados por aparelho para o chef e a equipe acessarem o painel ou a contagem de estoque." },
      { property: "og:title", content: "Links de acesso rápido — Gestão de Vinhos" },
      { property: "og:description", content: "Links de visualização travados por aparelho para chef e equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessLinksPage,
});

type LinkRow = {
  id: string;
  label: string;
  scope: "dashboard" | "stock_count" | "training";
  device_kind: "mobile" | "desktop";
  single_device: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  last_access_at: string | null;
  created_at: string;
};

function scopeLabel(s: LinkRow["scope"]) {
  if (s === "dashboard") return "Painel de controle (leitura)";
  if (s === "training") return "Fichas de treinamento do staff";
  return "Contagem de estoque";
}

function AccessLinksPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();

  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"dashboard" | "stock_count" | "training">("dashboard");
  const [deviceKind, setDeviceKind] = useState<"mobile" | "desktop">("mobile");
  const [singleDevice, setSingleDevice] = useState(true);
  const [days, setDays] = useState(0);
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; text: string } | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["access-links", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_links")
        .select("id, label, scope, device_kind, single_device, expires_at, revoked_at, last_access_at, created_at")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as LinkRow[];
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["access-link-devices", restaurantId],
    enabled: !!restaurantId && links.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("access_link_devices")
        .select("link_id, last_seen_at")
        .in("link_id", links.map((l) => l.id));
      return data ?? [];
    },
  });

  const deviceCount: Record<string, number> = {};
  devices.forEach((d) => { deviceCount[d.link_id] = (deviceCount[d.link_id] ?? 0) + 1; });

  function buildText(url: string, kind: "mobile" | "desktop", single: boolean, scopeV: string) {
    const dev = kind === "mobile" ? "CELULAR" : "COMPUTADOR";
    const lines = [
      `Acesso ao ${scopeV.toLowerCase()} — uso exclusivo no ${dev}`,
      "",
      url,
      "",
    ];
    if (single) {
      lines.push(`Este link fica travado no primeiro ${dev.toLowerCase()} que abri-lo.`);
      lines.push("Em outro aparelho ele não vai funcionar.");
    } else {
      lines.push(`Pode ser aberto em mais de um ${dev.toLowerCase()} da equipe.`);
    }
    return lines.join("\n");
  }

  async function handleCreate() {
    if (!restaurantId) return;
    if (!label.trim()) return toast.error("Informe um nome para o link.");
    setCreating(true);
    try {
      const res = await createAccessLink({
        data: {
          restaurant_id: restaurantId,
          label: label.trim(),
          scope,
          device_kind: deviceKind,
          single_device: singleDevice,
          days,
        },
      });
      const kindSeg =
        scope === "stock_count"
          ? "contagem"
          : scope === "training"
            ? "treinamento"
            : deviceKind === "mobile"
              ? "celular"
              : "desktop";
      const url = `${publicOrigin()}/acesso/${kindSeg}/${res.token}`;
      setFresh({ url, text: buildText(url, deviceKind, singleDevice, scopeLabel(scope)) });
      setLabel("");
      toast.success("Link criado. Copie agora — ele não será exibido novamente.");
      qc.invalidateQueries({ queryKey: ["access-links"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar o link.");
    } finally {
      setCreating(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Texto copiado.");
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center gap-2">
        <KeyRound className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Links de acesso rápido</h1>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Crie um link para o chef ver o painel sem e-mail nem senha, ou para a equipe
        registrar a contagem de estoque. O link pode ficar travado no primeiro
        aparelho que abri-lo — em qualquer outro aparelho ele não funciona.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Novo link</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Nome do link
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Chef Ricardo — celular"
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            O que o link abre
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="dashboard">Painel de controle (somente leitura)</option>
              <option value="stock_count">Contagem de estoque</option>
              <option value="training">Fichas de treinamento do staff</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Onde vai ser usado
            <select
              value={deviceKind}
              onChange={(e) => setDeviceKind(e.target.value as any)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="mobile">Celular</option>
              <option value="desktop">Computador</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Tipo de uso
            <select
              value={singleDevice ? "1" : "n"}
              onChange={(e) => setSingleDevice(e.target.value === "1")}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="1">Somente 1 aparelho</option>
              <option value="n">Vários aparelhos</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Validade
            <select
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="0">Sem prazo</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="h-10 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {creating ? "Gerando..." : "Gerar link"}
            </button>
          </div>
        </div>

        {fresh && (
          <div className="mt-4 rounded-lg border border-primary/40 bg-background p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Copie agora — o endereço não será exibido novamente
            </div>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-foreground">{fresh.text}</pre>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => copy(fresh.text)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar texto com instruções
              </button>
              <button
                onClick={() => copy(fresh.url)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar só o endereço
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Carregando...</div>}
        {!isLoading && links.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Nenhum link criado ainda.</div>
        )}
        {links.map((l) => {
          const expired = !!l.expires_at && new Date(l.expires_at).getTime() < Date.now();
          const status = l.revoked_at ? "Revogado" : expired ? "Expirado" : "Ativo";
          return (
            <div key={l.id} className="flex flex-wrap items-center gap-3 border-b border-border p-4 last:border-b-0">
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  {l.device_kind === "mobile" ? <Smartphone className="h-3.5 w-3.5 text-primary" /> : <Monitor className="h-3.5 w-3.5 text-primary" />}
                  {l.label}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {scopeLabel(l.scope)} · {l.single_device ? "1 aparelho" : "vários aparelhos"} ·{" "}
                  {deviceCount[l.id] ?? 0} aparelho(s) registrado(s)
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Último acesso:{" "}
                  {l.last_access_at ? new Date(l.last_access_at).toLocaleString("pt-BR") : "nunca"}
                  {l.expires_at ? ` · expira em ${new Date(l.expires_at).toLocaleDateString("pt-BR")}` : ""}
                </div>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                  status === "Ativo" ? "border-primary/50 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {status}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await unbindAccessLinkDevices({ data: { id: l.id } });
                      toast.success("Aparelhos desvinculados. O próximo aparelho que abrir o link será registrado.");
                      qc.invalidateQueries({ queryKey: ["access-link-devices"] });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Não foi possível desvincular.");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-primary hover:bg-accent"
                >
                  <Unlink className="h-3.5 w-3.5" /> Desvincular aparelho
                </button>
                {!l.revoked_at && (
                  <button
                    onClick={async () => {
                      try {
                        await revokeAccessLink({ data: { id: l.id } });
                        toast.success("Link revogado.");
                        qc.invalidateQueries({ queryKey: ["access-links"] });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Não foi possível revogar.");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-accent"
                  >
                    <Ban className="h-3.5 w-3.5" /> Revogar
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!confirm("Excluir este link definitivamente?")) return;
                    try {
                      await deleteAccessLink({ data: { id: l.id } });
                      toast.success("Link excluído.");
                      qc.invalidateQueries({ queryKey: ["access-links"] });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-destructive hover:bg-accent"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
