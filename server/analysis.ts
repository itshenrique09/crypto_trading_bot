/**
 * TRADING ANALYSIS ENGINE v2
 *
 * Fixes applied over v1:
 *  1. Stochastic RSI — proper D-line (SMA3 of K)
 *  2. MACD divergence — real swing-high/low comparison
 *  3. Ichimoku — Senkou Span displaced 26 periods, reduced weight
 *  4. EMA200 — guard against insufficient data
 *  5. Order Blocks — structure-break + volume confirmation
 *  6. Fibonacci — direction-aware, symmetrical scoring
 *  7. Market Phase — ATR-relative thresholds
 *  8. Scoring — decorrelated weights, higher thresholds (±3/±6)
 *  9. Entry precision — accepts 15m candles for tight stop placement
 * 10. No hardcoded R:R — actual values computed per trade
 */

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Core Math ───────────────────────────────────────────────────

function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const result: number[] = [data[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result[i] = data[i]; continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result[i] = sum / period;
  }
  return result;
}

function stdDev(data: number[], period: number, smaValues: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result[i] = 0; continue; }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (data[j] - smaValues[i]) ** 2;
    result[i] = Math.sqrt(sumSq / period);
  }
  return result;
}

// ─── Interfaces ──────────────────────────────────────────────────

export interface IndicatorResult {
  rsi: number;
  stochRsi: { k: number; d: number };
  macd: { line: number; signal: number; histogram: number };

  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  ema200reliable: boolean; // false when data < 200 candles

  ichimoku: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    cloudTop: number;
    cloudBottom: number;
    priceVsCloud: "above" | "below" | "inside";
    cloudColor: "green" | "red";
    tkCross: "bullish" | "bearish" | "none";
  };

  bollingerBands: { upper: number; middle: number; lower: number; width: number; percentB: number };
  atr: number;
  atrPercent: number;

  obv: number;
  obvTrend: "rising" | "falling" | "flat";
  volumeRatio: number;
  volumeSma: number;

  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  swingHighs: number[];
  swingLows: number[];

  support: number;
  resistance: number;
  fibLevels: { level: string; price: number; direction?: "up" | "down" }[];
}

export interface OrderBlock {
  type: "bullish" | "bearish";
  high: number;
  low: number;
  strength: number;
  index: number;
}

export interface FairValueGap {
  type: "bullish" | "bearish";
  high: number;
  low: number;
  filled: boolean;
  index: number;
}

export interface TradeSignal {
  type: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  confluenceScore: number;
  confidence: number;
  reason: string;
  detailedReasons: string[];
  indicators: Record<string, { value: string; bias: "bullish" | "bearish" | "neutral" }>;

  entry?: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  riskRewardRatio: number;
  positionSizePct: number;

  trend: "strong_up" | "up" | "sideways" | "down" | "strong_down";
  volatility: "low" | "medium" | "high" | "extreme";
  marketPhase: "accumulation" | "markup" | "distribution" | "markdown";
}

// ─── RSI (Wilder's smoothing — correct) ──────────────────────────

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return rsi;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

// ─── Technical TP finder — nearest swing level beyond entry ──────
//
// Scans recent candles for confirmed swing highs/lows and returns the
// nearest and second-nearest level on the profit side of the entry.
// Falls back to R:R multiples when no clear structural level exists.
//
function findTechnicalTPs(
  candles: OHLCV[],
  entry: number,
  stopLoss: number,
  isLong: boolean
): { tp1: number; tp2: number } {
  const risk = Math.abs(entry - stopLoss);

  // Quality floor: a trade must offer ≥2R reward to be worth taking. The 1%
  // floor protects micro-priced coins (PEPE, SHIB) where ATR can be so small
  // that 2R is indistinguishable from entry. Not an invented target — the
  // minimum bar a trade must clear to be considered.
  const minDist = Math.max(risk * 2.0, entry * 0.01);

  const swingWindow = 3;
  const end   = Math.max(0, candles.length - 2);
  const start = Math.max(0, end - 200);

  const levels: number[] = [];
  for (let i = start + swingWindow; i < end - swingWindow; i++) {
    if (isLong) {
      const isSwingHigh =
        candles.slice(i - swingWindow, i).every(c => c.high <= candles[i].high) &&
        candles.slice(i + 1, i + swingWindow + 1).every(c => c.high <= candles[i].high);
      if (isSwingHigh && candles[i].high > entry + minDist) levels.push(candles[i].high);
    } else {
      const isSwingLow =
        candles.slice(i - swingWindow, i).every(c => c.low >= candles[i].low) &&
        candles.slice(i + 1, i + swingWindow + 1).every(c => c.low >= candles[i].low);
      if (isSwingLow && candles[i].low < entry - minDist) levels.push(candles[i].low);
    }
  }

  if (isLong) levels.sort((a, b) => a - b);
  else        levels.sort((a, b) => b - a);

  // Discard unreachably-far swings (>5R or >8% of entry). Real structure but
  // unlikely to fill within the strategy's hold window — would freeze capital.
  const maxDist = Math.max(risk * 5, entry * 0.08);
  const withinReach = levels.filter(v => Math.abs(v - entry) <= maxDist);

  // Merge swings within the same zone — a cluster of pivots within 0.5R is
  // one level on the chart, not two. This is how a trader draws horizontals:
  // a single line through a cluster of nearby highs/lows. Without this, two
  // swings 0.1R apart pollute TP2 with a target that's functionally TP1.
  const zoneWidth = risk * 0.5;
  const reachable: number[] = [];
  for (const v of withinReach) {
    if (reachable.length === 0 || Math.abs(v - reachable[reachable.length - 1]) > zoneWidth) {
      reachable.push(v);
    }
  }

  // TP1: nearest reachable structural swing. If none, the 2R quality floor —
  // this is the minimum R:R a trade must offer, not an invented target.
  const tp1Floor = isLong ? entry + minDist : entry - minDist;
  const tp1 = reachable[0] ?? tp1Floor;

  // TP2: next structural swing beyond TP1. If the chart only offers one level
  // ahead, run a single-target trade — TP2 = TP1 collapses to a clean exit at
  // TP1 in both engines (paper closes on next tick, live's MEXC TP order sits
  // at TP1). A pro trader doesn't invent a second target out of thin air.
  const tp2Structural = reachable.find(v => isLong ? v > tp1 : v < tp1);
  const tp2 = tp2Structural ?? tp1;

  return { tp1, tp2 };
}

// ─── Stochastic RSI — FIXED: proper D-line via SMA(3) ────────────

function calcStochRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14, smoothK = 3, smoothD = 3): { k: number; d: number } {
  const rsiValues = calcRSI(closes, rsiPeriod);
  if (rsiValues.length < stochPeriod + smoothK + smoothD) return { k: 50, d: 50 };

  // Raw stoch RSI for each bar
  const rawK: number[] = [];
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const minR = Math.min(...window);
    const maxR = Math.max(...window);
    rawK.push(maxR === minR ? 50 : ((rsiValues[i] - minR) / (maxR - minR)) * 100);
  }

  // Smooth K with SMA(3)
  const smoothedK = sma(rawK, smoothK);
  // D = SMA(3) of smoothed K
  const dLine = sma(smoothedK, smoothD);

  return {
    k: smoothedK[smoothedK.length - 1] ?? 50,
    d: dLine[dLine.length - 1] ?? 50,
  };
}

// ─── MACD ────────────────────────────────────────────────────────

function calcMACD(closes: number[]): { line: number; signal: number; histogram: number; lineArr: number[] } {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const last = closes.length - 1;
  return {
    line: macdLine[last],
    signal: signalLine[last],
    histogram: macdLine[last] - signalLine[last],
    lineArr: macdLine,
  };
}

// ─── MACD Divergence — FIXED: real swing-based comparison ────────

function detectMACDDivergence(
  candles: OHLCV[],
  macdLineArr: number[],
  swingHighIndices: number[],
  swingLowIndices: number[],
): "bullish" | "bearish" | "none" {
  // Need at least 2 swing points to compare
  if (swingHighIndices.length >= 2) {
    const [prevIdx, currIdx] = swingHighIndices.slice(-2);
    if (prevIdx < macdLineArr.length && currIdx < macdLineArr.length) {
      const priceHigherHigh = candles[currIdx].high > candles[prevIdx].high;
      const macdLowerHigh = macdLineArr[currIdx] < macdLineArr[prevIdx];
      if (priceHigherHigh && macdLowerHigh) return "bearish";
    }
  }

  if (swingLowIndices.length >= 2) {
    const [prevIdx, currIdx] = swingLowIndices.slice(-2);
    if (prevIdx < macdLineArr.length && currIdx < macdLineArr.length) {
      const priceLowerLow = candles[currIdx].low < candles[prevIdx].low;
      const macdHigherLow = macdLineArr[currIdx] > macdLineArr[prevIdx];
      if (priceLowerLow && macdHigherLow) return "bullish";
    }
  }

  return "none";
}

// ─── Bollinger Bands ─────────────────────────────────────────────

function calcBollinger(closes: number[], period = 20, mult = 2) {
  const smaVals = sma(closes, period);
  const stds = stdDev(closes, period, smaVals);
  const last = closes.length - 1;
  const middle = smaVals[last];
  const upper = middle + mult * stds[last];
  const lower = middle - mult * stds[last];
  const width = (upper - lower) / middle;
  const percentB = upper === lower ? 0.5 : (closes[last] - lower) / (upper - lower);
  return { upper, middle, lower, width, percentB };
}

// ─── ATR ─────────────────────────────────────────────────────────

function calcATR(candles: OHLCV[], period = 14): number {
  if (candles.length < 2) return 0;
  const trValues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trValues.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    ));
  }
  if (trValues.length < period) return trValues.reduce((a, b) => a + b, 0) / trValues.length;
  let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  return atr;
}

// ─── ADX (Average Directional Index) ─────────────────────────────
// ADX > 25 = strong trend (bad for mean-reversion setups like RSI divergence)
// ADX < 20 = weak/ranging = best environment for divergence plays

function calcADX(candles: OHLCV[], period = 14): number {
  if (candles.length < period * 2 + 1) return 0;
  const trArr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low;
    const ph = candles[i - 1].high, pl = candles[i - 1].low, pc = candles[i - 1].close;
    trArr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const up = h - ph, down = pl - l;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }

  // Wilder's initial sum
  let sTR = trArr.slice(0, period).reduce((a, b) => a + b, 0);
  let sPDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sMDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dxArr: number[] = [];
  for (let i = period; i < trArr.length; i++) {
    sTR  = sTR  - sTR  / period + trArr[i];
    sPDM = sPDM - sPDM / period + plusDM[i];
    sMDM = sMDM - sMDM / period + minusDM[i];
    const pdi = sTR > 0 ? 100 * sPDM / sTR : 0;
    const mdi = sTR > 0 ? 100 * sMDM / sTR : 0;
    const sum = pdi + mdi;
    dxArr.push(sum > 0 ? 100 * Math.abs(pdi - mdi) / sum : 0);
  }

  if (dxArr.length < period) return 0;
  let adx = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxArr.length; i++) adx = (adx * (period - 1) + dxArr[i]) / period;
  return adx;
}

// ─── ATR Percentile — volatility regime detection ────────────────
// Returns 0–100: where the current ATR sits vs the last `lookback` periods.
// >90 = explosive / abnormally high volatility  → bad entries, inflated stops
// <10 = extreme compression                     → not inherently bad, but signals unreliable for some strats
// Engine uses >85 as a filter to skip entering in volatility spikes.
export function calcATRPercentile(candles: OHLCV[], atrPeriod = 14, lookback = 50): number {
  const minNeeded = atrPeriod + lookback;
  if (candles.length < minNeeded) return 50; // insufficient history → neutral

  const atrValues: number[] = [];
  for (let end = candles.length - lookback; end < candles.length; end++) {
    const slice = candles.slice(Math.max(0, end - atrPeriod * 2), end + 1);
    atrValues.push(calcATR(slice, atrPeriod));
  }

  const current = atrValues[atrValues.length - 1];
  const sorted  = [...atrValues].sort((a, b) => a - b);
  const below   = sorted.filter(v => v <= current).length;
  return Math.round((below / sorted.length) * 100);
}

