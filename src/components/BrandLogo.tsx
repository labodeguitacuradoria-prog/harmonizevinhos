import { cn } from "@/lib/utils";

/** Símbolo La Bodeguita: garrafa formada por linhas horizontais em dourado e branco. */
export function BrandMark({ className }: { className?: string }) {
  // Larguras das linhas de cima (gargalo) para baixo (corpo)
  const rows = [4, 4, 4, 6, 10, 14, 16, 16, 16, 16, 16, 16];
  return (
    <svg viewBox="0 0 20 40" className={cn("h-8 w-4", className)} aria-hidden="true">
      {rows.map((w, i) => (
        <rect
          key={i}
          x={(20 - w) / 2}
          y={2 + i * 3.1}
          width={w}
          height={1.8}
          rx={0.9}
          style={{ fill: i % 2 === 0 ? "var(--gold)" : "var(--foreground)" }}
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
