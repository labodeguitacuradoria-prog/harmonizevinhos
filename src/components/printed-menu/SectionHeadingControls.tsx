import { AlignCenter, AlignLeft, AlignRight, Bold, Minus, Plus, Underline, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaUploader } from "@/components/MediaUploader";
import { FONT_LIST, type SectionHeadingStyle } from "./templates";

type Props = {
  value: SectionHeadingStyle;
  onChange: (patch: Partial<SectionHeadingStyle>) => void;
  onReset: () => void;
};

const inputClass = "h-8 min-w-0 w-full rounded border border-input bg-background px-2 text-xs text-foreground";

function HeadingStepper({
  label,
  value,
  fallback,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number | undefined;
  fallback: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number | undefined) => void;
}) {
  const current = value ?? fallback;
  const adjust = (amount: number) => onChange(Math.min(max, Math.max(min, Number((current + amount).toFixed(1)))));

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{label}</span>
        <button type="button" className="text-[9px] text-primary hover:underline" onClick={() => onChange(undefined)}>
          Padrão
        </button>
      </div>
      <div className="grid grid-cols-[2rem_minmax(3.5rem,1fr)_2rem] items-center gap-1">
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={`Diminuir ${label.toLowerCase()}`} title="Diminuir" onClick={() => adjust(-step)}>
          <Minus />
        </Button>
        <div className="flex h-8 min-w-0 items-center rounded border border-input bg-background px-1">
          <input
            aria-label={label}
            className="w-full min-w-0 bg-transparent text-center text-xs tabular-nums text-foreground outline-none"
            type="number"
            min={min}
            max={max}
            step={step}
            value={value ?? ""}
            placeholder={String(fallback)}
            onChange={(event) => {
              if (event.target.value === "") return onChange(undefined);
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
            }}
          />
          <span className="text-[9px] text-muted-foreground">pt</span>
        </div>
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label={`Aumentar ${label.toLowerCase()}`} title="Aumentar" onClick={() => adjust(step)}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}

export function SectionHeadingControls({ value, onChange, onReset }: Props) {
  const color = value.color ?? "#d4af37";
  const imageSize = value.accentImageSize ?? 16;
  const changeImageSize = (amount: number) => onChange({ accentImageSize: Math.min(40, Math.max(6, imageSize + amount)) });
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase text-primary">Título desta seção</span>
        <Button type="button" size="sm" variant="ghost" onClick={onReset} title="Restaurar aparência geral" aria-label="Restaurar aparência geral"><RotateCcw /></Button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <label className="col-span-2 min-w-0 text-[10px] text-muted-foreground">Fonte
          <select className={inputClass} value={value.font ?? ""} onChange={(e) => onChange({ font: (e.target.value || undefined) as SectionHeadingStyle["font"] })}>
            <option value="">Padrão</option>
            {FONT_LIST.map((font) => <option key={font.key} value={font.key}>{font.label}</option>)}
          </select>
        </label>
        <HeadingStepper label="Tamanho" value={value.size} fallback={12} min={6} max={40} step={0.5} onChange={(size) => onChange({ size })} />
        <HeadingStepper label="Entre letras" value={value.letterSpacing} fallback={0} min={0} max={10} step={0.5} onChange={(letterSpacing) => onChange({ letterSpacing })} />
        <label className="col-span-2 min-w-0 text-[10px] text-muted-foreground">Cor das letras
          <span className="flex h-8 items-center gap-1 rounded border border-input bg-background px-1">
            <input type="color" aria-label="Escolher cor das letras" className="h-6 w-8 shrink-0 cursor-pointer bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#d4af37"} onChange={(e) => onChange({ color: e.target.value })} />
            <input aria-label="Código da cor das letras" className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none" value={value.color ?? ""} placeholder="Padrão" maxLength={7} onChange={(e) => onChange({ color: e.target.value.toLowerCase() })} />
          </span>
        </label>
        <div className="min-w-0">
          <span className="block text-[10px] text-muted-foreground">Alinhamento</span>
          <div className="flex gap-1">
            {([{ key: "left", icon: AlignLeft, label: "Esquerda" }, { key: "center", icon: AlignCenter, label: "Centro" }, { key: "right", icon: AlignRight, label: "Direita" }] as const).map(({ key, icon: Icon, label }) => (
              <Button key={key} type="button" size="icon" className="h-8 w-8" variant={value.align === key ? "secondary" : "outline"} aria-label={label} title={label} aria-pressed={value.align === key} onClick={() => onChange({ align: key })}><Icon /></Button>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <span className="block text-[10px] text-muted-foreground">Ênfase</span>
          <div className="flex gap-1">
            <Button type="button" size="icon" className="h-8 w-8" variant={value.bold ? "secondary" : "outline"} title="Negrito" aria-label="Negrito" aria-pressed={!!value.bold} onClick={() => onChange({ bold: !value.bold })}><Bold /></Button>
            <Button type="button" size="icon" className="h-8 w-8" variant={value.underline ? "secondary" : "outline"} title="Sublinhado" aria-label="Sublinhado" aria-pressed={!!value.underline} onClick={() => onChange({ underline: !value.underline })}><Underline /></Button>
          </div>
        </div>
        <label className="min-w-0 text-[10px] text-muted-foreground">Sinais
          <select className={inputClass} value={value.accent ?? "none"} onChange={(e) => onChange({ accent: e.target.value as SectionHeadingStyle["accent"] })}>
            <option value="none">Sem sinais</option><option value="star">✦ Estrelas</option><option value="diamond">◆ Losangos</option><option value="dash">— Traços</option><option value="image">Imagem própria</option>
          </select>
        </label>
        <label className="min-w-0 text-[10px] text-muted-foreground">Moldura
          <select className={inputClass} value={value.frame ?? "none"} onChange={(e) => onChange({ frame: e.target.value as SectionHeadingStyle["frame"] })}>
            <option value="none">Sem moldura</option><option value="outline">Contorno</option><option value="filled">Caixa preenchida</option>
          </select>
        </label>
      </div>
      {value.accent === "image" ? (
        <div className="grid gap-3 rounded border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <MediaUploader
            label="Imagem do sinal"
            value={value.accentImageUrl ?? null}
            onChange={(url) => onChange({ accentImageUrl: url ?? undefined })}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            folder="catalog/menu-heading-icons"
            kind="image"
          />
          <div>
            <span className="block text-[10px] text-muted-foreground">Tamanho da imagem</span>
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="Diminuir imagem" title="Diminuir imagem" onClick={() => changeImageSize(-1)}><Minus /></Button>
              <input
                aria-label="Tamanho da imagem em pontos"
                className="h-8 w-14 rounded border border-input bg-background px-1 text-center text-xs text-foreground"
                type="number"
                min="6"
                max="40"
                value={imageSize}
                onChange={(event) => onChange({ accentImageSize: Math.min(40, Math.max(6, Number(event.target.value) || 6)) })}
              />
              <span className="text-[10px] text-muted-foreground">pt</span>
              <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="Aumentar imagem" title="Aumentar imagem" onClick={() => changeImageSize(1)}><Plus /></Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}