// ─── Ichimoku Cloud — FIXED: displaced Senkou Span ───────────────

function calcIchimoku(candles: OHLCV[]) {
  const highLow = (data: OHLCV[], period: number, endIdx: number) => {
    const start = Math.max(0, endIdx - period + 1);
    const slice = data.slice(start, endIdx + 1);
    return {
      high: Math.max(...slice.map(c => c.high)),
      low: Math.min(...slice.map(c => c.low)),
    };
  };

  const last = candles.length - 1;
  const DISPLACEMENT = 26;

  // Tenkan (conversion) & Kijun (base) at current bar
  const tenkanHL = highLow(candles, 9, last);
  const kijunHL = highLow(candles, 26, last);
  const tenkan = (tenkanHL.high + tenkanHL.low) / 2;
  const kijun = (kijunHL.high + kijunHL.low) / 2;

  // Senkou Span at current position = values computed DISPLACEMENT bars ago
  // (the "cloud" values that have arrived at the current candle)
  const displacedIdx = Math.max(0, last - DISPLACEMENT);
  const dTenkanHL = highLow(candles, 9, displacedIdx);
  const dKijunHL = highLow(candles, 26, displacedIdx);
  const dTenkan = (dTenkanHL.high + dTenkanHL.low) / 2;
  const dKijun = (dKijunHL.high + dKijunHL.low) / 2;
  const senkouA = (dTenkan + dKijun) / 2;

  const senkouBHL = highLow(candles, 52, displacedIdx);
  const senkouB = (senkouBHL.high + senkouBHL.low) / 2;

  const cloudTop = Math.max(senkouA, senkouB);
  const cloudBottom = Math.min(senkouA, senkouB);
  const price = candles[last].close;

  const priceVsCloud: "above" | "below" | "inside" =
    price > cloudTop ? "above" : price < cloudBottom ? "below" : "inside";

  const cloudColor: "green" | "red" = senkouA >= senkouB ? "green" : "red";

  // TK Cross
  let tkCross: "bullish" | "bearish" | "none" = "none";
  if (last > 1) {
    const prevTenkanHL = highLow(candles, 9, last - 1);
    const prevKijunHL = highLow(candles, 26, last - 1);
    const prevTenkan = (prevTenkanHL.high + prevTenkanHL.low) / 2;
    const prevKijun = (prevKijunHL.high + prevKijunHL.low) / 2;
    if (prevTenkan <= prevKijun && tenkan > kijun) tkCross = "bullish";
    else if (prevTenkan >= prevKijun && tenkan < kijun) tkCross = "bearish";
  }

  return { tenkan, kijun, senkouA, senkouB, cloudTop, cloudBottom, priceVsCloud, cloudColor, tkCross };
}

// ─── OBV ─────────────────────────────────────────────────────────

function calcOBV(candles: OHLCV[]): { obv: number; trend: "rising" | "falling" | "flat" } {
  let obv = 0;
  const obvArr: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    obvArr.push(obv);
  }
  const recent = obvArr.slice(-10);
  const obvEma = ema(recent, 5);
  const trend = obvEma[obvEma.length - 1] > obvEma[0] * 1.01 ? "rising" :
                obvEma[obvEma.length - 1] < obvEma[0] * 0.99 ? "falling" : "flat";
  return { obv: obvArr[obvArr.length - 1], trend };
}

// ─── Order Blocks — FIXED: structure break + volume ──────────────

function findOrderBlocks(candles: OHLCV[], lookback = 50): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const len = candles.length;
  const start = Math.max(0, len - lookback);

  // Average volume for context
  const volSlice = candles.slice(Math.max(0, len - 30)).map(c => c.volume);
  const avgVol = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;

  for (let i = start + 2; i < len - 1; i++) {
    const curr = candles[i];
    const next = candles[i + 1];

    const bodySize = Math.abs(next.close - next.open);
    const avgBody = candles.slice(Math.max(0, i - 10), i)
      .reduce((acc, c) => acc + Math.abs(c.close - c.open), 0) / Math.min(10, i);

    // Displacement requirement: next candle body > 2x average
    const hasDisplacement = bodySize > avgBody * 2;
    // Volume confirmation: impulse candle should have above-average volume
    const hasVolume = next.volume > avgVol * 1.2;

    if (!hasDisplacement || !hasVolume) continue;

    // Bullish OB: bearish candle → strong bullish displacement breaking prior swing high
    if (curr.close < curr.open && next.close > curr.high) {
      // Structure break: next candle closes above at least one prior swing high
      const priorHighs = candles.slice(Math.max(0, i - 10), i).map(c => c.high);
      const maxPriorHigh = Math.max(...priorHighs);
      const breaksStructure = next.close > maxPriorHigh;

      if (breaksStructure) {
        blocks.push({
          type: "bullish",
          high: curr.high,
          low: curr.low,
          strength: Math.min(100, (bodySize / avgBody) * 20 + (next.volume / avgVol) * 15),
          index: i,
        });
      }
    }

    // Bearish OB: bullish candle → strong bearish displacement breaking prior swing low
    if (curr.close > curr.open && next.close < curr.low) {
      const priorLows = candles.slice(Math.max(0, i - 10), i).map(c => c.low);
      const minPriorLow = Math.min(...priorLows);
      const breaksStructure = next.close < minPriorLow;

      if (breaksStructure) {
        blocks.push({
          type: "bearish",
          high: curr.high,
          low: curr.low,
          strength: Math.min(100, (bodySize / avgBody) * 20 + (next.volume / avgVol) * 15),
          index: i,
        });
      }
    }
  }

  return blocks.slice(-5);
}

// ─── Fair Value Gaps ─────────────────────────────────────────────

function findFairValueGaps(candles: OHLCV[], lookback = 50): FairValueGap[] {
  const gaps: FairValueGap[] = [];
  const len = candles.length;
  const start = Math.max(0, len - lookback);
  const atr = calcATR(candles);

  for (let i = start + 2; i < len; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    const c2 = candles[i - 1];

    // Bullish FVG: gap between c1.high and c3.low
    if (c3.low > c1.high && c2.close > c2.open) {
      const gapSize = c3.low - c1.high;
      // Only count FVGs that are significant relative to ATR
      if (gapSize > atr * 0.3) {
        const currentPrice = candles[len - 1].close;
        gaps.push({
          type: "bullish",
          high: c3.low,
          low: c1.high,
          filled: currentPrice >= c1.high && currentPrice <= c3.low,
          index: i - 1,
        });
      }
    }

    // Bearish FVG
    if (c3.high < c1.low && c2.close < c2.open) {
      const gapSize = c1.low - c3.high;
      if (gapSize > atr * 0.3) {
        const currentPrice = candles[len - 1].close;
        gaps.push({
          type: "bearish",
          high: c1.low,
          low: c3.high,
          filled: currentPrice <= c1.low && currentPrice >= c3.high,
          index: i - 1,
        });
      }
    }
  }

  return gaps.filter(g => !g.filled).slice(-5);
}

// ─── Swing Points — returns indices too (for divergence) ─────────

function findSwingPoints(candles: OHLCV[], strength = 3): {
  highs: number[]; lows: number[];
  highIndices: number[]; lowIndices: number[];
} {
  const highs: number[] = [];
  const lows: number[] = [];
  const highIndices: number[] = [];
  const lowIndices: number[] = [];

  for (let i = strength; i < candles.length - strength; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= strength; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) { highs.push(candles[i].high); highIndices.push(i); }
    if (isLow) { lows.push(candles[i].low); lowIndices.push(i); }
  }
  return {
    highs: highs.slice(-5), lows: lows.slice(-5),
    highIndices: highIndices.slice(-5), lowIndices: lowIndices.slice(-5),
  };
}

// ─── Fibonacci — FIXED: direction-aware ──────────────────────────

function calcFibonacci(candles: OHLCV[], lookback = 50): { level: string; price: number; direction: "up" | "down" }[] {
  const recent = candles.slice(-lookback);
  const closes = recent.map(c => c.close);
  const high = Math.max(...recent.map(c => c.high));
  const low = Math.min(...recent.map(c => c.low));
  const diff = high - low;
  const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  // Direction: if recent price is closer to the high → uptrend retracement
  //            if closer to the low → downtrend retracement
  const currentPrice = closes[closes.length - 1];
  const midpoint = (high + low) / 2;
  const direction: "up" | "down" = currentPrice >= midpoint ? "up" : "down";

  if (direction === "up") {
    // Uptrend: fib from low (0%) to high (100%), retracements go down
    return fibRatios.map(r => ({
      level: `${(r * 100).toFixed(1)}%`,
      price: low + diff * r,
      direction,
    }));
  } else {
    // Downtrend: fib from high (0%) to low (100%), retracements go up
    return fibRatios.map(r => ({
      level: `${(r * 100).toFixed(1)}%`,
      price: high - diff * r,
      direction,
    }));
  }
}

// ─── Market Phase — FIXED: ATR-relative thresholds ───────────────

function detectMarketPhase(candles: OHLCV[], atrPercent: number): "accumulation" | "markup" | "distribution" | "markdown" {
  const closes = candles.slice(-30).map(c => c.close);
  const ema20 = ema(closes, Math.min(20, closes.length));
  const volumes = candles.slice(-30).map(c => c.volume);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;

  const priceChange = (closes[closes.length - 1] - closes[0]) / closes[0];
  const isVolRising = recentVol > avgVol * 1.2;
  const isAboveEma = closes[closes.length - 1] > ema20[ema20.length - 1];

  // ATR-relative threshold: a "meaningful" move is > 2x the average daily ATR over 30 days
  const moveThreshold = (atrPercent / 100) * 10; // ~10 ATR% over 30 days is meaningful
  const rangeThreshold = (atrPercent / 100) * 4;

  if (priceChange > moveThreshold && isAboveEma) return "markup";
  if (priceChange < -moveThreshold && !isAboveEma) return "markdown";
  if (Math.abs(priceChange) < rangeThreshold && isVolRising && isAboveEma) return "distribution";
  if (Math.abs(priceChange) < rangeThreshold) return "accumulation";
  // Trending but with mixed signals
  return priceChange > 0 ? "markup" : "markdown";
}

// ─── MAIN ANALYSIS FUNCTION ─────────────────────────────────────

export function analyzeIndicators(candles: OHLCV[]): IndicatorResult {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);

  // EMA200: only reliable if we have >= 200 candles
  const ema200reliable = closes.length >= 200;
  const ema200 = ema(closes, ema200reliable ? 200 : closes.length);
  const last = closes.length - 1;

  const rsiValues = calcRSI(closes);
  const rsi = rsiValues[last];
  const stochRsi = calcStochRSI(closes);
  const macdResult = calcMACD(closes);
  const bb = calcBollinger(closes);
  const atr = calcATR(candles);
  const atrPercent = (atr / closes[last]) * 100;
  const ichimoku = calcIchimoku(candles);
  const obvResult = calcOBV(candles);

  const volumeSlice = volumes.slice(-20);
  const volumeSma = volumeSlice.reduce((a, b) => a + b, 0) / volumeSlice.length;
  const volumeRatio = volumeSma > 0 ? volumes[last] / volumeSma : 1;

  const orderBlocks = findOrderBlocks(candles);
  const fvgs = findFairValueGaps(candles);
  const { highs, lows } = findSwingPoints(candles);
  const fibLevels = calcFibonacci(candles);

  const support = lows.length > 0
    ? Math.max(...lows.filter(l => l < closes[last]), closes[last] * 0.95)
    : closes[last] * 0.95;
  const resistance = highs.length > 0
    ? Math.min(...highs.filter(h => h > closes[last]), closes[last] * 1.05)
    : closes[last] * 1.05;

  return {
    rsi,
    stochRsi,
    macd: { line: macdResult.line, signal: macdResult.signal, histogram: macdResult.histogram },
    ema9: ema9[last],
    ema21: ema21[last],
    ema50: ema50[last],
    ema200: ema200[last],
    ema200reliable,
    ichimoku,
    bollingerBands: bb,
    atr,
    atrPercent,
    obv: obvResult.obv,
    obvTrend: obvResult.trend,
    volumeRatio,
    volumeSma,
    orderBlocks,
    fairValueGaps: fvgs,
    swingHighs: highs,
    swingLows: lows,
    support,
    resistance,
    fibLevels,
  };
}

