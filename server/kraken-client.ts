/**
 * Kraken Futures API Client (Derivatives v3)
 *
 * Added Aug 2026: MEXC stopped serving Portuguese residents (no MiCA licence;
 * PT absent from its KYC country list), so the live engine needs a venue that
 * is actually legal here. Kraken's EEA derivatives are provided by Payward
 * Europe Digital Solutions (CY) Ltd under a MiFID II licence, and its
 * instrument feed confirms 274 tradeable perpetuals permitted on that platform
 * — covering 40 of the bot's 41 symbols (only LUNC is absent; the pipeline
 * harness put that at −3.8% of total R, PF 1.93→1.90).
 *
 * Docs: https://docs.kraken.com/api/docs/guides/futures-rest
 *
 * Differences from the MEXC client that shaped this implementation:
 *   • Auth is SHA-256 then HMAC-SHA-512 over a base64-DECODED secret.
 *   • The signed path omits the `/derivatives` prefix (`/api/v3/...`).
 *   • Order size is denominated in BASE UNITS, not contracts, and its
 *     precision comes from `contractValueTradePrecision` — which can be
 *     NEGATIVE (PF_PEPEUSD is −3, i.e. round to the nearest 1000 units).
 *   • There is no setTpSl: protection is separate reduce-only `stp` /
 *     `take_profit` orders, so moving a stop means cancel + replace.
 */

import crypto from "crypto";

const BASE_URL = "https://futures.kraken.com/derivatives";
const API_PREFIX = "/api/v3";

// Assets whose Kraken ticker differs from the bot's symbol.
// Kraken quotes Bitcoin as XBT. Keep this list to NAME-only aliases: a
// scale-changing alias (e.g. a 1000x contract) would silently size orders
// wrong, the same class of bug MEXC's 1000BONK contract would have caused.
const KRAKEN_SYMBOL_OVERRIDES: Record<string, string> = {
  BTC: "XBT",
};

export interface KrakenPosition {
  symbol: string;              // e.g. "PF_XBTUSD"
  side: "long" | "short";
  size: number;                // base units
  price: number;               // average entry
  unrealizedPnl: number;
  unrealizedFunding?: number | null;
}

export interface KrakenBalance {
  /** Margin equity — portfolio value including unrealised PnL. */
  equity: number;
  /** Margin free to open new positions. */
  availableBalance: number;
  currency: string;
  /** Margin currently backing open positions. */
  usedMargin: number;
  /** Total unrealised PnL across open positions. */
  unrealizedPnl: number;
}

export interface KrakenTicker {
  symbol: string;
  markPrice: number;
  last: number;
  fundingRate: number | null;
  /** Predicted next funding rate, when the venue publishes one. */
  fundingRatePrediction: number | null;
  vol24h: number;
}

export interface KrakenInstrument {
  symbol: string;
  tickSize: number;
  contractSize: number;
  /** Decimals for order size. MAY BE NEGATIVE (round to 10^-precision). */
  sizePrecision: number;
  maxPositionSize: number;
  tradeable: boolean;
}

export interface KrakenOrder {
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  orderType: string;
  size: number;
  stopPrice?: number;
  reduceOnly?: boolean;
}

/** A real execution on the venue — the only honest source of a fill price. */
export interface KrakenFill {
  fillId: string;
  symbol: string;              // e.g. "PF_SEIUSD"
  side: "buy" | "sell";
  size: number;                // base units
  price: number;
  timeMs: number;
  /** "taker" | "maker" | "liquidation" | "assignor" | "assignee" … */
  fillType: string;
}

// ── Pure helpers (unit-tested) ────────────────────────────────────────────

/** Bot symbol → Kraken perpetual symbol. "BTC" → "PF_XBTUSD" */
export function toKrakenSymbol(symbol: string): string {
  const base = KRAKEN_SYMBOL_OVERRIDES[symbol] ?? symbol;
  return `PF_${base.toUpperCase()}USD`;
}

/** Kraken perpetual symbol → bot symbol. "PF_XBTUSD" → "BTC" */
export function fromKrakenSymbol(krakenSymbol: string): string {
  const m = /^PF_(.+?)USD$/i.exec(krakenSymbol);
  if (!m) return krakenSymbol;
  const base = m[1].toUpperCase();
  for (const [bot, kraken] of Object.entries(KRAKEN_SYMBOL_OVERRIDES)) {
    if (kraken === base) return bot;
  }
  return base;
}

