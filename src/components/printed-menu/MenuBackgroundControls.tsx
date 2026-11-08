import { Button } from "@/components/ui/button";
import { MENU_PALETTES, readableColors } from "@/lib/menu-appearance";
import type { CustomDesign } from "./MenuPreview";

export function MenuBackgroundControls({ value, onChange }: { value: CustomDesign; onChange: (next: CustomDesign) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {MENU_PALETTES.map((p) => (
          <Button key={p.key} variant="outline" size="icon" title={p.label} aria-label={p.label} aria-pressed={value.bgColor === p.bgColor}
            onClick={() => onChange({ ...value, bgColor: p.bgColor, textColor: p.textColor, accentColor: p.accentColor })}
            className={`menu-swatch palette-${p.key} ${value.bgColor === p.bgColor ? "ring-2 ring-primary" : ""}`} />
        ))}
      </div>
      <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        Cor personalizada
        <input type="color" aria-label="Cor de fundo personalizada" value={value.bgColor || MENU_PALETTES[0].bgColor}
          onChange={(e) => onChange({ ...value, ...readableColors(e.target.value, value.textColor, value.accentColor) })}
          className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-0.5" />
      </label>
    </div>
  );
}