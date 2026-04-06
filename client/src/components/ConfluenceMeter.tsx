interface Props {
  score: number; // -10 to +10
  type: string;
}

export default function ConfluenceMeter({ score, type }: Props) {
  // Normalize score to 0-100 range for display
  const normalized = ((score + 10) / 20) * 100;
  
  const getColor = () => {
    if (score >= 5) return "#22c55e";
    if (score >= 2) return "#4ade80";
    if (score <= -5) return "#ef4444";
    if (score <= -2) return "#f87171";
    return "#eab308";
  };

  const getLabel = () => {
    if (score >= 7) return "Extremely Bullish";
    if (score >= 5) return "Strongly Bullish";
    if (score >= 3) return "Bullish";
    if (score >= 1) return "Slightly Bullish";
    if (score <= -7) return "Extremely Bearish";
    if (score <= -5) return "Strongly Bearish";
    if (score <= -3) return "Bearish";
    if (score <= -1) return "Slightly Bearish";
    return "Neutral";
  };

  return (
    <div className="space-y-2">
      {/* Score Display */}
      <div className="flex items-center justify-center">
        <span className="text-3xl font-bold font-mono" style={{ color: getColor() }}>
          {score > 0 ? "+" : ""}{score}
        </span>
        <span className="text-xs text-muted-foreground ml-1 self-end mb-1">/10</span>
      </div>
      
      {/* Bar */}
      <div className="relative h-3 bg-card rounded-full overflow-hidden border border-border/30">
        {/* Background gradient */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 bg-gradient-to-r from-red-500/30 to-red-500/10" />
          <div className="flex-1 bg-gradient-to-r from-red-500/10 via-yellow-500/10 to-emerald-500/10" />
          <div className="flex-1 bg-gradient-to-r from-emerald-500/10 to-emerald-500/30" />
        </div>
        {/* Indicator dot */}
        <div
          className="absolute top-0 h-full w-3 rounded-full transition-all duration-700 ease-out"
          style={{
            left: `calc(${normalized}% - 6px)`,
            backgroundColor: getColor(),
            boxShadow: `0 0 8px ${getColor()}80`,
          }}
        />
      </div>
      
      {/* Labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground px-1">
        <span>-10 Sell</span>
        <span>{getLabel()}</span>
        <span>+10 Buy</span>
      </div>

      {/* Zone markers */}
      <div className="flex justify-between text-[8px] px-1">
        <span className="text-red-500">Strong Sell</span>
        <span className="text-red-400">Sell</span>
        <span className="text-yellow-500">Hold</span>
        <span className="text-emerald-400">Buy</span>
        <span className="text-emerald-500">Strong Buy</span>
      </div>
    </div>
  );
}