/**
 * Round an order size DOWN to the instrument's tradeable precision.
 * Rounds down so a rounding step can never inflate risk beyond the intended R.
 * `precision` may be negative: −3 means the nearest 1000 units.
 */
export function roundSize(size: number, precision: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  const factor = Math.pow(10, precision);
  const rounded = Math.floor(size * factor) / factor;
  // Guard against float dust (e.g. 0.30000000000000004) at sane precisions.
  return precision >= 0 ? Number(rounded.toFixed(Math.min(precision, 10))) : rounded;
}

/** Round a price to the instrument's tick size. */
export function roundPrice(price: number, tickSize: number): number {
  if (!(tickSize > 0) || !Number.isFinite(price)) return price;
  const ticks = Math.round(price / tickSize);
  const rounded = ticks * tickSize;
  // tickSize can be 1e-10; toFixed keeps the value clean of float noise.
  const decimals = Math.max(0, Math.min(12, Math.ceil(-Math.log10(tickSize))));
  return Number(rounded.toFixed(decimals));
}

/** Position size in base units for a USD notional at a given price. */
export function sizeForNotional(notionalUsd: number, price: number, sizePrecision: number): number {
  if (!(price > 0) || !(notionalUsd > 0)) return 0;
  return roundSize(notionalUsd / price, sizePrecision);
}

/**
 * Is this a protective (stop / take-profit) order type?
 *
 * Kraken's order types DO NOT ROUND-TRIP: /sendorder takes `"stp"`, and
 * /openorders hands the same order back as `"stop"`. Matching only on `"stp"`
 * therefore never recognises a stop — `"stop"` does not contain `"stp"` — and
 * that cost twice over: the app reported every live position as having no stop
 * loss, and setProtection's cancel-then-replace could not find the old stop to
 * cancel, so each move to break-even orphaned one more resting order.
 *
 * Accepts both spellings in both directions, so it cannot matter again which
 * side of the API a string came from.
 */
export function isProtectiveOrderType(orderType: string): boolean {
  return /(^|_)stp$|stop|take[_ ]?profit/i.test(orderType.trim());
}

/** Which kind of protection an order type denotes. */
export function protectionKind(orderType: string): "stop" | "take_profit" {
  return /take[_ ]?profit/i.test(orderType) ? "take_profit" : "stop";
}

/** Order side to OPEN a position in the given direction. */
export function openSide(direction: "LONG" | "SHORT"): "buy" | "sell" {
  return direction === "LONG" ? "buy" : "sell";
}

/** Order side to CLOSE (or protect) a position in the given direction. */
export function closeSide(direction: "LONG" | "SHORT"): "buy" | "sell" {
  return direction === "LONG" ? "sell" : "buy";
}

/**
 * Compute the `Authent` header.
 * SHA-256(postData + nonce + path) → HMAC-SHA-512 keyed by the base64-decoded
 * secret → base64. `path` must be the /api/v3/... form (no /derivatives).
 */
export function computeAuthent(postData: string, nonce: string, path: string, apiSecret: string): string {
  const sha = crypto.createHash("sha256").update(postData + nonce + path).digest();
  const key = Buffer.from(apiSecret, "base64");
  return crypto.createHmac("sha512", key).update(sha).digest("base64");
}

/** Pick the open position matching a bot symbol and (optionally) direction. */
export function selectPosition(
  positions: KrakenPosition[],
  botSymbol: string,
  direction?: "LONG" | "SHORT",
): KrakenPosition | null {
  const target = toKrakenSymbol(botSymbol);
  return positions.find(p =>
    p.symbol.toUpperCase() === target &&
    p.size > 0 &&
    (!direction || p.side === (direction === "LONG" ? "long" : "short")),
  ) ?? null;
}

// ── Client ────────────────────────────────────────────────────────────────

