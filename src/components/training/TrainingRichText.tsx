import { List } from "lucide-react";
import { Button } from "@/components/ui/button";

type TrainingTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  className?: string;
};

export function TrainingTextarea({
  value,
  onChange,
  rows = 2,
  maxLength,
  className = "",
}: TrainingTextareaProps) {
  function toggleBullets() {
    const lines = value.split("\n");
    const hasBullets = lines.some((line) => /^\s*[-*•]\s+/.test(line));
    const next = lines
      .map((line) => {
        if (!line.trim()) return line;
        return hasBullets ? line.replace(/^\s*[-*•]\s+/, "") : `• ${line.replace(/^\s*[-*•]\s+/, "")}`;
      })
      .join("\n");
    onChange(next);
  }

  return (
    <div className="relative mt-1">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        maxLength={maxLength}
        className={`${className} mt-0 pr-11`}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={toggleBullets}
        title="Adicionar ou remover marcadores"
        aria-label="Adicionar ou remover marcadores"
        className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TrainingRichText({ text, italic = false }: { text?: string | null; italic?: boolean }) {
  if (!text?.trim()) return null;

  const lines = text.split(/\r?\n/);
  const content: React.ReactNode[] = [];
  let bullets: string[] = [];

  function flushBullets() {
    if (!bullets.length) return;
    content.push(
      <ul key={`list-${content.length}`} className="list-outside list-disc space-y-1 pl-5">
        {bullets.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
      </ul>,
    );
    bullets = [];
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet?.[1]) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets();
    if (trimmed) content.push(<p key={`line-${content.length}`}>{trimmed}</p>);
  });
  flushBullets();

  return <div className={`space-y-1.5 whitespace-pre-wrap ${italic ? "italic" : ""}`}>{content}</div>;
}