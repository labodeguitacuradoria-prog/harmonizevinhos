import type { FontKey } from "@/components/printed-menu/templates";

export const MENU_PALETTES = [
  { key: "white", label: "Branco", bgColor: "#ffffff", textColor: "#202020", accentColor: "#800020" },
  { key: "ivory", label: "Marfim", bgColor: "#fbf8f1", textColor: "#252525", accentColor: "#800020" },
  { key: "forest", label: "Verde floresta", bgColor: "#163024", textColor: "#f5f5f0", accentColor: "#e5c578" },
  { key: "blue", label: "Azul claro", bgColor: "#dbeaf5", textColor: "#0f1e36", accentColor: "#800020" },
  { key: "graphite", label: "Grafite", bgColor: "#141414", textColor: "#f5f5f0", accentColor: "#e5c578" },
  { key: "wine", label: "Vinho", bgColor: "#800020", textColor: "#ffffff", accentColor: "#f1e788" },
] as const;

export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function readableColors(bgColor: string, textColor?: string, accentColor?: string) {
  const bg = /^#[0-9a-f]{6}$/i.test(bgColor) ? bgColor : MENU_PALETTES[0].bgColor;
  const fallback = contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#000000") ? "#ffffff" : "#000000";
  const safe = (color?: string) => color && /^#[0-9a-f]{6}$/i.test(color) && contrastRatio(bg, color) >= 4.5 ? color : fallback;
  return { bgColor: bg, textColor: safe(textColor), accentColor: safe(accentColor) };
}

export const MENU_LOOKS: { key: string; title: string; paper: "A4" | "A5" | "DL" | "Letter"; model: "classico" | "moderno" | "minimal"; palette: string; font: FontKey; logo: boolean; cols?: boolean }[] = [
  { key: "nobre", title: "Clássica Nobre", paper: "A4", model: "classico", palette: "ivory", font: "serif", logo: false },
  { key: "duas", title: "Duas colunas", paper: "A4", model: "moderno", palette: "white", font: "serif", logo: true, cols: true },
  { key: "contemp", title: "Contemporânea", paper: "A4", model: "minimal", palette: "white", font: "sans", logo: true },
  { key: "taca", title: "Taças da semana", paper: "DL", model: "classico", palette: "ivory", font: "serif", logo: true },
  { key: "mesa", title: "Mesa compacta", paper: "A5", model: "classico", palette: "ivory", font: "slab", logo: false },
  { key: "forest", title: "Floresta Nobre", paper: "A4", model: "classico", palette: "forest", font: "serif", logo: true },
  { key: "blue", title: "Azul Mediterrâneo", paper: "A4", model: "minimal", palette: "blue", font: "sans", logo: true },
  { key: "graphite", title: "Noite em Grafite", paper: "A4", model: "moderno", palette: "graphite", font: "slab", logo: true, cols: true },
  { key: "wine", title: "Assinatura Vinho", paper: "A5", model: "classico", palette: "wine", font: "script", logo: true },
  { key: "mono", title: "Seleção Autoral", paper: "Letter", model: "minimal", palette: "blue", font: "mono", logo: true },
];