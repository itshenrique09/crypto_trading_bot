/**
 * Exchange abstraction — one interface, several venues.
 *
 * Added Aug 2026 when MEXC stopped serving Portuguese residents. The live
 * engine used to call MexcClient directly, which meant its idioms leaked into
 * routes.ts: contract counts, positionType 1|2, a setTpSl call that only MEXC
 * has. Kraken speaks base units, "long"/"short", and separate reduce-only
 * protective orders. Rather than teach the engine both dialects, both venues
 * are normalised behind this interface.
 *
 * IMPORTANT: this layer is plumbing only. It changes WHERE orders go, never
 * WHAT the engine decides — strategy logic, entry gates, the risk-based
 * sizing formula and the exit rules all live upstream and are untouched.
 *
 * Sizing contract: callers pass a USD notional and the entry price; each
 * adapter converts to whatever unit its venue wants (MEXC contracts, Kraken
 * base units) and rounds DOWN, so venue rounding can never push a position
 * above the intended 1R.
 */

import {
  getMexcClient, toMexcSymbol, getOpenOrderSide,
  type MexcClient,
} from "./mexc-client";
import {
  getKrakenClient, toKrakenSymbol, fromKrakenSymbol,
  type KrakenClient,
} from "./kraken-client";

export type ExchangeId = "mexc" | "kraken";

export const EXCHANGES: { id: ExchangeId; name: string; note: string }[] = [
  { id: "mexc",   name: "MEXC Futures",   note: "No MiCA licence — unavailable to EEA/PT residents since Jul 2026" },
  { id: "kraken", name: "Kraken Futures", note: "MiFID II via Payward Europe Digital Solutions (CY) — EEA eligible, max 10× leverage" },
];

export function isExchangeId(v: unknown): v is ExchangeId {
  return v === "mexc" || v === "kraken";
}

/** A venue-neutral open position. */
export interface ExchangePosition {
  /** Bot symbol, e.g. "BTC" (not the venue's ticker). */
  botSymbol: string;
  direction: "LONG" | "SHORT";
  /** Position size in the venue's own units — pass back verbatim when closing. */
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  /** Venue's mark price — what it settles P&L against. */
  markPrice?: number;
  /** Notional value at mark. */
  notionalUsd?: number;
  /** Funding accrued but not yet settled (negative = you pay). */
  unrealizedFunding?: number | null;
  /** Venue-specific payload (MEXC needs positionId for TP/SL). */
  raw: unknown;
}

export interface ExchangeBalance {
  /** Equity including unrealised PnL — what position sizing is based on. */
  equity: number;
  /** Margin free for new positions. */
  available: number;
  /** Margin currently backing open positions. */
  usedMargin?: number;
  /** Total unrealised PnL across open positions. */
  unrealizedPnl?: number;
}

/** A protective order resting on the venue (what actually guards a position). */
export interface ExchangeProtection {
  botSymbol: string;
  kind: "stop" | "take_profit";
  price: number;
  size: number;
}

export interface OpenResult {
  orderId: string;
  /** Size actually sent, in venue units. */
  size: number;
  /** Notional the venue units represent, for journalling. */
  notionalUsd: number;
}

export interface ExchangeAdapter {
  readonly id: ExchangeId;
  testConnection(): Promise<{ ok: boolean; balance?: number; error?: string }>;
  getBalance(): Promise<ExchangeBalance>;
  getPositions(): Promise<ExchangePosition[]>;
  /** True when the venue lists a tradeable perpetual for this bot symbol. */
  isTradeable(botSymbol: string): Promise<boolean>;
  openPosition(botSymbol: string, direction: "LONG" | "SHORT", notionalUsd: number, price: number, leverage: number): Promise<OpenResult>;
  closePosition(position: ExchangePosition): Promise<{ orderId: string; size: number }>;
  closePartial(position: ExchangePosition, closePct: number): Promise<{ orderId: string; size: number }>;
  /** Place/replace stop-loss (and optionally take-profit) for an open position. */
  setProtection(position: ExchangePosition, stopLossPrice: number, takeProfitPrice?: number): Promise<void>;
  /** Protective orders currently resting on the venue, for display/verification. */
  getProtection?(): Promise<ExchangeProtection[]>;
}

// ── MEXC ──────────────────────────────────────────────────────────────────

interface MexcRaw { positionId: number; symbol: string; positionType: 1 | 2 }

export class MexcAdapter implements ExchangeAdapter {
  readonly id = "mexc" as const;
  constructor(private readonly client: MexcClient) {}

  async testConnection() { return this.client.testConnection(); }

  async getBalance(): Promise<ExchangeBalance> {
    const a = await this.client.getBalance();
    return { equity: a.equity, available: a.availableBalance };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const positions = await this.client.getPositions();
    return positions
      .filter(p => p.holdVol > 0)
      .map(p => ({
        botSymbol: p.symbol.replace(/_USDT$/i, ""),
        direction: p.positionType === 1 ? "LONG" as const : "SHORT" as const,
        size: p.holdVol,
        entryPrice: p.openAvgPrice,
        unrealizedPnl: p.unrealised,
        raw: { positionId: p.positionId, symbol: p.symbol, positionType: p.positionType } satisfies MexcRaw,
      }));
  }

  async isTradeable(botSymbol: string): Promise<boolean> {
    try {
      const info = await this.client.getContractInfo(toMexcSymbol(botSymbol));
      return Boolean(info && info.contractSize > 0);
    } catch { return false; }
  }