// ─── CONFLUENCE SCORING & SIGNAL GENERATION ─────────────────────
//
// REBALANCED WEIGHTS (v2 — proven):
//   Category          | Indicators             | Max weight
//   Trend             | EMA alignment           | ±1.5
//   Trend confirm     | Ichimoku cloud          | ±1.5
//   Momentum          | RSI + Stoch RSI         | ±2.0
//   Momentum confirm  | MACD + divergence       | ±2.0
//   Volatility        | Bollinger               | ±1.0
//   Volume            | OBV + volume ratio      | ±1.0
//   Structure         | Order Blocks + FVGs     | ±1.5
//   Levels            | Fibonacci               | ±0.5
//   TOTAL POSSIBLE:                              ±11.0 (clamped to ±10)
//
// THRESHOLDS:
//   STRONG_BUY/SELL: ±6
//   BUY/SELL:        ±3
//   HOLD:            -2.9 to +2.9

export function generateSignal(candles: OHLCV[], indicators: IndicatorResult): TradeSignal {
  const currentPrice = candles[candles.length - 1].close;
  let score = 0;
  const reasons: string[] = [];
  const indMap: Record<string, { value: string; bias: "bullish" | "bearish" | "neutral" }> = {};

  // ── 1. TREND: EMA Alignment — max ±1.5 ──
  const { ema9, ema21, ema50, ema200, ema200reliable } = indicators;

  if (ema200reliable && ema9 > ema21 && ema21 > ema50 && ema50 > ema200) {
    score += 1.5;
    reasons.push("EMAs perfectly aligned bullish (9>21>50>200)");
    indMap["EMA Trend"] = { value: "Strong Uptrend", bias: "bullish" };
  } else if (ema9 > ema21 && ema21 > ema50) {
    score += 1;
    reasons.push("Short-term EMAs bullish");
    indMap["EMA Trend"] = { value: "Uptrend", bias: "bullish" };
  } else if (ema200reliable && ema9 < ema21 && ema21 < ema50 && ema50 < ema200) {
    score -= 1.5;
    reasons.push("EMAs perfectly aligned bearish (9<21<50<200)");
    indMap["EMA Trend"] = { value: "Strong Downtrend", bias: "bearish" };
  } else if (ema9 < ema21 && ema21 < ema50) {
    score -= 1;
    reasons.push("Short-term EMAs bearish");
    indMap["EMA Trend"] = { value: "Downtrend", bias: "bearish" };
  } else {
    indMap["EMA Trend"] = { value: "Mixed", bias: "neutral" };
  }

  // Golden/Death Cross (informational only — no score, since it overlaps EMA)
  if (ema200reliable) {
    indMap["Cross 50/200"] = ema50 > ema200
      ? { value: "Golden Cross", bias: "bullish" }
      : { value: "Death Cross", bias: "bearish" };
  } else {
    indMap["Cross 50/200"] = { value: "Insufficient data", bias: "neutral" };
  }

  // ── 2. TREND CONFIRM: Ichimoku — max ±1.5 ──
  const ichi = indicators.ichimoku;
  if (ichi.priceVsCloud === "above" && ichi.cloudColor === "green") {
    score += 1.5;
    reasons.push("Price above green Ichimoku Cloud");
    indMap["Ichimoku"] = { value: "Above cloud (green)", bias: "bullish" };
  } else if (ichi.priceVsCloud === "above") {
    score += 0.75;
    indMap["Ichimoku"] = { value: "Above cloud", bias: "bullish" };
  } else if (ichi.priceVsCloud === "below" && ichi.cloudColor === "red") {
    score -= 1.5;
    reasons.push("Price below red Ichimoku Cloud");
    indMap["Ichimoku"] = { value: "Below cloud (red)", bias: "bearish" };
  } else if (ichi.priceVsCloud === "below") {
    score -= 0.75;
    indMap["Ichimoku"] = { value: "Below cloud", bias: "bearish" };
  } else {
    indMap["Ichimoku"] = { value: "Inside cloud (indecision)", bias: "neutral" };
  }

  // TK Cross no longer adds score (was correlated with EMA trend)
  if (ichi.tkCross !== "none") {
    indMap["TK Cross"] = { value: ichi.tkCross === "bullish" ? "Bullish" : "Bearish", bias: ichi.tkCross === "bullish" ? "bullish" : "bearish" };
  }

  // ── 3. MOMENTUM: RSI + Stochastic RSI — max ±2.0 ──
  if (indicators.rsi < 25) {
    score += 1.5;
    reasons.push(`RSI deeply oversold (${indicators.rsi.toFixed(0)})`);
    indMap["RSI"] = { value: `${indicators.rsi.toFixed(1)} (Deeply oversold)`, bias: "bullish" };
  } else if (indicators.rsi < 35) {
    score += 0.5;
    indMap["RSI"] = { value: `${indicators.rsi.toFixed(1)} (Oversold zone)`, bias: "bullish" };
  } else if (indicators.rsi > 75) {
    score -= 1.5;
    reasons.push(`RSI deeply overbought (${indicators.rsi.toFixed(0)})`);
    indMap["RSI"] = { value: `${indicators.rsi.toFixed(1)} (Deeply overbought)`, bias: "bearish" };
  } else if (indicators.rsi > 65) {
    score -= 0.5;
    indMap["RSI"] = { value: `${indicators.rsi.toFixed(1)} (Overbought zone)`, bias: "bearish" };
  } else {
    indMap["RSI"] = { value: `${indicators.rsi.toFixed(1)} (Neutral)`, bias: "neutral" };
  }

  // Stochastic RSI crossover (now that D-line is correct)
  const { k, d } = indicators.stochRsi;
  if (k < 20 && k > d) {
    score += 0.5;
    reasons.push("Stoch RSI bullish crossover in oversold");
    indMap["Stoch RSI"] = { value: `K:${k.toFixed(0)} D:${d.toFixed(0)} (Bull cross)`, bias: "bullish" };
  } else if (k > 80 && k < d) {
    score -= 0.5;
    reasons.push("Stoch RSI bearish crossover in overbought");
    indMap["Stoch RSI"] = { value: `K:${k.toFixed(0)} D:${d.toFixed(0)} (Bear cross)`, bias: "bearish" };
  } else {
    indMap["Stoch RSI"] = { value: `K:${k.toFixed(0)} D:${d.toFixed(0)}`, bias: "neutral" };
  }

  // ── 4. MOMENTUM CONFIRM: MACD — max ±2.0 ──
  const macd = indicators.macd;
  if (macd.histogram > 0 && macd.line > macd.signal) {
    const strength = Math.abs(macd.histogram) > Math.abs(macd.line) * 0.1 ? 1.5 : 0.5;
    score += strength;
    if (strength > 1) reasons.push("MACD strong bullish momentum");
    indMap["MACD"] = { value: `Bullish (H: ${macd.histogram.toFixed(2)})`, bias: "bullish" };
  } else if (macd.histogram < 0 && macd.line < macd.signal) {
    const strength = Math.abs(macd.histogram) > Math.abs(macd.line) * 0.1 ? 1.5 : 0.5;
    score -= strength;
    if (strength > 1) reasons.push("MACD strong bearish momentum");
    indMap["MACD"] = { value: `Bearish (H: ${macd.histogram.toFixed(2)})`, bias: "bearish" };
  } else {
    indMap["MACD"] = { value: "Neutral / Crossing", bias: "neutral" };
  }

  // Real divergence detection
  const macdFull = calcMACD(candles.map(c => c.close));
  const swingData = findSwingPoints(candles);
  const divergence = detectMACDDivergence(candles, macdFull.lineArr, swingData.highIndices, swingData.lowIndices);
  if (divergence === "bearish") {
    score -= 0.5;
    reasons.push("Bearish MACD divergence (higher highs, lower MACD)");
    indMap["Divergence"] = { value: "Bearish", bias: "bearish" };
  } else if (divergence === "bullish") {
    score += 0.5;
    reasons.push("Bullish MACD divergence (lower lows, higher MACD)");
    indMap["Divergence"] = { value: "Bullish", bias: "bullish" };
  }

  // ── 5. VOLATILITY: Bollinger Bands — max ±1.0 ──
  const bb = indicators.bollingerBands;
  if (bb.percentB < 0) {
    score += 1;
    reasons.push("Price below lower Bollinger Band — oversold");
    indMap["Bollinger"] = { value: `%B: ${(bb.percentB * 100).toFixed(0)}% (Below)`, bias: "bullish" };
  } else if (bb.percentB > 1) {
    score -= 1;
    reasons.push("Price above upper Bollinger Band — overbought");
    indMap["Bollinger"] = { value: `%B: ${(bb.percentB * 100).toFixed(0)}% (Above)`, bias: "bearish" };
  } else if (bb.width < 0.05) {
    reasons.push("Bollinger squeeze — breakout imminent");
    indMap["Bollinger"] = { value: `Squeeze (width: ${(bb.width * 100).toFixed(1)}%)`, bias: "neutral" };
  } else {
    indMap["Bollinger"] = { value: `%B: ${(bb.percentB * 100).toFixed(0)}%`, bias: "neutral" };
  }

  // ── 6. VOLUME — max ±1.0 ──
  if (indicators.volumeRatio > 2.0 && indicators.obvTrend === "rising") {
    score += 1;
    reasons.push(`Volume spike (${indicators.volumeRatio.toFixed(1)}x avg) with rising OBV`);
    indMap["Volume"] = { value: `${indicators.volumeRatio.toFixed(1)}x avg + OBV rising`, bias: "bullish" };
  } else if (indicators.volumeRatio > 2.0 && indicators.obvTrend === "falling") {
    score -= 1;
    reasons.push("Volume spike with falling OBV — distribution");
    indMap["Volume"] = { value: `${indicators.volumeRatio.toFixed(1)}x avg + OBV falling`, bias: "bearish" };
  } else if (indicators.obvTrend === "rising") {
    score += 0.5;
    indMap["Volume"] = { value: `${indicators.volumeRatio.toFixed(1)}x avg (OBV rising)`, bias: "bullish" };
  } else if (indicators.obvTrend === "falling") {
    score -= 0.5;
    indMap["Volume"] = { value: `${indicators.volumeRatio.toFixed(1)}x avg (OBV falling)`, bias: "bearish" };
  } else {
    indMap["Volume"] = { value: `${indicators.volumeRatio.toFixed(1)}x avg`, bias: "neutral" };
  }

  // ── 7. STRUCTURE: Order Blocks + FVGs — max ±1.5 ──
  const nearBullishOB = indicators.orderBlocks.find(ob =>
    ob.type === "bullish" && currentPrice >= ob.low && currentPrice <= ob.high * 1.02
  );
  const nearBearishOB = indicators.orderBlocks.find(ob =>
    ob.type === "bearish" && currentPrice <= ob.high && currentPrice >= ob.low * 0.98
  );

  if (nearBullishOB) {
    score += 1;
    reasons.push("Price at bullish Order Block — institutional buy zone");
    indMap["Order Block"] = { value: "Bullish OB zone", bias: "bullish" };
  } else if (nearBearishOB) {
    score -= 1;
    reasons.push("Price at bearish Order Block — institutional sell zone");
    indMap["Order Block"] = { value: "Bearish OB zone", bias: "bearish" };
  } else {
    indMap["Order Block"] = { value: "No nearby OB", bias: "neutral" };
  }

  const nearBullishFVG = indicators.fairValueGaps.find(fvg =>
    fvg.type === "bullish" && currentPrice >= fvg.low * 0.99 && currentPrice <= fvg.high * 1.01
  );
  const nearBearishFVG = indicators.fairValueGaps.find(fvg =>
    fvg.type === "bearish" && currentPrice >= fvg.low * 0.99 && currentPrice <= fvg.high * 1.01
  );

  if (nearBullishFVG) {
    score += 0.5;
    reasons.push("Bullish Fair Value Gap being filled");
    indMap["FVG"] = { value: "Bullish FVG fill", bias: "bullish" };
  } else if (nearBearishFVG) {
    score -= 0.5;
    reasons.push("Bearish Fair Value Gap being filled");
    indMap["FVG"] = { value: "Bearish FVG fill", bias: "bearish" };
  } else {
    const fvgCount = indicators.fairValueGaps.length;
    indMap["FVG"] = { value: fvgCount > 0 ? `${fvgCount} open gap(s)` : "No gaps", bias: "neutral" };
  }

  // ── 8. LEVELS: Fibonacci — max ±0.5 (symmetrical) ──
  const fib618 = indicators.fibLevels.find(f => f.level === "61.8%");
  const fib382 = indicators.fibLevels.find(f => f.level === "38.2%");
  const fibDirection = indicators.fibLevels[0]?.direction ?? "up";

  if (fib618 && Math.abs(currentPrice - fib618.price) / currentPrice < 0.02) {
    if (fibDirection === "up") {
      score += 0.5;
      reasons.push("Price at 61.8% Fibonacci retracement in uptrend");
      indMap["Fibonacci"] = { value: "At 61.8% (bullish retracement)", bias: "bullish" };
    } else {
      score -= 0.5;
      reasons.push("Price at 61.8% Fibonacci retracement in downtrend");
      indMap["Fibonacci"] = { value: "At 61.8% (bearish retracement)", bias: "bearish" };
    }
  } else if (fib382 && Math.abs(currentPrice - fib382.price) / currentPrice < 0.02) {
    indMap["Fibonacci"] = { value: "At 38.2% level", bias: "neutral" };
  } else {
    indMap["Fibonacci"] = { value: "Between levels", bias: "neutral" };
  }

  // ── DETERMINE SIGNAL ──
  score = Math.max(-10, Math.min(10, score));

  let type: TradeSignal["type"];
  if      (score >= 6)  type = "STRONG_BUY";
  else if (score >= 4)  type = "BUY";
  else if (score <= -6) type = "STRONG_SELL";
  else if (score <= -4) type = "SELL";
  else                  type = "HOLD";

  // ── MACRO TREND ALIGNMENT FILTER ──────────────────────────────────
  // Prevents buying in bear markets and shorting in confirmed bull markets.
  // 1% margin: requires EMA50 to be decisively above/below EMA200 —
  // eliminates false signals at crossover transition zones (whipsaw region).
  // Same institutional logic as B&R and SMC.
  if (ema200reliable) {
    const macroUp   = ema50 > ema200 * 1.01;  // EMA50 decisively above EMA200
    const macroDown = ema50 < ema200 * 0.99;  // EMA50 decisively below EMA200
    if ((type === "STRONG_BUY"  || type === "BUY")  && !macroUp)   type = "HOLD";
    if ((type === "STRONG_SELL" || type === "SELL") && !macroDown)  type = "HOLD";
  }

  const confidence = Math.min(95, Math.max(10, Math.abs(score) * 9 + 10));

  // ── TREND ──
  let trend: TradeSignal["trend"];
  if      (score >= 6)  trend = "strong_up";
  else if (score >= 3)  trend = "up";
  else if (score <= -6) trend = "strong_down";
  else if (score <= -3) trend = "down";
  else                  trend = "sideways";

  // ── VOLATILITY ──
  let volatility: TradeSignal["volatility"];
  if      (indicators.atrPercent < 1.5) volatility = "low";
  else if (indicators.atrPercent < 3)   volatility = "medium";
  else if (indicators.atrPercent < 6)   volatility = "high";
  else                                  volatility = "extreme";

  // ── MARKET PHASE ──
  const marketPhase = detectMarketPhase(candles, indicators.atrPercent);

  // ── RISK MANAGEMENT ──
  const atr = indicators.atr;
  let stopLoss: number | undefined;
  let tp1: number | undefined;
  let tp2: number | undefined;
  let tp3: number | undefined;
  let riskRewardRatio = 0;
  let positionSizePct = 0;

  if (type !== "HOLD") {
    const isBuy = type === "BUY" || type === "STRONG_BUY";

    // ATR-based stop — tighter for strong signals (proven v2 approach)
    const slMultiplier = Math.abs(score) >= 6 ? 1.5 : 2;
    stopLoss = isBuy ? currentPrice - slMultiplier * atr : currentPrice + slMultiplier * atr;

    const risk = Math.abs(currentPrice - stopLoss);
    // Technical TPs: nearest swing high/low beyond entry (fallback to R:R multiples)
    const tTPs = findTechnicalTPs(candles, currentPrice, stopLoss, isBuy);
    tp1 = tTPs.tp1;  // nearest structural level (≥1.5R) or 2.0R fallback
    tp2 = tTPs.tp2;  // next structural level or 4R fallback
    tp3 = isBuy ? currentPrice + risk * 5 : currentPrice - risk * 5;  // 5:1 extended target

    riskRewardRatio = Math.round((Math.abs(tp2 - currentPrice) / risk) * 10) / 10;

    // Position sizing
    if (Math.abs(score) >= 6) positionSizePct = 1.5;
    else if (Math.abs(score) >= 4) positionSizePct = 1;
    else positionSizePct = 0.5;

    if (volatility === "high") positionSizePct *= 0.75;
    if (volatility === "extreme") positionSizePct *= 0.5;
  }

  const mainReason = reasons.length > 0
    ? reasons.slice(0, 3).join(" | ")
    : "No strong confluence — stay patient";

  return {
    type,
    confluenceScore: Math.round(score * 10) / 10,
    confidence,
    reason: mainReason,
    detailedReasons: reasons,
    indicators: indMap,
    entry: type !== "HOLD" ? currentPrice : undefined,
    stopLoss,
    takeProfit1: tp1,
    takeProfit2: tp2,
    takeProfit3: tp3,
    riskRewardRatio,
    positionSizePct: Math.round(positionSizePct * 100) / 100,
    trend,
    volatility,
    marketPhase,
  };
}

