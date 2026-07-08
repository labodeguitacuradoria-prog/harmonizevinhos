import { useEffect, useState } from "react";
import { Info } from "lucide-react";

type Props = {
  label: string;
  hint: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
};

// Numeric input that accepts both "." and "," as decimal separator,
// keeps a local text buffer so partial values like "13." or "0," stay typable,
// and only emits parsed numbers to the parent.
export function NumberInput({ label, hint, value, onChange, placeholder, step, min, max }: Props) {
  const [text, setText] = useState<string>(value != null ? String(value) : "");

  // Keep local text in sync when parent value changes from the outside (e.g. AI extraction),
  // but do NOT overwrite what the user is currently typing.
  useEffect(() => {
    const parsed = text.replace(",", ".");
    const parsedNum = parsed === "" ? null : Number(parsed);
    if (value !== parsedNum) {
      setText(value != null ? String(value) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(raw: string) {
    // Allow only digits, one separator, optional leading minus.
    const cleaned = raw.replace(/[^\d.,-]/g, "");
    setText(cleaned);
    const normalized = cleaned.replace(",", ".");
    if (normalized === "" || normalized === "-" || normalized === "." || normalized === "-.") {
      onChange(null);
      return;
    }
    // partial like "13." → don't push NaN, keep waiting
    if (/[.]$/.test(normalized)) return;
    const n = Number(normalized);
    if (Number.isFinite(n)) onChange(n);
  }

  return (
    <div className="grid gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span title={hint} className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center text-muted-foreground/60 hover:text-primary">
          <Info className="h-3 w-3" />
        </span>
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
      />
    </div>
  );
}
