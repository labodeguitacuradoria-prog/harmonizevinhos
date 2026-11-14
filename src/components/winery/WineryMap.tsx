import { useRef, useState } from "react";
import { MAP_COLORS, computeWineryMap, type CountryShape, type LabelSide } from "@/lib/winery-map";

/** Mapa interativo: clique ou arraste o ponto para ajustar a posição da vinícola. */
export function WineryMap({ shape, lat, lng, name, side, onMove }: {
  shape: CountryShape; lat: number; lng: number; name: string; side: LabelSide;
  onMove: (p: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ lat: number; lng: number } | null>(null);
  const cur = drag ?? { lat, lng };
  const g = computeWineryMap(shape, { lat: cur.lat, lng: cur.lng, name, side });
  const toGeo = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return g.invert(((e.clientX - r.left) / r.width) * g.width, ((e.clientY - r.top) / r.height) * g.height);
  };
  const c = MAP_COLORS;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${g.width} ${g.height}`}
      className="h-auto w-full touch-none select-none"
      style={{ cursor: drag ? "grabbing" : "crosshair" }}
      role="img"
      aria-label={`Mapa de ${shape.pt ?? shape.name} com a localização de ${name}. Clique para mover o ponto.`}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(toGeo(e)); }}
      onPointerMove={(e) => { if (drag) setDrag(toGeo(e)); }}
      onPointerUp={(e) => { if (drag) { const p = toGeo(e); setDrag(null); onMove(p); } }}
      onPointerCancel={() => setDrag(null)}
    >
      {g.rings.map((r, i) => <path key={i} d={"M" + r.map(([x, y]) => `${x},${y}`).join("L") + "Z"} fill={c.land} stroke={c.border} strokeWidth={1.2} strokeLinejoin="round" />)}
      <polyline points={g.line.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={c.line} strokeWidth={1} />
      <circle cx={g.point[0]} cy={g.point[1]} r={10} fill={c.halo} />
      <circle cx={g.point[0]} cy={g.point[1]} r={5} fill={c.dot} stroke="#ffffff" strokeWidth={1.5} />
      <text x={g.label.x} y={g.label.y} textAnchor={g.label.anchor} fontFamily="Times New Roman, Times, serif" fontWeight={700} fontSize={g.label.size} fill={c.ink} stroke="#ffffff" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">{g.label.text}</text>
    </svg>
  );
}