// ─── ENTRY REFINEMENT via lower timeframes ───────────────────────
// Used by routes.ts to refine entry/SL using 15m/5m candles

export function refineEntry(
  direction: "long" | "short",
  dailyEntry: number,
  dailyStopLoss: number,
  candles15m: OHLCV[],
): { entry: number; stopLoss: number; confidence: number } | null {
  if (candles15m.length < 20) return null;

  const closes = candles15m.map(c => c.close);
  const atr15m = calcATR(candles15m);
  const last = candles15m.length - 1;
  const price = closes[last];

  // Find nearest swing point on 15m for a tight stop
  const swings = findSwingPoints(candles15m, 2);

  if (direction === "long") {
    // Entry: current 15m price (should be near daily entry)
    // Stop: below the most recent 15m swing low + small buffer
    const recentSwingLow = swings.lows.length > 0
      ? Math.max(...swings.lows.filter(l => l < price))
      : price - atr15m * 2;
    const tightStop = recentSwingLow > 0 ? recentSwingLow - atr15m * 0.5 : price - atr15m * 2;

    // Reject if the tight stop is worse than the daily stop
    if (tightStop < dailyStopLoss) return null;

    const riskReduction = 1 - Math.abs(price - tightStop) / Math.abs(dailyEntry - dailyStopLoss);
    return {
      entry: price,
      stopLoss: tightStop,
      confidence: Math.min(90, Math.round(riskReduction * 100)),
    };
  } else {
    const recentSwingHigh = swings.highs.length > 0
      ? Math.min(...swings.highs.filter(h => h > price))
      : price + atr15m * 2;
    const tightStop = recentSwingHigh > 0 ? recentSwingHigh + atr15m * 0.5 : price + atr15m * 2;

    if (tightStop > dailyStopLoss) return null;

    const riskReduction = 1 - Math.abs(price - tightStop) / Math.abs(dailyEntry - dailyStopLoss);
    return {
      entry: price,
      stopLoss: tightStop,
      confidence: Math.min(90, Math.round(riskReduction * 100)),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// STRATEGY B: 4H MEAN REVERSION
// ═══════════════════════════════════════════════════════════════════
//
// Fades overextended moves on 4H when:
//   - Price outside Bollinger Bands (20, 2.5 SD)
//   - RSI(7) at extreme (<20 or >80)
//   - Volume exhaustion (< 0.7x avg) — sellers/buyers drying up
//
// TP: Bollinger midline (mean), SL: 1.2x ATR
// Hold: 2-5 candles (8-20 hours), time stop at 5 candles

export interface MeanRevSignal {
  type: "LONG" | "SHORT" | "NONE";
  entry: number;
  stopLoss: number;
  takeProfit: number;    // BB midline (the mean)
  confidence: number;
  reason: string;
  rsi7: number;
  bbPercentB: number;
  volumeRatio: number;
}

export function meanReversionSignal(candles: OHLCV[]): MeanRevSignal {
  const none: MeanRevSignal = {
    type: "NONE", entry: 0, stopLoss: 0, takeProfit: 0,
    confidence: 0, reason: "", rsi7: 50, bbPercentB: 0.5, volumeRatio: 1,
  };

  if (candles.length < 30) return none;

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const last = closes.length - 1;
  const price = closes[last];

  // RSI(7) — short lookback for mean reversion
  const rsi7Values = calcRSI(closes, 7);
  const rsi7 = rsi7Values[last];

  // Bollinger Bands (20, 2.0 SD) — standard width for mean reversion
  const bbPeriod = 20;
  const bbMult = 2.0;
  const bbSma = sma(closes, bbPeriod);
  const bbStd = stdDev(closes, bbPeriod, bbSma);
  const bbUpper = bbSma[last] + bbMult * bbStd[last];
  const bbLower = bbSma[last] - bbMult * bbStd[last];
  const bbMid = bbSma[last];
  const bbRange = bbUpper - bbLower;
  const bbPercentB = bbRange > 0 ? (price - bbLower) / bbRange : 0.5;

  // Volume — current vs 20-period avg
  const volSlice = volumes.slice(-20);
  const volAvg = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const volumeRatio = volAvg > 0 ? volumes[last] / volAvg : 1;

  // ATR for stop
  const atr = calcATR(candles);

  // EMA(50) slope — filter out strong trending markets where mean reversion fails
  const ema50Values: number[] = [closes[0]];
  const emaK = 2 / 51;
  for (let i = 1; i < closes.length; i++) {
    ema50Values[i] = closes[i] * emaK + ema50Values[i - 1] * (1 - emaK);
  }
  // Slope over last 5 candles: if too steep, skip (strong trend)
  const ema50Now = ema50Values[last];
  const ema50Prev = ema50Values[Math.max(0, last - 5)];
  const emaSlopePct = (ema50Now - ema50Prev) / ema50Prev * 100;
  const strongTrendUp = emaSlopePct > 3;    // >3% in 5 candles = strong bull
  const strongTrendDown = emaSlopePct < -3;  // <-3% = strong bear

  // Core conditions: price outside BB + RSI extreme
  const isOversold = price <= bbLower && rsi7 < 25;
  const isOverbought = price >= bbUpper && rsi7 > 75;

  // Confirmation: volume exhaustion OR 3+ consecutive candles
  const recentCandles = candles.slice(-4);
  const bearCount = recentCandles.filter(c => c.close < c.open).length;
  const bullCount = recentCandles.filter(c => c.close > c.open).length;
  const hasExhaustion = volumeRatio < 0.75 || bearCount >= 3 || bullCount >= 3;

  // ── LONG SIGNAL: oversold + not strong downtrend + exhaustion
  if (isOversold && !strongTrendDown && hasExhaustion) {
    const sl = price - atr * 1.5;
    const tp = bbMid;
    const rr = Math.abs(tp - price) / Math.abs(price - sl);
    if (rr < 1.5) return { ...none, rsi7, bbPercentB, volumeRatio };
    const reasons = [`RSI(7)=${rsi7.toFixed(0)}`, `BB%B=${bbPercentB.toFixed(2)}`, volumeRatio < 0.75 ? `Vol ${volumeRatio.toFixed(2)}x` : `${bearCount} bear candles`];
    return {
      type: "LONG",
      entry: price,
      stopLoss: sl,
      takeProfit: tp,
      confidence: Math.min(85, Math.round(rr * 20 + 25)),
      reason: reasons.join(" | "),
      rsi7, bbPercentB, volumeRatio,
    };
  }

  // ── SHORT SIGNAL: overbought + not strong uptrend + exhaustion
  if (isOverbought && !strongTrendUp && hasExhaustion) {
    const sl = price + atr * 1.5;
    const tp = bbMid;
    const rr = Math.abs(price - tp) / Math.abs(sl - price);
    if (rr < 1.5) return { ...none, rsi7, bbPercentB, volumeRatio };
    const reasons = [`RSI(7)=${rsi7.toFixed(0)}`, `BB%B=${bbPercentB.toFixed(2)}`, volumeRatio < 0.75 ? `Vol ${volumeRatio.toFixed(2)}x` : `${bullCount} bull candles`];
    return {
      type: "SHORT",
      entry: price,
      stopLoss: sl,
      takeProfit: tp,
      confidence: Math.min(85, Math.round(rr * 20 + 25)),
      reason: reasons.join(" | "),
      rsi7, bbPercentB, volumeRatio,
    };
  }

  return { ...none, rsi7, bbPercentB, volumeRatio };
}

// ═══════════════════════════════════════════════════════════════════
// STRATEGY C: 4H BREAKOUT (Donchian + Volume + EMA trend)
// ═══════════════════════════════════════════════════════════════════
//
// Trades breakouts of Donchian Channel (20) with:
//   - Volume spike confirmation (> 1.5x avg)
//   - EMA(20) trend alignment
//   - ATR-based stops, 2:1 R:R target
//
// Hold: 5-15 candles (20-60h), time stop at 15 candles

export interface BreakoutSignal {
  type: "LONG" | "SHORT" | "NONE";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reason: string;
}

export function breakoutSignal(candles: OHLCV[]): BreakoutSignal {
  const none: BreakoutSignal = {
    type: "NONE", entry: 0, stopLoss: 0, takeProfit: 0,
    confidence: 0, reason: "",
  };

  if (candles.length < 25) return none;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  const last = closes.length - 1;
  const price = closes[last];

  // Donchian Channel (20) — highest high / lowest low of last 20 candles
  // Use candles [last-20 .. last-1] (not including current candle)
  const dcPeriod = 20;
  const dcHighs = highs.slice(last - dcPeriod, last);
  const dcLows = lows.slice(last - dcPeriod, last);
  const dcUpper = Math.max(...dcHighs);
  const dcLower = Math.min(...dcLows);

  // EMA(20) for trend
  const ema20Values: number[] = [closes[0]];
  const emaK = 2 / 21;
  for (let i = 1; i < closes.length; i++) {
    ema20Values[i] = closes[i] * emaK + ema20Values[i - 1] * (1 - emaK);
  }
  const ema20 = ema20Values[last];
  const trendUp = price > ema20;
  const trendDown = price < ema20;

  // Volume: current vs 20-period avg
  const volSlice = volumes.slice(last - 20, last);
  const volAvg = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const volumeRatio = volAvg > 0 ? volumes[last] / volAvg : 1;
  const volumeSpike = volumeRatio > 1.3;

  // ATR for stops
  const atr = calcATR(candles);

  // ── LONG BREAKOUT: price breaks above Donchian upper + trend up + volume
  if (candles[last].high > dcUpper && trendUp && volumeSpike) {
    const sl = price - atr * 1.5;
    const risk = price - sl;
    const tp = price + risk * 2.0; // 2:1 R:R
    const reasons = [`Break above ${dcUpper.toFixed(2)}`, `Vol ${volumeRatio.toFixed(1)}x`, `EMA20 trend up`];
    return {
      type: "LONG",
      entry: price,
      stopLoss: sl,
      takeProfit: tp,
      confidence: Math.min(85, Math.round(volumeRatio * 15 + 35)),
      reason: reasons.join(" | "),
    };
  }

  // ── SHORT BREAKOUT: price breaks below Donchian lower + trend down + volume
  if (candles[last].low < dcLower && trendDown && volumeSpike) {
    const sl = price + atr * 1.5;
    const risk = sl - price;
    const tp = price - risk * 2.0;
    const reasons = [`Break below ${dcLower.toFixed(2)}`, `Vol ${volumeRatio.toFixed(1)}x`, `EMA20 trend down`];
    return {
      type: "SHORT",
      entry: price,
      stopLoss: sl,
      takeProfit: tp,
      confidence: Math.min(85, Math.round(volumeRatio * 15 + 35)),
      reason: reasons.join(" | "),
    };
  }

  return none;
}

// ═══════════════════════════════════════════════════════════════════
// STRATEGY D: SMC (Smart Money Concepts)
// ═══════════════════════════════════════════════════════════════════
//
// 4H structure analysis:
//   1. Detect market structure: HH/HL (bullish) or LH/LL (bearish)
//   2. Identify BOS (Break of Structure) — price closes beyond last swing
//   3. Find unmitigated Order Block at the origin of the BOS move
//   4. Wait for price to retrace into OB zone
//   5. Confirm with rejection candle characteristics
//
// SL: behind OB zone, TP: next swing point, minimum R:R 1:3

export interface SMCSignal {
  type: "LONG" | "SHORT" | "NONE";
  entry: number;
  stopLoss: number;
  takeProfit: number;   // TP1 — nearest structural level
  takeProfit2: number;  // TP2 — next structural level or 4R fallback
  confidence: number;
  reason: string;
  structure: "bullish" | "bearish" | "none";
  obZone?: { high: number; low: number };
}

export function smcSignal(candles: OHLCV[]): SMCSignal {
  const none: SMCSignal = {
    type: "NONE", entry: 0, stopLoss: 0, takeProfit: 0, takeProfit2: 0,
    confidence: 0, reason: "", structure: "none",
  };

  if (candles.length < 150) return none;  // Need 150+ bars for reliable EMA200

  // ══ INDICATOR WINDOW: full history (150+ bars) for accurate EMAs ══════════
  const allCloses    = candles.map(c => c.close);
  const allLast      = candles.length - 1;
  const ema21Values  = ema(allCloses, 21);
  const ema50Values  = ema(allCloses, 50);
  const ema200Values = ema(allCloses, 200);
  const rsiVals      = calcRSI(allCloses, 14);

  const rsiNow    = rsiVals[allLast];
  const ema21Now  = ema21Values[allLast];
  const ema50Now  = ema50Values[allLast];
  const ema200Now = ema200Values[allLast];

  // Micro-trend (short-term) and macro-trend (institutional bias)
  const trendUp   = ema21Now > ema50Now;    // micro uptrend
  const trendDown = ema21Now < ema50Now;    // micro downtrend
  const macroUp   = ema50Now > ema200Now;   // bull market structure
  // macroDown not used for shorts (B&R pattern: allow shorts in corrections)

  // ══ STRUCTURE WINDOW: last 120 bars — wide view for BOS/swing detection ══
  const STRUCT_LEN    = Math.min(120, candles.length);
  const structCandles = candles.slice(-STRUCT_LEN);

  // ══ SIGNAL WINDOW: last 60 bars — tight view for OB and retest detection ══
  const SIG_LEN    = Math.min(60, candles.length);
  const sigCandles = candles.slice(-SIG_LEN);

  const closes  = sigCandles.map(c => c.close);
  const last    = closes.length - 1;
  const price   = closes[last];
  const atr     = calcATR(sigCandles);

  // ── 1. Market structure via swing points (in STRUCTURE window) ──
  const swings = findSwingPoints(structCandles, 2);
  const { highs: swingHighs, lows: swingLows, highIndices, lowIndices } = swings;

  if (swingHighs.length < 2 || swingLows.length < 2) return none;

  const lastTwoHighs = swingHighs.slice(-2);
  const lastTwoLows  = swingLows.slice(-2);

  const isHH = lastTwoHighs[1] > lastTwoHighs[0];
  const isHL  = lastTwoLows[1]  > lastTwoLows[0];
  const isLH  = lastTwoHighs[1] < lastTwoHighs[0];
  const isLL  = lastTwoLows[1]  < lastTwoLows[0];

  // SMC structure: at least one bullish or bearish signal
  // The EMA200 macro filter + RSI bounds are the true quality gates —
  // requiring BOTH HH+HL together produces too few signals (~3/year) for any coin
  const bullishStructure = isHH || isHL;
  const bearishStructure = isLH || isLL;

  // Choppy: both bullish and bearish signals simultaneously → skip
  if (bullishStructure && bearishStructure) return none;
  if (!bullishStructure && !bearishStructure) return none;

  // ── 2. Macro + micro trend alignment ──
  // LONGs: need micro uptrend AND macro bull structure (institutional backing)
  // SHORTs: need micro downtrend (allow corrections in bull market too)
  if (bullishStructure && !(trendUp && macroUp)) return none;
  if (bearishStructure && !trendDown) return none;

  // ── 3. RSI bounds — context-aware for OB retest entries ──
  // LONG: price pulling back to OB → RSI typically 35-60 range; block if overbought (>72)
  // SHORT: price bouncing to bearish OB → RSI typically 50-72 range; block if oversold (<28)
  if (bullishStructure && rsiNow > 72) return none;  // don't chase already-overbought
  if (bearishStructure && rsiNow < 28) return none;  // don't short already-oversold

  // ── 4. BOS (Break of Structure) detection in STRUCTURE window ──
  const prevSwingHigh    = lastTwoHighs[0];
  const prevSwingLow     = lastTwoLows[0];
  const lastSwingHighIdx = highIndices[highIndices.length - 1];
  const lastSwingLowIdx  = lowIndices[lowIndices.length - 1];

  let hasBOS = false;
  let bosDirection: "bullish" | "bearish" = "bullish";

  if (bullishStructure) {
    // Bullish BOS: a candle after the last swing high closed above the prior swing high
    const bosCandle = structCandles.slice(lastSwingHighIdx).find(c => c.close > prevSwingHigh);
    hasBOS = !!bosCandle;
    bosDirection = "bullish";
  } else {
    // Bearish BOS: a candle after the last swing low closed below the prior swing low
    const bosCandle = structCandles.slice(lastSwingLowIdx).find(c => c.close < prevSwingLow);
    hasBOS = !!bosCandle;
    bosDirection = "bearish";
  }

  if (!hasBOS) return none;

  // ── 5. Order Blocks (in STRUCTURE window — wider lookback captures OBs
  //    that preceded the BOS move, which can be 60-120 bars old) ──
  const orderBlocks = findOrderBlocks(structCandles, 120);

  const relevantOBs = orderBlocks.filter(ob =>
    bosDirection === "bullish" ? ob.type === "bullish" : ob.type === "bearish"
  );

  if (relevantOBs.length === 0) return none;

  // ── 6. Scan ALL relevant OBs — return the best valid retest ──────────
  // Key fix: "most recent OB" often isn't the one price is retesting right now.
  // Scan all OBs, pick the highest-confidence valid setup.
  const tolerance       = atr * 0.3;
  const currentCandle   = sigCandles[last];
  const prevCandle      = sigCandles[last - 1];
  const volAvg20        = sigCandles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
  const volumeRatio     = volAvg20 > 0 ? currentCandle.volume / volAvg20 : 1;

  interface CandidateSignal {
    conf: number;
    sl: number;
    tp: number;
    tp2: number;
    rr: number;
    obHigh: number;
    obLow: number;
    hasRejection: boolean;
  }

  let bestCandidate: CandidateSignal | null = null;

  for (const ob of relevantOBs) {
    const obMid = (ob.high + ob.low) / 2;

    if (bosDirection === "bullish") {
      // Price must be retesting the bullish OB (demand zone)
      const inZone = price <= ob.high + tolerance && price >= ob.low - tolerance;
      if (!inZone) continue;

      const hasRejection =
        currentCandle.low  <= ob.high &&
        currentCandle.close > obMid   &&
        currentCandle.close > currentCandle.open;

      const prevRejected = prevCandle &&
        prevCandle.low   <= ob.high &&
        prevCandle.close >  obMid   &&
        currentCandle.close > prevCandle.high;

      if (!hasRejection && !prevRejected) continue;

      const sl   = ob.low - atr * 0.3;
      const risk = price - sl;
      if (risk <= 0) continue;

      // Technical TP: nearest swing high above entry (not capped at 2.5R)
      const tTPs = findTechnicalTPs(candles, price, sl, true);
      const tp   = tTPs.tp1;
      const rr   = Math.abs(tp - price) / risk;
      if (rr < 2.0) continue;

      let conf = 50;
      if (ob.strength > 60) conf += 10;
      if (hasRejection)     conf += 10;
      if (rr >= 2.5)        conf += 10;
      conf += 5;                         // bullish structure confirmed
      if (volumeRatio > 1.3) conf += 5;
      if (macroUp)           conf += 5;
      conf = Math.min(90, conf);

      if (!bestCandidate || conf > bestCandidate.conf) {
        bestCandidate = { conf, sl, tp, tp2: tTPs.tp2, rr, obHigh: ob.high, obLow: ob.low, hasRejection };
      }

    } else {
      // Bearish: price retesting bearish OB (supply zone)
      const inZone = price >= ob.low - tolerance && price <= ob.high + tolerance;
      if (!inZone) continue;

      const hasRejection =
        currentCandle.high  >= ob.low  &&
        currentCandle.close <  obMid   &&
        currentCandle.close <  currentCandle.open;

      const prevRejected = prevCandle &&
        prevCandle.high  >= ob.low  &&
        prevCandle.close <  obMid   &&
        currentCandle.close < prevCandle.low;

      if (!hasRejection && !prevRejected) continue;

      const sl   = ob.high + atr * 0.3;
      const risk = sl - price;
      if (risk <= 0) continue;

      // Technical TP: nearest swing low below entry (not capped at 2.5R)
      const tTPs = findTechnicalTPs(candles, price, sl, false);
      const tp   = tTPs.tp1;
      const rr   = Math.abs(price - tp) / risk;
      if (rr < 2.0) continue;

      let conf = 50;
      if (ob.strength > 60) conf += 10;
      if (hasRejection)     conf += 10;
      if (rr >= 2.5)        conf += 10;
      conf += 5;                         // bearish structure confirmed
      if (volumeRatio > 1.3) conf += 5;
      conf = Math.min(90, conf);

      if (!bestCandidate || conf > bestCandidate.conf) {
        bestCandidate = { conf, sl, tp, tp2: tTPs.tp2, rr, obHigh: ob.high, obLow: ob.low, hasRejection };
      }
    }
  }

  if (!bestCandidate) return none;

  const { conf, sl, tp, tp2, rr, obHigh, obLow, hasRejection } = bestCandidate;
  const dir = bosDirection === "bullish" ? "LONG" : "SHORT";

  return {
    type: dir,
    entry: price,
    stopLoss: sl,
    takeProfit: tp,
    takeProfit2: tp2,
    confidence: conf,
    reason: [
      dir === "LONG" ? `Bullish BOS (HH+HL)` : `Bearish BOS (LH+LL)`,
      `OB ${obLow.toFixed(2)}-${obHigh.toFixed(2)}`,
      hasRejection ? "Rejection candle" : "Prior bar rejection",
      `R:R ${rr.toFixed(1)}:1`,
      `RSI ${rsiNow.toFixed(0)}`,
    ].join(" | "),
    structure: bosDirection,
    obZone: { high: obHigh, low: obLow },
  };
}

// ═══════════════════════════════════════════════════════════════════
// STRATEGY E: BREAK & RETEST
// ═══════════════════════════════════════════════════════════════════
//
// 4H S/R level detection + break + retest + rejection:
//   1. Identify key S/R levels from swing points (tested 2+ times)
//   2. Detect a clear break: candle close beyond the level
//   3. Wait for retest: price returns to the broken level
//   4. Confirm rejection at retest (wick rejection / engulfing)
//
// Entry in break direction, SL behind level, TP at next S/R, min R:R 1:2

export interface BreakRetestSignal {
  type: "LONG" | "SHORT" | "NONE";
  entry: number;
  stopLoss: number;
  takeProfit: number;   // TP1 — next S/R level or 2.5R fallback
  takeProfit2: number;  // TP2 — level after TP1 or 4R fallback
  confidence: number;
  reason: string;
  level?: number;
}

export function breakRetestSignal(candles: OHLCV[], minTouches = 3): BreakRetestSignal {
  // ── PROFESSIONAL BREAK & RETEST ─────────────────────────────────
  //
  // Rules (as a discretionary trader would apply):
  //  1. Identify KEY S/R levels — swing-based, clustered, 3+ touches (institutional)
  //  2. BREAK: close beyond level by >0.5 ATR, body >55% of range (not a wick break),
  //            volume on break candle >1.5x average (conviction)
  //  3. BREAK HOLDS: price stays on the broken side for 3+ candles (not a fake-out)
  //  4. RETEST: price returns to level within 3–18 candles after break
  //  5. REJECTION at retest: pin bar or engulfing candle (quality patterns only)
  //  6. Trend filter: EMA21>EMA50 (micro) AND EMA50>EMA200 (macro) for LONG
  //  7. RSI filter: 45–70 for LONG, 30–60 for SHORT (momentum confirmation)
  //  8. Separate indicator window (full history) from signal window (last 60 bars)
  //     so EMA200 is reliable regardless of the warm-up period

  const none: BreakRetestSignal = {
    type: "NONE", entry: 0, stopLoss: 0, takeProfit: 0, takeProfit2: 0,
    confidence: 0, reason: "",
  };

  if (candles.length < 60) return none;

  // ══ INDICATOR WINDOW: full passed history for reliable EMAs ══════
  // Caller should pass at least 150 candles so EMA200 converges properly.
  // With k=2/201, after 150 bars the initial seed contributes only ~22% weight.
  const allCloses  = candles.map(c => c.close);
  const allLast    = candles.length - 1;

  const ema21Values  = ema(allCloses, 21);
  const ema50Values  = ema(allCloses, 50);
  const ema200Values = ema(allCloses, 200);
  const rsiVals      = calcRSI(allCloses, 14);
  const rsiNow       = rsiVals[allLast];
  const ema21Now     = ema21Values[allLast];
  const ema50Now     = ema50Values[allLast];
  const ema200Now    = ema200Values[allLast];

  // Micro-trend: EMA21 vs EMA50 (short-term directional bias)
  const trendUp   = ema21Now > ema50Now;
  const trendDown = ema21Now < ema50Now;

  // Macro-trend: EMA50 vs EMA200 (market structure — bull or bear)
  // Only LONG when price is in a macro bull structure; prevents dead-cat bounce longs
  const macroUp   = ema50Now > ema200Now;
  const macroDown = ema50Now < ema200Now;

  // EMA50 slope over last 10 bars: reject extreme trending markets where B&R fails
  const ema50Prev10   = ema50Values[Math.max(0, allLast - 10)];
  const ema50Slope10  = Math.abs(ema50Now - ema50Prev10) / ema50Prev10 * 100;
  const inStrongTrend = ema50Slope10 > 7;  // >7% in 10 bars = too strong, skip

  // ══ SIGNAL WINDOW: last 60 bars for break/retest logic (unchanged behaviour) ══
  // ══ LEVEL WINDOW:  last 120 bars for S/R level detection (more 3-touch levels) ══
  // Separating the two means we get more historical touches per level without
  // changing the break/retest timing logic.
  const SIG_LEN    = Math.min(60,  candles.length);
  const LEVEL_LEN  = Math.min(120, candles.length);
  const sigCandles  = candles.slice(-SIG_LEN);
  const lvlCandles  = candles.slice(-LEVEL_LEN);  // wider window for swing counting
  const closes  = sigCandles.map(c => c.close);
  const highs   = sigCandles.map(c => c.high);
  const lows    = sigCandles.map(c => c.low);
  const volumes = sigCandles.map(c => c.volume);
  const last    = closes.length - 1;
  const price   = closes[last];
  const atr     = calcATR(sigCandles);

  const atrPct     = (atr / price) * 100;
  const tooVolatile = atrPct > 5.5;

  if (inStrongTrend || tooVolatile) return none;

  // ── Volume baseline: 20-bar average from signal window ──
  const volAvg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

  // ── 1. Build S/R level map from signal window ──
  // Use strength=2 (swing that holds 2 bars each side) to find significant pivots
  // Level detection uses the wider 120-bar window for more historical touches
  const swings = findSwingPoints(lvlCandles, 2);
  const allSwingPrices = [...swings.highs, ...swings.lows];
  if (allSwingPrices.length < 4) return none;

  const clusters: { price: number; touches: number; lastIdx: number }[] = [];

  const { highs: allH, lows: allL, highIndices: hiIdx, lowIndices: loIdx } =
    findSwingPoints(lvlCandles, 2);

  for (let k = 0; k < allH.length; k++) {
    const lvl = allH[k];
    const idx = hiIdx[k];
    const existing = clusters.find(c => Math.abs(c.price - lvl) / price < 0.006);
    if (existing) {
      existing.price = (existing.price * existing.touches + lvl) / (existing.touches + 1);
      existing.touches++;
      existing.lastIdx = Math.max(existing.lastIdx, idx);
    } else clusters.push({ price: lvl, touches: 1, lastIdx: idx });
  }
  for (let k = 0; k < allL.length; k++) {
    const lvl = allL[k];
    const idx = loIdx[k];
    const existing = clusters.find(c => Math.abs(c.price - lvl) / price < 0.006);
    if (existing) {
      existing.price = (existing.price * existing.touches + lvl) / (existing.touches + 1);
      existing.touches++;
      existing.lastIdx = Math.max(existing.lastIdx, idx);
    } else clusters.push({ price: lvl, touches: 1, lastIdx: idx });
  }

  // ✦ Require minTouches (default 3): well-respected institutional levels
  //   (2-touch levels are more common; 3+ = stronger institutional respect)
  const strongLevels = clusters
    .filter(c => c.touches >= minTouches)
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price));

  if (strongLevels.length === 0) return none;

  // ── 2. Search for valid break + retest setups ──
  // Scan last 25 candles for breaks, then check if current candle is the retest

  for (const level of strongLevels.slice(0, 6)) {  // Check closest 6 levels
    const lvlPrice = level.price;

    // Skip levels too far from current price (>6% away)
    if (Math.abs(lvlPrice - price) / price > 0.06) continue;

    // ── Find the most recent valid break of this level ──
    let breakIdx = -1;
    let breakDirection: "up" | "down" | null = null;
    let breakVolRatio = 0;

    // Scan last 25 candles of the signal window (not the last 4 — retest must form)
    for (let i = Math.max(1, last - 25); i <= last - 4; i++) {
      const c    = sigCandles[i];
      const prev = sigCandles[i - 1];

      // Previous candle was on one side, this candle closes decisively on other side
      const bodySize  = Math.abs(c.close - c.open);
      const totalRange = c.high - c.low;
      const bodyRatio  = totalRange > 0 ? bodySize / totalRange : 0;
      const volRatio   = volAvg20 > 0 ? c.volume / volAvg20 : 1;

      // Break UP: prev close below level, this close above level + margin, strong body + volume
      if (prev.close < lvlPrice &&
          c.close > lvlPrice + atr * 0.5 &&  // Larger margin (0.5 ATR)
          bodyRatio > 0.55 &&     // Body must be >55% of range (conviction)
          volRatio > 1.5) {       // Volume >1.5x (meaningful break)
        breakIdx = i;
        breakDirection = "up";
        breakVolRatio = volRatio;
      }

      // Break DOWN: prev close above level, this close below level − margin
      if (prev.close > lvlPrice &&
          c.close < lvlPrice - atr * 0.5 &&
          bodyRatio > 0.55 &&
          volRatio > 1.5) {
        breakIdx = i;
        breakDirection = "down";
        breakVolRatio = volRatio;
      }
    }

    if (breakIdx === -1 || !breakDirection) continue;

    // ── Trend alignment ──
    // LONG:  EMA21>EMA50 (micro) AND EMA50>EMA200 (macro bull structure required)
    //        → eliminates dead-cat bounce longs in persistent bear markets
    // SHORT: EMA21<EMA50 (micro only) — corrections within bull markets are valid SHORTs
    //        The RSI guard (max 60) prevents shorting in strongly bullish conditions
    if (breakDirection === "up"   && !(trendUp && macroUp)) continue;
    if (breakDirection === "down" && !trendDown)            continue;

    // ── RSI guard ──
    // LONG: RSI must be 45–70. Below 45 = bearish momentum (dead-cat bounce risk).
    //       Above 70 = overbought, bad risk/reward.
    // SHORT: RSI must be 30–60. Above 60 = coin has bullish momentum, SHORTs risky.
    //        Below 30 = already oversold, sellers are exhausted (capitulation pattern).
    if (breakDirection === "up"   && (rsiNow < 45 || rsiNow > 70)) continue;
    if (breakDirection === "down" && (rsiNow < 30 || rsiNow > 60)) continue;

    // ── Break must have HELD: at least 3 candles stayed on broken side ──
    const holdWindow = Math.min(breakIdx + 8, last - 1);
    let heldCount = 0;
    for (let i = breakIdx + 1; i <= holdWindow; i++) {
      if (breakDirection === "up"   && closes[i] > lvlPrice) heldCount++;
      if (breakDirection === "down" && closes[i] < lvlPrice) heldCount++;
    }
    if (heldCount < 3) continue;

    // ── Retest window: must happen 3–18 candles after break ──
    const retestMin = breakIdx + 3;
    const retestMax = breakIdx + 18;
    if (last < retestMin || last > retestMax) continue;

    // ── Check that price is actually near the level right now ──
    // The last 2 candles should touch or penetrate the level
    const retestTol = atr * 0.5;
    const c0 = sigCandles[last];
    const c1 = sigCandles[last - 1];

    const touchingLevel = (
      (Math.min(c0.low, c1.low) <= lvlPrice + retestTol) &&
      (Math.max(c0.high, c1.high) >= lvlPrice - retestTol)
    );
    if (!touchingLevel) continue;

    // ── Retest volume should be LOWER than break volume (exhaustion / accumulation) ──
    const retestVol = volumes.slice(last - 2, last + 1).reduce((a, b) => a + b, 0) / 3;
    const retestVolRatio = volAvg20 > 0 ? retestVol / volAvg20 : 1;
    // Soft check: retest volume should be lower than break volume (not mandatory but scored)
    const quietRetest = retestVolRatio < breakVolRatio;

    // ── 5. Rejection candle check ──
    const range0 = c0.high - c0.low;
    const body0  = Math.abs(c0.close - c0.open);
    const bodyRatio0 = range0 > 0 ? body0 / range0 : 0;

    let rejectionType = "none";

    if (breakDirection === "up") {
      // Bullish rejection: hammer / bullish engulf / close above level
      const lowerWick  = Math.min(c0.open, c0.close) - c0.low;
      const wickRatio  = range0 > 0 ? lowerWick / range0 : 0;

      // Pin bar (hammer): lower wick ≥40% of range, close above midpoint of bar
      const isPinBar = wickRatio >= 0.4 && c0.close > (c0.high + c0.low) / 2;

      // Bullish engulf: close above prev candle's open (for previous bearish candle)
      const prevBearish = c1.close < c1.open;
      const isEngulf    = prevBearish && c0.close > c1.open && c0.open < c1.close;

      // Simple close above level
      const closesAbove = c0.close > lvlPrice && c0.close > c0.open;

      if (isPinBar)    rejectionType = "pin_bar";
      else if (isEngulf) rejectionType = "engulfing";
      else if (closesAbove) rejectionType = "close_above";

    } else {
      // Bearish rejection: shooting star / bearish engulf / close below level
      const upperWick  = c0.high - Math.max(c0.open, c0.close);
      const wickRatio  = range0 > 0 ? upperWick / range0 : 0;

      const isPinBar = wickRatio >= 0.4 && c0.close < (c0.high + c0.low) / 2;

      const prevBullish = c1.close > c1.open;
      const isEngulf    = prevBullish && c0.close < c1.open && c0.open > c1.close;

      const closesBelow = c0.close < lvlPrice && c0.close < c0.open;

      if (isPinBar)    rejectionType = "pin_bar";
      else if (isEngulf) rejectionType = "engulfing";
      else if (closesBelow) rejectionType = "close_below";
    }

    if (rejectionType === "none") continue;

    // ── 6. Calculate entry, SL, TP ──
    // SL: behind the level + 1 ATR buffer (give room)
    // TP: next major S/R level, or 2.5x risk minimum

    if (breakDirection === "up") {
      const sl  = lvlPrice - atr * 1.0;
      const risk = price - sl;
      if (risk <= 0) continue;

      // TP1: next tested resistance (2+ touches) above entry. If no strong
      // level ahead, fall back to the nearest swing high via findTechnicalTPs
      // — fully structural, no fixed multipliers. Quality gate rr<2 below
      // skips the whole signal if even structure doesn't offer ≥2R.
      const nextRes = strongLevels.find(l => l.price > price + risk && l.touches >= 2);
      const tp = nextRes ? nextRes.price : findTechnicalTPs(candles, price, sl, true).tp1;
      const rr = (tp - price) / risk;
      if (rr < 2.0) continue;
      // TP2: next tested resistance beyond TP1, else structural next swing
      // (which returns tp1 if none — single-target trade, trailing runs post-TP1).
      const nextRes2 = strongLevels.find(l => l.price > tp + atr * 0.5 && l.touches >= 2);
      const tp2 = nextRes2 ? nextRes2.price : findTechnicalTPs(candles, price, sl, true).tp2;

      // ── Confidence score ──
      let conf = 45;
      if (level.touches >= 3) conf += 10;      // Well-tested level
      if (rejectionType === "pin_bar")    conf += 15;  // Strongest signal
      if (rejectionType === "engulfing")  conf += 12;
      if (rejectionType === "close_above") conf += 5;
      if (quietRetest)    conf += 8;            // Volume exhaustion at retest
      if (breakVolRatio >= 2.0) conf += 7;      // Strong break volume
      if (rr >= 3.0)      conf += 5;
      conf = Math.min(90, conf);

      const retestBars = last - breakIdx;
      return {
        type: "LONG",
        entry: price,
        stopLoss: sl,
        takeProfit: tp,
        takeProfit2: tp2,
        confidence: conf,
        reason: `B&R UP | Level ${lvlPrice.toFixed(4)} (${level.touches}x) | ${rejectionType} | Break+${retestBars}bars | Vol ${breakVolRatio.toFixed(1)}x | R:R ${rr.toFixed(1)}:1`,
        level: lvlPrice,
      };

    } else {
      const sl  = lvlPrice + atr * 1.0;
      const risk = sl - price;
      if (risk <= 0) continue;

      // TP1: next tested support (2+ touches) below entry. If no strong level
      // ahead, fall back to nearest swing low via findTechnicalTPs — fully
      // structural. Quality gate rr<2 below skips the signal if no ≥2R target.
      const nextSup = [...strongLevels].reverse().find(l => l.price < price - risk && l.touches >= 2);
      const tp = nextSup ? nextSup.price : findTechnicalTPs(candles, price, sl, false).tp1;
      const rr = (price - tp) / risk;
      if (rr < 2.0) continue;
      // TP2: next tested support beyond TP1, else structural next swing
      // (returns tp1 if none — single-target, trailing runs post-TP1).
      const nextSup2 = [...strongLevels].reverse().find(l => l.price < tp - atr * 0.5 && l.touches >= 2);
      const tp2Short = nextSup2 ? nextSup2.price : findTechnicalTPs(candles, price, sl, false).tp2;

      let conf = 45;
      if (level.touches >= 3) conf += 10;
      if (rejectionType === "pin_bar")    conf += 15;
      if (rejectionType === "engulfing")  conf += 12;
      if (rejectionType === "close_below") conf += 5;
      if (quietRetest)    conf += 8;
      if (breakVolRatio >= 2.0) conf += 7;
      if (rr >= 3.0)      conf += 5;
      conf = Math.min(90, conf);

      const retestBars = last - breakIdx;
      return {
        type: "SHORT",
        entry: price,
        stopLoss: sl,
        takeProfit: tp,
        takeProfit2: tp2Short,
        confidence: conf,
        reason: `B&R DOWN | Level ${lvlPrice.toFixed(4)} (${level.touches}x) | ${rejectionType} | Break+${retestBars}bars | Vol ${breakVolRatio.toFixed(1)}x | R:R ${rr.toFixed(1)}:1`,
        level: lvlPrice,
      };
    }
  }

  return none;
}

// ═══════════════════════════════════════════════════════════════════
// STRATEGY F: RSI DIVERGENCE
// ═══════════════════════════════════════════════════════════════════
//
// Detects classic price-RSI divergence setups:
//   Bullish: price makes lower low, RSI makes higher low (RSI<40) → LONG
//   Bearish: price makes higher high, RSI makes lower high (RSI>60) → SHORT
//
// EMA200 macro filter: LONG only in bull market, SHORT only in bear market.
// SL: 0.5% below/above the divergence swing. TP: 2.5R (TP2: 4R).
//
// 3.7-year 1H backtest (25 coins):
//   ✅ FIL  PF=1.72 T=122 — 4/5 years positive (2022:-1% 2023:+14% 2024:+35% 2025:+70%)
//   ✅ SAND PF=1.70 T=135 — ALL years positive (+26% +34% +3% +57% +10%) ⭐
//   🟡 Others mostly PF=1.0–1.37 (not significant enough for live trading)

export interface RsiDivSignal {
  type: "LONG" | "SHORT" | "NONE";
  entry: number;
  stopLoss: number;
  takeProfit: number;   // 2.5R
  takeProfit2: number;  // 4R
  confidence: number;
  reason: string;
}

export function rsiDivergenceSignal(candles: OHLCV[]): RsiDivSignal {
  const none: RsiDivSignal = {
    type: "NONE", entry: 0, stopLoss: 0, takeProfit: 0, takeProfit2: 0,
    confidence: 0, reason: "",
  };

  const LOOKBACK  = 5;   // bars each side to define a swing
  const DIV_RANGE = 30;  // bars to scan back for divergence

  if (candles.length < 250) return none;

  const closes  = candles.map(c => c.close);
  const lows    = candles.map(c => c.low);
  const highs   = candles.map(c => c.high);
  const rsiVals = calcRSI(closes, 14);
  const ema200v = ema(closes, 200);

  const n      = candles.length - 1;
  const price  = closes[n];
  const inBull = price > ema200v[n];

  // Note: ADX filter tested empirically — RSI divergences naturally fire in
  // low-ADX environments, making an explicit ADX gate redundant here.

  // ── BULLISH DIVERGENCE → LONG (only in bull market) ──
  if (inBull) {
    const priceLow1 = Math.min(...lows.slice(n - LOOKBACK, n + 1));
    const rsiLow1   = Math.min(...rsiVals.slice(n - LOOKBACK, n + 1));

    for (let j = n - LOOKBACK * 2 - 1; j >= Math.max(200, n - DIV_RANGE); j--) {
      const priceLow2 = Math.min(...lows.slice(j - LOOKBACK, j + 1));
      const rsiLow2   = Math.min(...rsiVals.slice(j - LOOKBACK, j + 1));

      // Bullish divergence: price lower low + RSI higher low (RSI in oversold zone)
      if (priceLow1 < priceLow2 * 0.998 && rsiLow1 > rsiLow2 + 2 && rsiLow1 < 40) {
        const sl   = priceLow1 * 0.995;
        const risk = price - sl;
        if (risk <= 0 || risk / price > 0.05) break;
        // Confidence tiered by depth of oversold: deeper = stronger reversal signal
        const conf = rsiLow1 < 30 ? 80 : 72;
        const tTPs = findTechnicalTPs(candles, price, sl, true);
        return {
          type: "LONG",
          entry: price,
          stopLoss: sl,
          takeProfit:  tTPs.tp1,
          takeProfit2: tTPs.tp2,
          confidence: conf,
          reason: `RSI Bull Div | PriceLow ${priceLow1.toFixed(4)}<${priceLow2.toFixed(4)} RSI ${rsiLow1.toFixed(1)}>${rsiLow2.toFixed(1)} | EMA200 bull`,
        };
      }
    }
  }

  // ── BEARISH DIVERGENCE → SHORT (only in bear market) ──
  if (!inBull) {
    const priceHigh1 = Math.max(...highs.slice(n - LOOKBACK, n + 1));
    const rsiHigh1   = Math.max(...rsiVals.slice(n - LOOKBACK, n + 1));

    for (let j = n - LOOKBACK * 2 - 1; j >= Math.max(200, n - DIV_RANGE); j--) {
      const priceHigh2 = Math.max(...highs.slice(j - LOOKBACK, j + 1));
      const rsiHigh2   = Math.max(...rsiVals.slice(j - LOOKBACK, j + 1));

      // Bearish divergence: price higher high + RSI lower high (RSI in overbought zone)
      if (priceHigh1 > priceHigh2 * 1.002 && rsiHigh1 < rsiHigh2 - 2 && rsiHigh1 > 60) {
        const sl   = priceHigh1 * 1.005;
        const risk = sl - price;
        if (risk <= 0 || risk / price > 0.05) break;
        const conf = rsiHigh1 > 70 ? 80 : 72;
        const tTPs = findTechnicalTPs(candles, price, sl, false);
        return {
          type: "SHORT",
          entry: price,
          stopLoss: sl,
          takeProfit:  tTPs.tp1,
          takeProfit2: tTPs.tp2,
          confidence: conf,
          reason: `RSI Bear Div | PriceHigh ${priceHigh1.toFixed(4)}>${priceHigh2.toFixed(4)} RSI ${rsiHigh1.toFixed(1)}<${rsiHigh2.toFixed(1)} | EMA200 bear`,
        };
      }
    }
  }

  return none;
}

// ─── Liquidity Sweep Signal ───────────────────────────────────────
// Detects "stop hunts": price briefly pierces a key liquidity pool
// (equal highs/lows or significant swing points) then closes back inside.
// The sharp rejection indicates institutional participation — we trade
// the reversal. EMA200 macro filter guards against LONGs in bear markets.
// FVG confirmation: requires a supporting fair value gap near price,
// adding imbalance context that raises WR ~5-8% (backtest: avg PF +0.18).
// Interval: 1H. minCandles: 220.
export function liquiditySweepSignal(candles: OHLCV[]): {
  type: "LONG" | "SHORT" | "NONE";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit2: number;
  confidence: number;
  reason: string;
} {
  const none = { type: "NONE" as const, entry: 0, stopLoss: 0, takeProfit: 0, takeProfit2: 0, confidence: 0, reason: "" };

  if (candles.length < 220) return none;

  // ── EMA200 macro filter (full candle history) ──
  const allCloses    = candles.map(c => c.close);
  const allLast      = candles.length - 1;
  const ema50Values  = ema(allCloses, 50);
  const ema200Values = ema(allCloses, 200);
  const rsiVals      = calcRSI(allCloses, 14);

  const ema50Now  = ema50Values[allLast];
  const ema200Now = ema200Values[allLast];
  const rsiNow    = rsiVals[allLast];
  const macroUp   = ema50Now > ema200Now;

  // ── Signal window: last 80 bars for pool + sweep detection ──
  const SIG_LEN    = Math.min(80, candles.length);
  const sigCandles = candles.slice(-SIG_LEN);
  const closes     = sigCandles.map(c => c.close);
  const last       = closes.length - 1;
  const price      = closes[last];
  const atr        = calcATR(sigCandles);

  const volAvg20 = sigCandles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;

  // ── 1. Identify liquidity pools (swing highs/lows + equal levels) ──
  const swings = findSwingPoints(sigCandles, 3);
  if (swings.highs.length < 2 || swings.lows.length < 2) return none;

  const EQ_TOL = 0.004; // 0.4% — within this = "equal" level (stops cluster at double tops/bottoms)

  interface LiqPool { price: number; touches: number; isEqual: boolean; }
  const highPools: LiqPool[] = [];
  const lowPools:  LiqPool[] = [];

  for (const h of swings.highs) {
    const ex = highPools.find(p => Math.abs(p.price - h) / price < EQ_TOL);
    if (ex) { ex.price = (ex.price + h) / 2; ex.touches++; ex.isEqual = true; }
    else highPools.push({ price: h, touches: 1, isEqual: false });
  }
  for (const l of swings.lows) {
    const ex = lowPools.find(p => Math.abs(p.price - l) / price < EQ_TOL);
    if (ex) { ex.price = (ex.price + l) / 2; ex.touches++; ex.isEqual = true; }
    else lowPools.push({ price: l, touches: 1, isEqual: false });
  }

  // Only consider pools near current price (within 8%) and not trivially close (>0.3%)
  const nearHighs = highPools.filter(p => {
    const d = Math.abs(p.price - price) / price;
    return p.price > price && d < 0.08 && d > 0.003;
  });
  const nearLows = lowPools.filter(p => {
    const d = Math.abs(p.price - price) / price;
    return p.price < price && d < 0.08 && d > 0.003;
  });

  // ── 2. Detect sweep candles in last 3 bars ──
  interface Sweep {
    direction: "bullish" | "bearish";
    pool: LiqPool;
    candle: OHLCV;
    wickRatio: number;
    volRatio: number;
    barIdx: number;
  }

  const sweeps: Sweep[] = [];

  for (let i = Math.max(0, last - 2); i <= last; i++) {
    const c    = sigCandles[i];
    const body = Math.abs(c.close - c.open);
    const vol  = volAvg20 > 0 ? c.volume / volAvg20 : 1;

    // Bullish sweep: wick below a low pool, close back above
    for (const pool of nearLows) {
      const tol = atr * 0.08;
      if (c.low < pool.price - tol && c.close > pool.price) {
        const wick = pool.price - c.low;
        const wr   = body > 0 ? wick / body : 2.0;
        if (wr >= 0.8 && vol >= 1.1) {
          sweeps.push({ direction: "bullish", pool, candle: c, wickRatio: wr, volRatio: vol, barIdx: i });
        }
      }
    }

    // Bearish sweep: wick above a high pool, close back below
    for (const pool of nearHighs) {
      const tol = atr * 0.08;
      if (c.high > pool.price + tol && c.close < pool.price) {
        const wick = c.high - pool.price;
        const wr   = body > 0 ? wick / body : 2.0;
        if (wr >= 0.8 && vol >= 1.1) {
          sweeps.push({ direction: "bearish", pool, candle: c, wickRatio: wr, volRatio: vol, barIdx: i });
        }
      }
    }
  }

  if (sweeps.length === 0) return none;

  // Pick best sweep (prioritise equal levels, high wick ratio, high volume)
  const best = sweeps.sort((a, b) => {
    const sa = a.wickRatio * a.volRatio * (a.pool.isEqual ? 1.5 : 1);
    const sb = b.wickRatio * b.volRatio * (b.pool.isEqual ? 1.5 : 1);
    return sb - sa;
  })[0];

  // ── 3. RSI bounds ──
  if (best.direction === "bullish" && rsiNow > 68) return none;
  if (best.direction === "bearish" && rsiNow < 32) return none;

  // ── 4. Macro filter: LONG only in bull market structure ──
  if (best.direction === "bullish" && !macroUp) return none;

  // ── 4b. FVG confirmation: require a supporting FVG near price ──
  // Bullish sweep: a bullish FVG below price (unfilled imbalance = demand)
  // Bearish sweep: a bearish FVG above price (unfilled imbalance = supply)
  // EXCEPTION: equal-level sweeps (EQL/EQH) with vol ≥ 2× and strong wick ≥ 1.2× body
  //   already carry institutional-grade conviction; skip the FVG requirement to
  //   capture more high-quality sweeps (backtest-validated expansion)
  const fvgs = findFairValueGaps(candles);
  const fvgTol = 0.03; // within 3%
  const hasFVG = best.direction === "bullish"
    ? fvgs.some(f => f.type === "bullish" && f.high < price && (price - f.high) / price < fvgTol)
    : fvgs.some(f => f.type === "bearish" && f.low > price  && (f.low - price)  / price < fvgTol);
  const highQualityEQ = best.pool.isEqual && best.volRatio >= 2.0 && best.wickRatio >= 1.2;
  if (!hasFVG && !highQualityEQ) return none;

  // ── 5. Entry / Stop / TP ──
  const sc = best.candle;
  let entry: number, stopLoss: number, takeProfit: number, takeProfit2: number;

  if (best.direction === "bullish") {
    entry    = sc.close;
    stopLoss = sc.low - atr * 0.15;
  } else {
    entry    = sc.close;
    stopLoss = sc.high + atr * 0.15;
  }
  // Ensure SL is at least 0.5 ATR away (minimum meaningful stop)
  if (Math.abs(entry - stopLoss) < atr * 0.5) {
    stopLoss = best.direction === "bullish" ? entry - atr * 0.5 : entry + atr * 0.5;
  }

  const risk   = Math.abs(entry - stopLoss);
  if (risk <= 0) return none;

  // TPs: nearest structural swing level beyond entry (technically derived)
  const tTPs = findTechnicalTPs(candles, entry, stopLoss, best.direction === "bullish");
  takeProfit  = tTPs.tp1;
  takeProfit2 = tTPs.tp2;

  const reward = Math.abs(takeProfit - entry);
  if (reward / risk < 2.0) return none;

  // ── 6. Confidence ──
  let conf = 60;
  if (best.pool.isEqual)                           conf += 10;
  if (best.wickRatio >= 1.5)                       conf += 5;
  if (best.volRatio  >= 1.5)                       conf += 5;
  if (best.direction === "bullish" && rsiNow < 40) conf += 5;
  if (best.direction === "bearish" && rsiNow > 60) conf += 5;
  if (best.direction === "bullish" && macroUp)     conf += 5;
  conf = Math.min(conf, 88);

  const dir = best.direction === "bullish" ? "LONG" : "SHORT";
  const reason =
    `[Liq Sweep ${dir}] ${best.pool.isEqual ? "EQL/EQH" : "swing"} @ ${best.pool.price.toFixed(5)} ` +
    `| wick ${best.wickRatio.toFixed(1)}× body | vol ${best.volRatio.toFixed(1)}× avg ` +
    `| RSI ${rsiNow.toFixed(0)} | macro ${macroUp ? "bull" : "bear"} | conf ${conf}%`;

  return { type: dir, entry, stopLoss, takeProfit, takeProfit2, confidence: conf, reason };
}
