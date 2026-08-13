interface Props {
  data: number[];
  width?: number;
  height?: number;
}

/** Inline SVG sparkline coloured by direction (first → last). */
export default function Sparkline({ data, width = 96, height = 28 }: Props) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="rounded bg-card-2/50" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / range) * (height - 4)}`)
    .join(" ");
  const upward = data[data.length - 1] >= data[0];
  const color = upward ? "#2ebd85" : "#f6465d";

  return (
    <svg width={width} height={height} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  );
}