export class KrakenClient {
  private instrumentCache: { at: number; map: Map<string, KrakenInstrument> } | null = null;
  private tickerCache: { at: number; map: Map<string, KrakenTicker> } | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  private async request<T>(
    method: "GET" | "POST",
    endpoint: string,                       // e.g. "/accounts"
    params: Record<string, any> = {},
  ): Promise<T> {
    const path = `${API_PREFIX}${endpoint}`;
    const nonce = String(Date.now());
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
    const postData = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();

    const headers: Record<string, string> = {
      APIKey: this.apiKey,
      Nonce: nonce,
      Authent: computeAuthent(postData, nonce, path, this.apiSecret),
    };

    let url = `${BASE_URL}${path}`;
    let body: string | undefined;
    if (method === "GET") {
      if (postData) url += `?${postData}`;
    } else {
      body = postData;
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    if (!res.ok) throw new Error(`Kraken API ${method} ${endpoint} → ${res.status}: ${text}`);

    let data: any;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Kraken API ${endpoint}: malformed response: ${text.slice(0, 200)}`); }

    if (data?.result === "error" || data?.error) {
      throw new Error(`Kraken API error on ${endpoint}: ${data.error ?? JSON.stringify(data.errors ?? data)}`);
    }
    return data as T;
  }

  // ── Account ─────────────────────────────────────────────────────────────

  /**
   * Balance from the multi-collateral ("flex") cross-margin wallet, which is
   * what EEA perpetual accounts use. Field names are read defensively because
   * Kraken exposes several account shapes (cash / per-contract / flex) and the
   * exact keys differ between them.
   */
  async getBalance(): Promise<KrakenBalance> {
    const data = await this.request<any>("GET", "/accounts");
    const accounts = data?.accounts ?? {};
    const flex = accounts.flex ?? Object.values(accounts).find((a: any) => a?.type === "multiCollateralMarginAccount");

    if (flex) {
      const equity = Number(flex.portfolioValue ?? flex.marginEquity ?? flex.balanceValue ?? 0);
      const available = Number(flex.availableMargin ?? flex.collateralValue ?? equity);
      return {
        equity,
        availableBalance: available,
        currency: "USD",
        usedMargin: Number(flex.initialMargin ?? 0),
        unrealizedPnl: Number(flex.totalUnrealized ?? flex.pnl ?? 0),
      };
    }

    // Fallback: sum USD-ish balances from a cash account.
    const cash = accounts.cash?.balances ?? {};
    const usd = Number(cash.USD ?? cash.usd ?? 0);
    if (usd > 0) return { equity: usd, availableBalance: usd, currency: "USD", usedMargin: 0, unrealizedPnl: 0 };

    throw new Error("No Kraken flex/cash futures account found — check that derivatives are enabled on this account");
  }

  async getPositions(): Promise<KrakenPosition[]> {
    const data = await this.request<any>("GET", "/openpositions");
    const list: any[] = data?.openPositions ?? [];
    return list
      .filter(p => Number(p?.size) > 0)
      .map(p => ({
        symbol: String(p.symbol).toUpperCase(),
        side: p.side === "short" ? "short" : "long",
        size: Number(p.size),
        price: Number(p.price),
        unrealizedPnl: Number(p.unrealizedPnl ?? 0),
        unrealizedFunding: p.unrealizedFunding == null ? null : Number(p.unrealizedFunding),
      }));
  }

  async getPosition(botSymbol: string, direction?: "LONG" | "SHORT"): Promise<KrakenPosition | null> {
    return selectPosition(await this.getPositions(), botSymbol, direction);
  }

  // ── Instruments ─────────────────────────────────────────────────────────

  /** Public instrument metadata, cached 10 min (sizing precision, tick size). */
  async getInstruments(): Promise<Map<string, KrakenInstrument>> {
    if (this.instrumentCache && Date.now() - this.instrumentCache.at < 10 * 60_000) {
      return this.instrumentCache.map;
    }
    const res = await fetch(`${BASE_URL}${API_PREFIX}/instruments`);
    if (!res.ok) throw new Error(`Kraken instruments → ${res.status}`);
    const json: any = await res.json();
    const map = new Map<string, KrakenInstrument>();
    for (const i of json?.instruments ?? []) {
      const symbol = String(i?.symbol ?? "").toUpperCase();
      if (!symbol.startsWith("PF_")) continue;
      map.set(symbol, {
        symbol,
        tickSize: Number(i.tickSize),
        contractSize: Number(i.contractSize ?? 1),
        sizePrecision: Number(i.contractValueTradePrecision ?? 0),
        maxPositionSize: Number(i.maxPositionSize ?? Number.MAX_SAFE_INTEGER),
        tradeable: Boolean(i.tradeable),
      });
    }
    this.instrumentCache = { at: Date.now(), map };
    return map;
  }

  /**
   * Public ticker feed — mark price and funding per contract. The engine marks
   * open positions against the venue's own mark price rather than a third-party
   * quote, so what the app shows matches what the exchange will settle on.
   * Cached 5s: fresh enough for a live P&L readout, cheap enough to poll.
   */
  async getTickers(): Promise<Map<string, KrakenTicker>> {
    if (this.tickerCache && Date.now() - this.tickerCache.at < 5_000) return this.tickerCache.map;
    const res = await fetch(`${BASE_URL}${API_PREFIX}/tickers`);
    if (!res.ok) throw new Error(`Kraken tickers → ${res.status}`);
    const json: any = await res.json();
    const map = new Map<string, KrakenTicker>();
    for (const t of json?.tickers ?? []) {
      const symbol = String(t?.symbol ?? "").toUpperCase();
      if (!symbol.startsWith("PF_")) continue;
      map.set(symbol, {
        symbol,
        markPrice: Number(t.markPrice ?? t.last ?? 0),
        last: Number(t.last ?? t.markPrice ?? 0),
        fundingRate: t.fundingRate != null ? Number(t.fundingRate) : null,
        fundingRatePrediction: t.fundingRatePrediction != null ? Number(t.fundingRatePrediction) : null,
        vol24h: Number(t.vol24h ?? 0),
      });
    }
    this.tickerCache = { at: Date.now(), map };
    return map;
  }

  async getInstrument(botSymbol: string): Promise<KrakenInstrument> {
    const sym = toKrakenSymbol(botSymbol);
    const inst = (await this.getInstruments()).get(sym);
    if (!inst) throw new Error(`No Kraken perpetual contract for ${botSymbol} (${sym})`);
    if (!inst.tradeable) throw new Error(`Kraken contract ${sym} is not currently tradeable`);
    return inst;
  }

  /** Order size (base units) for a USD notional, at the instrument's precision. */
  async sizeForNotional(botSymbol: string, notionalUsd: number, price: number): Promise<number> {
    const inst = await this.getInstrument(botSymbol);
    return sizeForNotional(notionalUsd, price, inst.sizePrecision);
  }

  // ── Orders ──────────────────────────────────────────────────────────────

  /** Open a position at market. */
  async openPosition(botSymbol: string, direction: "LONG" | "SHORT", size: number): Promise<{ orderId: string; size: number }> {
    const symbol = toKrakenSymbol(botSymbol);
    if (!(size > 0)) throw new Error(`Invalid order size for ${symbol}: ${size}`);
    const data = await this.request<any>("POST", "/sendorder", {
      orderType: "mkt",
      symbol,
      side: openSide(direction),
      size,
    });
    const orderId = data?.sendStatus?.order_id ?? data?.sendStatus?.orderId ?? "";
    const status = data?.sendStatus?.status;
    if (status && !["placed", "partiallyFilled", "filled"].includes(status)) {
      throw new Error(`Kraken rejected order for ${symbol}: ${status}`);
    }
    return { orderId: String(orderId), size };
  }

  /** Close (or partially close) a position at market via a reduce-only order. */
  async closePosition(botSymbol: string, direction: "LONG" | "SHORT", size: number): Promise<{ orderId: string; size: number }> {
    const symbol = toKrakenSymbol(botSymbol);
    if (!(size > 0)) throw new Error(`Invalid close size for ${symbol}: ${size}`);
    const data = await this.request<any>("POST", "/sendorder", {
      orderType: "mkt",
      symbol,
      side: closeSide(direction),
      size,
      reduceOnly: true,
    });
    return { orderId: String(data?.sendStatus?.order_id ?? ""), size };
  }

  /** Close a share of a position (e.g. the 60% TP1 partial). */
  async closePartialPosition(botSymbol: string, direction: "LONG" | "SHORT", holdSize: number, closePct: number): Promise<{ orderId: string; size: number }> {
    const inst = await this.getInstrument(botSymbol);
    const size = roundSize(holdSize * closePct, inst.sizePrecision);
    if (!(size > 0)) throw new Error(`Partial close of ${botSymbol} rounds to zero at precision ${inst.sizePrecision}`);
    return this.closePosition(botSymbol, direction, size);
  }

  async getOpenOrders(): Promise<KrakenOrder[]> {
    const data = await this.request<any>("GET", "/openorders");
    const list: any[] = data?.openOrders ?? [];
    return list.map(o => ({
      orderId: String(o.order_id ?? o.orderId ?? ""),
      symbol: String(o.symbol ?? "").toUpperCase(),
      side: o.side === "sell" ? "sell" : "buy",
      orderType: String(o.orderType ?? o.type ?? ""),
      size: Number(o.unfilledSize ?? o.size ?? 0),
      stopPrice: o.stopPrice != null ? Number(o.stopPrice) : undefined,
      reduceOnly: Boolean(o.reduceOnly),
    }));
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request("POST", "/cancelorder", { order_id: orderId });
  }

  /**
   * Recent executions for the account.
   *
   * This is the only place a REAL fill price can be read. Everywhere else the
   * engine has to guess — and when a stop or take-profit fires on the venue,
   * guessing means the journal records profit the account never earned.
   *
   * `since` is applied HERE, not by the venue. Kraken's `lastFillTime` is not a
   * "from" filter — it pages BACKWARDS, returning fills recorded BEFORE that
   * time. Probing the live account made this unmistakable: no parameter gave 24
   * fills, `lastFillTime` set a week back gave 0. Passing a start time would
   * therefore have returned nothing, every exit would have quietly fallen back
   * to a ticker estimate, and the fix would have looked like it was working.
   *
   * Kraken caps the response at its recent window, so this reconciles trades
   * that closed minutes-to-days ago, not full history.
   */
  async getFills(since?: Date): Promise<KrakenFill[]> {
    const data = await this.request<any>("GET", "/fills");
    const cutoffMs = since ? since.getTime() : -Infinity;
    const list: any[] = data?.fills ?? [];
    return list
      .map(f => ({
        fillId:   String(f.fill_id ?? f.fillId ?? ""),
        symbol:   String(f.symbol ?? "").toUpperCase(),
        side:     f.side === "sell" ? "sell" as const : "buy" as const,
        size:     Number(f.size ?? 0),
        price:    Number(f.price ?? 0),
        timeMs:   new Date(f.fillTime ?? 0).getTime(),
        fillType: String(f.fillType ?? ""),
      }))
      .filter(f => f.size > 0 && f.price > 0 && Number.isFinite(f.timeMs) && f.timeMs >= cutoffMs)
      .sort((a, b) => a.timeMs - b.timeMs);
  }

  /**
   * Set stop-loss and take-profit for an open position.
   *
   * Kraken has no "attach TP/SL to position" call — protection is two separate
   * reduce-only trigger orders. Existing protective orders for the symbol are
   * cancelled first so this is idempotent and can be used to move a stop to
   * break-even (which the engine does after TP1).
   */
  async setProtection(
    botSymbol: string,
    direction: "LONG" | "SHORT",
    size: number,
    stopLossPrice: number,
    takeProfitPrice?: number,
  ): Promise<{ stopOrderId: string; takeProfitOrderId?: string }> {
    const symbol = toKrakenSymbol(botSymbol);
    const inst = await this.getInstrument(botSymbol);
    const side = closeSide(direction);

    // Drop stale protection for this symbol before writing new levels. This
    // must recognise BOTH spellings of a stop, or the order it fails to match
    // is left resting forever — see isProtectiveOrderType.
    for (const o of await this.getOpenOrders()) {
      if (o.symbol === symbol && o.reduceOnly && isProtectiveOrderType(o.orderType)) {
        await this.cancelOrder(o.orderId).catch(() => { /* already gone */ });
      }
    }

    const sl = await this.request<any>("POST", "/sendorder", {
      orderType: "stp",
      symbol,
      side,
      size,
      stopPrice: roundPrice(stopLossPrice, inst.tickSize),
      reduceOnly: true,
      triggerSignal: "mark",
    });

    let tpId: string | undefined;
    if (takeProfitPrice != null && Number.isFinite(takeProfitPrice)) {
      const tp = await this.request<any>("POST", "/sendorder", {
        orderType: "take_profit",
        symbol,
        side,
        size,
        stopPrice: roundPrice(takeProfitPrice, inst.tickSize),
        reduceOnly: true,
        triggerSignal: "mark",
      });
      tpId = String(tp?.sendStatus?.order_id ?? "");
    }

    return { stopOrderId: String(sl?.sendStatus?.order_id ?? ""), takeProfitOrderId: tpId };
  }

  // ── Connection test ─────────────────────────────────────────────────────

  async testConnection(): Promise<{ ok: boolean; balance?: number; error?: string }> {
    try {
      const b = await this.getBalance();
      return { ok: true, balance: b.availableBalance };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }
}

// ── Singleton factory (mirrors getMexcClient) ─────────────────────────────

let _client: KrakenClient | null = null;
let _creds = "";

export function getKrakenClient(apiKey: string, apiSecret: string): KrakenClient {
  const key = `${apiKey}:${apiSecret}`;
  if (!_client || _creds !== key) {
    _client = new KrakenClient(apiKey, apiSecret);
    _creds = key;
  }
  return _client;
}
