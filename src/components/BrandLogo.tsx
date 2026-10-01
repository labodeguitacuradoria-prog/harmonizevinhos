import { cn } from "@/lib/utils";

/** Símbolo oficial La Bodeguita: garrafa de 22 linhas alternando dourado e branco. */
const LINES: Array<[number, number]> = [
  [57, 63], [56, 64], [56, 64], [56, 64], [56, 64], [54, 66], [52, 68],
  [50, 70], [50, 70], [50, 70], [50, 70], [50, 70], [50, 70], [50, 70],
  [50, 70], [50, 70], [50, 70], [50, 70], [50, 70], [50, 70], [50, 70], [52, 68],
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="48 10 24 88" className={cn("h-8 w-[9px]", className)} aria-hidden="true">
      {LINES.map(([x1, x2], i) => (
        <line
          key={i}
          x1={x1}
          x2={x2}
          y1={12 + i * 4}
          y2={12 + i * 4}
          strokeWidth={2}
          style={{ stroke: i % 2 === 0 ? "var(--gold)" : "var(--foreground)" }}
        />
      ))}
    </svg>
  );
}

export function BrandLogo({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact" | "stacked";
  className?: string;
}) {
  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-1.5", className)}>
        <BrandMark className="h-10 w-5" />
        <span className="brand-font text-center text-[8px] font-medium uppercase leading-tight tracking-[0.25em] text-primary">
          La<br />Bodeguita
        </span>
      </div>
    );
  }
  const big = variant === "full";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className={big ? "h-10 w-5" : "h-7 w-3.5"} />
      <div className="brand-font flex flex-col leading-none">
        <span className={cn("font-light uppercase tracking-[0.12em] text-foreground", big ? "text-lg" : "text-sm")}>
          La Bodeguita
        </span>
        <span className={cn("mt-1 font-medium uppercase tracking-[0.25em] text-primary", big ? "text-[9px]" : "text-[8px]")}>
          Gestão de Vinhos
        </span>
      </div>
    </div>
  );
}
