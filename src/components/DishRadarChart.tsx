type Props = { values: { label: string; value: number }[]; size?: number };

// Radar sensorial do prato (0 a 10) no padrão dourado/vinho do sistema.
export function DishRadarChart({ values, size = 260 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = values.length;

  const point = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const d = (Math.max(0, Math.min(10, v)) / 10) * r;
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d] as const;
  };

  const poly = values.map((v, i) => point(i, v.value).join(",")).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} className="max-h-[280px]">
      {[2, 4, 6, 8, 10].map((step) => (
        <polygon
          key={step}
          points={values.map((_, i) => point(i, step).join(",")).join(" ")}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={1}
        />
      ))}
      {values.map((_, i) => {
        const [x, y] = point(i, 10);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2a2a2a" strokeWidth={1} />;
      })}
      <polygon points={poly} fill="#D4AF3733" stroke="#D4AF37" strokeWidth={2} />
      {values.map((v, i) => {
        const [x, y] = point(i, v.value);
        return <circle key={i} cx={x} cy={y} r={3} fill="#D4AF37" />;
      })}
      {values.map((v, i) => {
        const [x, y] = point(i, 12.4);
        return (
          <text
            key={v.label}
            x={x}
            y={y}
            textAnchor={x > cx + 4 ? "start" : x < cx - 4 ? "end" : "middle"}
            dominantBaseline="middle"
            fontSize={9}
            fill="#888"
            style={{ textTransform: "uppercase", letterSpacing: 0.6 }}
          >
            {v.label} {v.value}
          </text>
        );
      })}
    </svg>
  );
}

export default DishRadarChart;
