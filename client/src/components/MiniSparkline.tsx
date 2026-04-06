interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export default function MiniSparkline({ data, color = "#22c55e", width = 80, height = 28 }: Props) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;

  const sampled = data.length > 30 ? data.filter((_, i) => i % Math.ceil(data.length / 30) === 0) : data;
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = max - min || 1;

  const points = sampled.map((v, i) => {
    const x = (i / (sampled.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
