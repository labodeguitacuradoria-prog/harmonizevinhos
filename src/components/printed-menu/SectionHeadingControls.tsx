import { AlignCenter, AlignLeft, AlignRight, Bold, Underline, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FONT_LIST, type SectionHeadingStyle } from "./templates";

type Props = {
  value: SectionHeadingStyle;
  onChange: (patch: Partial<SectionHeadingStyle>) => void;
  onReset: () => void;
};

const inputClass = "h-8 min-w-0 w-full rounded border border-input bg-background px-2 text-xs text-foreground";

export function SectionHeadingControls({ value, onChange, onReset }: Props) {
  const color = value.color ?? "#d4af37";
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase text-primary">Título desta seção</span>
        <Button type="button" size="sm" variant="ghost" onClick={onReset} title="Restaurar aparência geral" aria-label="Restaurar aparência geral"><RotateCcw /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="min-w-0 text-[10px] text-muted-foreground">Fonte
          <select className={inputClass} value={value.font ?? ""} onChange={(e) => onChange({ font: (e.target.value || undefined) as SectionHeadingStyle["font"] })}>
            <option value="">Padrão</option>
            {FONT_LIST.map((font) => <option key={font.key} value={font.key}>{font.label}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-[10px] text-muted-foreground">Tamanho (pt)
          <input className={inputClass} type="number" min="6" max="40" step="0.5" placeholder="Padrão" value={value.size ?? ""} onChange={(e) => onChange({ size: e.target.value === "" ? undefined : Math.min(40, Math.max(6, Number(e.target.value))) })} />
        </label>
        <label className="min-w-0 text-[10px] text-muted-foreground">Entre letras (pt)
          <input className={inputClass} type="number" min="0" max="10" step="0.5" value={value.letterSpacing ?? ""} placeholder="Padrão" onChange={(e) => onChange({ letterSpacing: e.target.value === "" ? undefined : Math.min(10, Math.max(0, Number(e.target.value))) })} />
        </label>
        <label className="min-w-0 text-[10px] text-muted-foreground">Cor das letras
          <span className="flex h-8 items-center gap-1 rounded border border-input bg-background px-1">
            <input type="color" aria-label="Escolher cor das letras" className="h-6 w-8 shrink-0 cursor-pointer bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#d4af37"} onChange={(e) => onChange({ color: e.target.value })} />
            <input aria-label="Código da cor das letras" className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none" value={value.color ?? ""} placeholder="Padrão" maxLength={7} onChange={(e) => onChange({ color: e.target.value.toLowerCase() })} />
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="block text-[10px] text-muted-foreground">Alinhamento</span>
          <div className="flex gap-1">
            {([{ key: "left", icon: AlignLeft, label: "Esquerda" }, { key: "center", icon: AlignCenter, label: "Centro" }, { key: "right", icon: AlignRight, label: "Direita" }] as const).map(({ key, icon: Icon, label }) => (
              <Button key={key} type="button" size="icon" className="h-8 w-8" variant={value.align === key ? "secondary" : "outline"} aria-label={label} title={label} aria-pressed={value.align === key} onClick={() => onChange({ align: key })}><Icon /></Button>
            ))}
          </div>
        </div>
        <div>
          <span className="block text-[10px] text-muted-foreground">Ênfase</span>
          <div className="flex gap-1">
            <Button type="button" size="icon" className="h-8 w-8" variant={value.bold ? "secondary" : "outline"} title="Negrito" aria-label="Negrito" aria-pressed={!!value.bold} onClick={() => onChange({ bold: !value.bold })}><Bold /></Button>
            <Button type="button" size="icon" className="h-8 w-8" variant={value.underline ? "secondary" : "outline"} title="Sublinhado" aria-label="Sublinhado" aria-pressed={!!value.underline} onClick={() => onChange({ underline: !value.underline })}><Underline /></Button>
          </div>
        </div>
        <label className="min-w-[110px] flex-1 text-[10px] text-muted-foreground">Sinais
          <select className={inputClass} value={value.accent ?? "none"} onChange={(e) => onChange({ accent: e.target.value as SectionHeadingStyle["accent"] })}>
            <option value="none">Sem sinais</option><option value="star">✦ Estrelas</option><option value="diamond">◆ Losangos</option><option value="dash">— Traços</option>
          </select>
        </label>
        <label className="min-w-[110px] flex-1 text-[10px] text-muted-foreground">Moldura
          <select className={inputClass} value={value.frame ?? "none"} onChange={(e) => onChange({ frame: e.target.value as SectionHeadingStyle["frame"] })}>
            <option value="none">Sem moldura</option><option value="outline">Contorno</option><option value="filled">Caixa preenchida</option>
          </select>
        </label>
      </div>
    </div>
  );
}