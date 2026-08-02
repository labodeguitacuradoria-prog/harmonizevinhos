import { useEffect, useState } from "react";

type Props = { text: string; speed?: number; className?: string };

/** Revela o texto palavra por palavra, como uma máquina de escrever. */
export function TypewriterText({ text, speed = 45, className }: Props) {
  const words = text.split(/(\s+)/);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
  }, [text]);

  useEffect(() => {
    if (count >= words.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), speed);
    return () => clearTimeout(t);
  }, [count, words.length, speed]);

  const shown = words.slice(0, count).join("");

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{
        __html: shown.replace(/\*\*(.+?)\*\*/g, '<strong class="text-primary">$1</strong>'),
      }}
    />
  );
}

export default TypewriterText;