  async openPosition(botSymbol: string, direction: "LONG" | "SHORT", notionalUsd: number, price: number, leverage: number): Promise<OpenResult> {
    const symbol = toMexcSymbol(botSymbol);
    const vol = await this.client.calcContractVol(symbol, notionalUsd, price);
    if (!(vol > 0)) throw new Error(`MEXC: ${botSymbol} position rounds to zero contracts`);
    const order = await this.client.placeOrder({
      symbol,
      side: getOpenOrderSide(direction),
      openType: 2,        // cross margin
      type: 5,            // market
      vol,
      leverage,
    });
    const notional = await this.client.calcPositionNotional(symbol, vol, price).catch(() => notionalUsd);
    return { orderId: String(order.orderId), size: vol, notionalUsd: notional };
  }

  async closePosition(position: ExchangePosition) {
    const raw = position.raw as MexcRaw;
    const order = await this.client.closePosition(raw.symbol, raw.positionType, position.size);
    return { orderId: String(order.orderId), size: position.size };
  }

  async closePartial(position: ExchangePosition, closePct: number) {
    const raw = position.raw as MexcRaw;
    const r = await this.client.closePartialPosition(raw.symbol, raw.positionType, position.size, closePct);
    return { orderId: String(r.orderId), size: r.vol };
  }

  async setProtection(position: ExchangePosition, stopLossPrice: number, takeProfitPrice?: number): Promise<void> {
    const raw = position.raw as MexcRaw;
    // MEXC mutates the position's existing TP/SL plan order; it requires both
    // levels, so fall back to the stop when no take-profit is supplied.
    await this.client.setTpSl(raw.symbol, String(raw.positionId), stopLossPrice, takeProfitPrice ?? stopLossPrice);
  }
}

// ── Kraken ────────────────────────────────────────────────────────────────

export class KrakenAdapter implements ExchangeAdapter {
  readonly id = "kraken" as const;
  constructor(private readonly client: KrakenClient) {}

  async testConnection() { return this.client.testConnection(); }

  async getBalance(): Promise<ExchangeBalance> {
    const b = await this.client.getBalance();
    return { equity: b.equity, available: b.availableBalance, usedMargin: b.usedMargin, unrealizedPnl: b.unrealizedPnl };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const positions = await this.client.getPositions();
    // Mark against the venue's own price so the app agrees with the exchange.
    const tickers = await this.client.getTickers().catch(() => new Map());
    return positions.map(p => {
      const t = tickers.get(p.symbol);
      const mark = t?.markPrice && t.markPrice > 0 ? t.markPrice : p.price;
      return {
        botSymbol: fromKrakenSymbol(p.symbol),
        direction: p.side === "long" ? "LONG" as const : "SHORT" as const,
        size: p.size,
        entryPrice: p.price,
        unrealizedPnl: p.unrealizedPnl,
        markPrice: mark,
        notionalUsd: p.size * mark,
        unrealizedFunding: p.unrealizedFunding ?? null,
        raw: { symbol: p.symbol },
      };
    });
  }

  async getProtection(): Promise<ExchangeProtection[]> {
    const orders = await this.client.getOpenOrders();
    return orders
      .filter(o => o.reduceOnly && /stp|take_profit/i.test(o.orderType) && o.stopPrice != null)
      .map(o => ({
        botSymbol: fromKrakenSymbol(o.symbol),
        kind: /take_profit/i.test(o.orderType) ? "take_profit" as const : "stop" as const,
        price: o.stopPrice!,
        size: o.size,
      }));
  }

  async isTradeable(botSymbol: string): Promise<boolean> {
    try { await this.client.getInstrument(botSymbol); return true; }
    catch { return false; }
  }

  async openPosition(botSymbol: string, direction: "LONG" | "SHORT", notionalUsd: number, price: number, _leverage: number): Promise<OpenResult> {
    // Kraken sets leverage from the account's margin mode, not per order; the
    // EEA entity caps it at 10×. Sizing is risk-based either way, so leverage
    // only decides how much margin the same position locks up.
    const size = await this.client.sizeForNotional(botSymbol, notionalUsd, price);
    if (!(size > 0)) throw new Error(`Kraken: ${botSymbol} position rounds to zero at the instrument's size precision`);
    const order = await this.client.openPosition(botSymbol, direction, size);
    return { orderId: order.orderId, size, notionalUsd: size * price };
  }

  async closePosition(position: ExchangePosition) {
    return this.client.closePosition(position.botSymbol, position.direction, position.size);
  }

  async closePartial(position: ExchangePosition, closePct: number) {
    return this.client.closePartialPosition(position.botSymbol, position.direction, position.size, closePct);
  }

  async setProtection(position: ExchangePosition, stopLossPrice: number, takeProfitPrice?: number): Promise<void> {
    await this.client.setProtection(position.botSymbol, position.direction, position.size, stopLossPrice, takeProfitPrice);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────

export function buildAdapter(exchange: ExchangeId, apiKey: string, apiSecret: string): ExchangeAdapter {
  if (exchange === "kraken") return new KrakenAdapter(getKrakenClient(apiKey, apiSecret));
  return new MexcAdapter(getMexcClient(apiKey, apiSecret));
}

/** Venue ticker for a bot symbol — for logs and journal notes. */
export function venueSymbol(exchange: ExchangeId, botSymbol: string): string {
  return exchange === "kraken" ? toKrakenSymbol(botSymbol) : toMexcSymbol(botSymbol);
}
