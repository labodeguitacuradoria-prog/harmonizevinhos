import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, FilePlus2, Loader2, Paperclip, Pencil, Sparkles, X } from "lucide-react";
import { MediaUploader } from "@/components/MediaUploader";
import { resolveSheets, type CustomDesign, type MenuSheet } from "./MenuPreview";
import { sectionLevel, type MenuSection } from "./templates";

export type BriefAttachment = { name: string; path: string; mime?: string | null; size?: number };

export const CUSTOM_STATUS_LABEL: Record<string, string> = {
  requested: "Solicitada",
  in_progress: "Em criação",
  delivered: "Disponibilizada",
  cancelled: "Cancelada",
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function expandHexColor(color: string) {
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${color.slice(1).split("").map((character) => `${character}${character}`).join("")}`;
  }
  return color;
}

function HexColorField({
  label,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  value?: string;
  defaultValue: string;
  onChange: (color: string) => void;
}) {
  const appliedColor = HEX_COLOR_PATTERN.test(value ?? "") ? (value ?? defaultValue) : defaultValue;
  const [draft, setDraft] = useState(appliedColor);

  useEffect(() => {
    setDraft(appliedColor);
  }, [appliedColor]);

  const commitColor = (nextValue: string, confirm = false) => {
    const normalized = nextValue.trim().toLowerCase();
    if (!HEX_COLOR_PATTERN.test(normalized)) {
      toast.error("Use um código como #fffdf8.");
      return false;
    }
    setDraft(normalized);
    onChange(normalized);
    if (confirm) toast.success(`Cor aplicada: ${normalized}`);
    return true;
  };

  const updateDraft = (nextValue: string) => {
    const normalized = nextValue.toLowerCase();
    setDraft(normalized);
    if (HEX_COLOR_PATTERN.test(normalized)) onChange(normalized);
  };

  return (
    <div className="grid grid-cols-[1fr_auto_6.5rem_auto] items-center gap-2 text-xs">
      <span>{label}</span>
      <input
        type="color"
        value={expandHexColor(appliedColor)}
        onChange={(event) => commitColor(event.target.value)}
        className="h-8 w-9 cursor-pointer rounded border border-input bg-background p-0.5"
        aria-label={`Selecionar cor: ${label}`}
      />
      <input
        type="text"
        value={draft}
        onChange={(event) => updateDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          commitColor(draft, true);
        }}
        onBlur={() => {
          if (!commitColor(draft)) setDraft(appliedColor);
        }}
        placeholder="#fffdf8"
        maxLength={7}
        spellCheck={false}
        className="h-8 min-w-0 rounded-md border border-input bg-background px-2 font-mono text-xs"
        aria-label={`Código hexadecimal: ${label}`}
      />
      <button
        type="button"
        onClick={() => commitColor(draft, true)}
        className="h-8 rounded-md border border-primary/50 px-2 text-[10px] font-bold uppercase text-primary hover:bg-primary/10"
      >
        Aplicar
      </button>
    </div>
  );
}

export async function openBriefFile(path: string, name?: string) {
  const { data, error } = await supabase.storage.from("custom-menu-briefs").createSignedUrl(path, 600);
  if (error || !data) return toast.error("Não foi possível abrir o arquivo.");
  try {
    const res = await fetch(data.signedUrl);
    if (!res.ok) throw new Error("download");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name ?? path.split("/").pop() ?? "arquivo";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // fallback: tenta abrir direto no URL assinado
    window.open(data.signedUrl, "_blank");
  }
}

/** Pedido de carta personalizada pelo restaurante. Nenhum campo é obrigatório. */
export function CustomMenuRequestDialog({ restaurantId, onClose }: { restaurantId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("Carta personalizada");
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const { data: requests = [] } = useQuery({
    queryKey: ["custom-menu-requests", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_menu_requests")
        .select("id,title,status,created_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function send() {
    setSending(true);
    try {
      const attachments: BriefAttachment[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() ?? "bin";
        const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("custom-menu-briefs")
          .upload(path, f, { contentType: f.type || undefined });
        if (error) throw error;
        attachments.push({ name: f.name, path, mime: f.type, size: f.size });
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("custom_menu_requests").insert({
        restaurant_id: restaurantId,
        title: title.trim() || "Carta personalizada",
        brief_text: brief.trim() || null,
        attachments: attachments as never,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Pedido enviado! Nossa equipe vai desenvolver a sua carta e avisar quando estiver pronta.");
      qc.invalidateQueries({ queryKey: ["custom-menu-requests", restaurantId] });
      onClose();
    } catch (e) {
      toast.error(`Não foi possível enviar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-primary/50 bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[2px] text-primary">
            <Sparkles className="h-4 w-4" /> Carta personalizada
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Envie o que tiver: uma ideia, a carta antiga em PDF, fotos, o logotipo, referências. Nada é obrigatório —
          nossa equipe desenha a carta a partir disso. Você continua cadastrando os rótulos e preços normalmente.
        </p>
        <label className="mb-1 block text-[11px] uppercase text-muted-foreground">Nome do projeto</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <label className="mb-1 block text-[11px] uppercase text-muted-foreground">O que você imagina (opcional)</label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={5}
          placeholder="Ex.: algo elegante, com as cores do restaurante, capa com foto do salão..."
          className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground hover:bg-accent">
          <Paperclip className="h-4 w-4" /> Anexar PDF, imagens, logotipo (opcional)
          <input
            type="file"
            multiple
            className="hidden"
            accept="application/pdf,image/*,.doc,.docx,.ai,.svg,.zip"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...list]);
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded bg-accent/50 px-2 py-1 text-xs">
                <span className="truncate">{f.name}</span>
                <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label="Remover">
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={send}
          disabled={sending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar pedido
        </button>
        {requests.length > 0 && (
          <div className="mt-5 border-t border-border pt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary">Seus pedidos</div>
            <ul className="space-y-1">
              {requests.map((r) => (
                <li key={r.id} className="flex justify-between text-xs">
                  <span>{r.title}</span>
                  <span className="text-muted-foreground">{CUSTOM_STATUS_LABEL[r.status] ?? r.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** Sequência de folhas: folhas livres + a folha com os rótulos, em qualquer ordem. */
export function SheetSequencer({
  value,
  onChange,
  restaurantId,
  sections,
}: {
  value: CustomDesign;
  onChange: (v: CustomDesign) => void;
  restaurantId: string;
  sections: MenuSection[];
}) {
  const sheets = resolveSheets(value, sections);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const save = (next: MenuSheet[]) =>
    onChange({ ...value, sheets: next, coverImage: "", coverText: "" });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= sheets.length) return;
    const next = [...sheets];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const patch = (id: string, p: Partial<MenuSheet>) =>
    save(sheets.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const addExtra = () => {
    const id = crypto.randomUUID();
    save([...sheets, { id, kind: "extra", title: "", text: "", image: "" }]);
    setOpenId(id);
  };
  const addWinePage = () => {
    const id = crypto.randomUUID();
    save([...sheets, { id, kind: "wines", name: `Página de rótulos ${sheets.filter((sheet) => sheet.kind === "wines").length + 1}`, sectionIds: [] }]);
    setOpenId(id);
  };
  const assignSection = (sheetId: string, sectionId: string) => {
    save(sheets.map((sheet) => {
      if (sheet.kind !== "wines") return sheet;
      const without = (sheet.sectionIds ?? []).filter((id) => id !== sectionId);
      return sheet.id === sheetId ? { ...sheet, sectionIds: [...without, sectionId] } : { ...sheet, sectionIds: without };
    }));
  };
  const removeWinePage = (sheet: MenuSheet) => {
    const remaining = sheets.filter((item) => item.id !== sheet.id);
    const targetIndex = remaining.findIndex((item) => item.kind === "wines");
    if (targetIndex < 0) return;
    const target = remaining[targetIndex];
    remaining[targetIndex] = { ...target, sectionIds: [...new Set([...(target.sectionIds ?? []), ...(sheet.sectionIds ?? [])])] };
    save(remaining);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className={`grid h-10 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 text-left text-[11px] font-bold uppercase tracking-wider ${expanded ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent"}`}
        aria-expanded={expanded}
      >
        <span className="truncate">Sequência das folhas · {sheets.length} {sheets.length === 1 ? "página" : "páginas"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded ? (
      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap justify-end gap-1.5">
          <button type="button" onClick={addWinePage} className="inline-flex items-center gap-1 rounded-md border border-primary/50 px-2 py-1 text-[10px] font-bold uppercase text-primary hover:bg-primary/10">
            <FilePlus2 className="h-3 w-3" /> Página de rótulos
          </button>
          <button type="button" onClick={addExtra} className="rounded-md border border-primary/50 px-2 py-1 text-[10px] font-bold uppercase text-primary hover:bg-primary/10">
            + Folha extra
          </button>
        </div>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        A impressão segue esta ordem. Abra uma página de rótulos para escolher suas seções. O nome com lápis é apenas organizacional.
      </p>
      <ol className="max-h-[65vh] space-y-1.5 overflow-y-auto pr-1">
        {sheets.map((s, i) => {
          const isWines = s.kind === "wines";
          const open = openId === s.id;
          const pageSections = isWines ? sections.filter((section) => s.sectionIds?.includes(section.id)) : [];
          const pageWineCount = pageSections.reduce((total, section) => total + section.wineIds.length, 0);
          return (
            <li
              key={s.id}
              className={`rounded-md border ${isWines ? "border-primary/60 bg-primary/5" : "border-border"} p-2`}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="w-6 text-center font-bold text-primary">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : s.id)}
                   className="flex-1 truncate text-left"
                >
                   {isWines ? s.name?.trim() || `Página de rótulos ${sheets.slice(0, i + 1).filter((sheet) => sheet.kind === "wines").length}` : s.name?.trim() || s.title?.trim() || `Folha ${i + 1}`}
                </button>
                <button
                    type="button"
                    onClick={() => setRenameId(renameId === s.id ? null : s.id)}
                    className={`px-1 ${renameId === s.id ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                    aria-label="Renomear folha (apenas na lista)"
                    title="Renomear (não altera o título impresso)"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30" aria-label="Subir">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sheets.length - 1} className="px-1 disabled:opacity-30" aria-label="Descer">▼</button>
                <button type="button" onClick={() => setOpenId(open ? null : s.id)} className="px-1 text-primary">
                  {open ? "Fechar" : "Editar"}
                </button>
                {(!isWines || sheets.filter((sheet) => sheet.kind === "wines").length > 1) && (
                  <button
                      type="button"
                      onClick={() => isWines ? removeWinePage(s) : save(sheets.filter((x) => x.id !== s.id))}
                      className="px-1 text-destructive"
                      aria-label="Excluir folha"
                    >
                      <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {isWines ? (
                <div className="mt-1 pl-8 text-[10px] text-muted-foreground">
                  {pageSections.length} {pageSections.length === 1 ? "seção" : "seções"} · {pageWineCount} {pageWineCount === 1 ? "rótulo" : "rótulos"}
                </div>
              ) : null}
              {renameId === s.id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    autoFocus
                    value={s.name ?? ""}
                    onChange={(e) => patch(s.id, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") setRenameId(null);
                    }}
                    placeholder="Nome da folha na lista (ex.: Capa)"
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setRenameId(null)}
                    className="rounded-md border border-primary/50 px-2 py-1 text-[10px] font-bold uppercase text-primary hover:bg-primary/10"
                  >
                    OK
                  </button>
                </div>
              )}
              {open && isWines && (
                <div className="mt-2 border-t border-border pt-2">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Seções nesta página</div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {sections.map((section) => {
                      const assignedHere = s.sectionIds?.includes(section.id) ?? false;
                      const assignedPage = sheets.find((sheet) => sheet.kind === "wines" && sheet.sectionIds?.includes(section.id));
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => assignSection(s.id, section.id)}
                          className={`flex min-w-0 items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px] ${assignedHere ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                          title={assignedPage && !assignedHere ? `Mover de ${assignedPage.name || "outra página"}` : undefined}
                        >
                          <span className="w-4 shrink-0 text-center">{assignedHere ? "✓" : ""}</span>
                          <span className="truncate">{"↳ ".repeat(Math.max(0, sectionLevel(section) - 1))}{section.title || "(sem título)"}</span>
                        </button>
                      );
                    })}
                  </div>
                  {sections.length === 0 ? <p className="text-[11px] text-muted-foreground">Crie uma seção para adicioná-la a esta página.</p> : null}
                </div>
              )}
              {open && !isWines && (
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <input
                      value={s.title ?? ""}
                      onChange={(e) => patch(s.id, { title: e.target.value })}
                      placeholder="Título impresso (opcional)"
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                    <textarea
                      rows={6}
                      value={s.text ?? ""}
                      onChange={(e) => patch(s.id, { text: e.target.value })}
                      placeholder="Texto (opcional). Comece a linha com • ou - para marcadores."
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                  </div>
                  <MediaUploader
                    label="Imagem da folha (opcional)"
                    value={s.image || null}
                    onChange={(u) => patch(s.id, { image: u ?? "" })}
                    folder={`${restaurantId}/custom-menu`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      </div>
      ) : null}
    </div>
  );
}

/** Painel de design exclusivo — visível apenas para o administrador geral. */
export function CustomDesignPanel({
  value,
  onChange,
  restaurantId,
  onDeliver,
  canDeliver,
}: {
  value: CustomDesign;
  onChange: (v: CustomDesign) => void;
  restaurantId: string;
  onDeliver: () => void;
  canDeliver: boolean;
}) {
  const set = (patch: Partial<CustomDesign>) => onChange({ ...value, ...patch });
  const color = (label: string, key: "bgColor" | "textColor" | "accentColor", defaultValue: string) => (
    <HexColorField
      label={label}
      value={value[key]}
      defaultValue={defaultValue}
      onChange={(nextColor) => set({ [key]: nextColor })}
    />
  );
  return (
    <div className="mt-6 rounded-xl border border-primary/60 bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[2px] text-primary">
          <Sparkles className="h-4 w-4" /> Design exclusivo (administrador)
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={!!value.exclusive} onChange={(e) => set({ exclusive: e.target.checked })} />
          Ativar design exclusivo nesta carta
        </label>
      </div>
      {value.exclusive && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              {color("Fundo", "bgColor", "#ffffff")}
              {color("Texto", "textColor", "#000000")}
              {color("Destaque (títulos)", "accentColor", "#800020")}
            </div>
            <MediaUploader
              label="Fundo / textura das páginas"
              value={value.backgroundImage ?? null}
              onChange={(u) => set({ backgroundImage: u ?? "" })}
              folder={`${restaurantId}/custom-menu`}
            />
          </div>
        </>
      )}
      {canDeliver && (
        <button
          onClick={onDeliver}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground"
        >
          Salvar e disponibilizar ao restaurante
        </button>
      )}
    </div>
  );
}
