// Cumulative-R curve for ONE mode, built from that mode's closed journal
// trades (pnl_usd / risk_usd) — nothing shared, nothing mixed.

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { JournalEntry } from "@/lib/types";
import { tradeR } from "@/lib/format";
import { Panel, EmptyState } from "@/components/ui-kit";

const MODE_COLOR: Record<string, string> = {
  paper: "#8b7bf7",
  live: "#f0b90b",
};

export default function EquityCurve({ mode, journal }: { mode: "paper" | "live"; journal: JournalEntry[] }) {
  const curve = useMemo(() => {
    const closed = journal
      .filter(t => t.mode === mode && t.outcome !== "open" && t.closed_at && tradeR(t) != null)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());
    let acc = 0;
    return closed.map(t => {
      acc += tradeR(t)!;
      return {
        date: new Date(t.closed_at!).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        r: Math.round(acc * 100) / 100,
      };
    });
  }, [journal, mode]);

  const color = MODE_COLOR[mode];

  return (
    <Panel title="Curva de equity (R acumulado)" aside={<span className="text-[11px] text-muted-foreground">{curve.length} trades fechados</span>}>
      {curve.length < 2 ? (
        <EmptyState title="Ainda não há trades fechados suficientes" hint="A curva aparece com o histórico." />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id={`grad-${mode}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8b90a0" }} tickLine={false} axisLine={false} minTickGap={48} />
              <YAxis tick={{ fontSize: 10, fill: "#8b90a0" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}R`} width={52} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
              <Tooltip
                contentStyle={{
                  background: "hsl(228 16% 8%)", border: "1px solid hsl(228 12% 14%)",
                  borderRadius: 8, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                }}
                labelStyle={{ color: "#8b90a0" }}
                formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}R`, "acumulado"]}
              />
              <Area type="monotone" dataKey="r" stroke={color} strokeWidth={1.5} fill={`url(#grad-${mode})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
