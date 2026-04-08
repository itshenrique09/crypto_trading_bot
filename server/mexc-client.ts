/**
 * MEXC Futures API Client
 *
 * Handles authenticated requests to MEXC Futures (swap) API.
 * All order placement, position management, and account queries.
 *
 * Docs: https://mxcdevelop.github.io/apidocs/contract_v1_en/
 *
 * Usage:
 *   const client = new MexcClient(apiKey, apiSecret);
 *   await client.placeOrder({ symbol: "BTC_USDT", side: "BUY", ... });
 *
 * To activate: set MEXC_API_KEY and MEXC_API_SECRET in environment,
 * or configure via POST /api/live/config in the UI.
 */

import crypto from "crypto";

const BASE_URL = "https://contract.mexc.com";

export interface MexcOrder {
  symbol: string;           // e.g. "BTC_USDT"
  side: 1 | 2;             // 1=BUY (open long / close short), 2=SELL (open short / close long)
  openType: 1 | 2;         // 1=isolated, 2=cross
  type: 1 | 2 | 3 | 4 | 5 | 6; // 1=limit, 5=market
  vol: number;              // number of contracts
  leverage?: number;        // 1-200
  price?: number;           // required for limit orders
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

export interface MexcPosition {
  symbol: string;
  holdVol: number;
  positionType: 1 | 2;     // 1=long, 2=short
  openAvgPrice: number;
  closeAvgPrice: number;
  realised: number;
  unrealised: number;
  leverage: number;
  im: number;               // initial margin
}

export interface MexcAccountInfo {
  currency: string;
  availableBalance: number;
  frozenBalance: number;
  equity: number;
}

export class MexcClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  // ── Signature ─────────────────────────────────────────────────────
  private sign(timestamp: number, params: string): string {
    const payload = this.apiKey + timestamp + params;
    return crypto.createHmac("sha256", this.apiSecret).update(payload).digest("hex");
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    const timestamp = Date.now();
    const paramsStr = method === "GET"
      ? new URLSearchParams(params as any).toString()
      : JSON.stringify(params);

    const signature = this.sign(timestamp, method === "GET" ? paramsStr : JSON.stringify(params));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "ApiKey": this.apiKey,
      "Request-Time": String(timestamp),
      "Signature": signature,
    };

    const url = `${BASE_URL}${path}${method === "GET" && paramsStr ? `?${paramsStr}` : ""}`;
    const res = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? JSON.stringify(params) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MEXC API ${method} ${path} → ${res.status}: ${text}`);
    }

    const data = await res.json() as { success: boolean; data: T; message?: string; code?: number };
    if (!data.success) {
      throw new Error(`MEXC API error: ${data.message || data.code}`);
    }
    return data.data;
  }

  // ── Account ───────────────────────────────────────────────────────

  /** Get USDT futures account balance */
  async getBalance(): Promise<MexcAccountInfo> {
    const accounts = await this.request<MexcAccountInfo[]>("GET", "/api/v1/private/account/assets");
    const usdt = accounts.find(a => a.currency === "USDT");
    if (!usdt) throw new Error("No USDT futures account found");
    return usdt;
  }

  /** Get all open positions */
  async getPositions(): Promise<MexcPosition[]> {
    return this.request<MexcPosition[]>("GET", "/api/v1/private/position/open_positions");
  }

  /** Get open position for a specific symbol */
  async getPosition(symbol: string): Promise<MexcPosition | null> {
    const positions = await this.getPositions();
    return positions.find(p => p.symbol === symbol) ?? null;
  }

  // ── Orders ────────────────────────────────────────────────────────

  /** Place a futures order */
  async placeOrder(order: MexcOrder): Promise<{ orderId: string }> {
    return this.request<{ orderId: string }>("POST", "/api/v1/private/order/submit", order);
  }

  /** Cancel an order */
  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    await this.request("DELETE", "/api/v1/private/order/cancel", { symbol, orderId });
  }

  /** Close a position at market price */
  async closePosition(symbol: string, positionType: 1 | 2, vol: number): Promise<{ orderId: string }> {
    // To close: if LONG (positionType=1) → SELL (side=4), if SHORT (positionType=2) → BUY (side=3)
    const side = positionType === 1 ? 4 : 3;
    return this.request<{ orderId: string }>("POST", "/api/v1/private/order/submit", {
      symbol,
      side,
      openType: 2,  // cross margin
      type: 5,      // market
      vol,
    });
  }

  /** Set Stop Loss and Take Profit on an open position */
  async setTpSl(symbol: string, positionId: string, stopLossPrice: number, takeProfitPrice: number): Promise<void> {
    await this.request("POST", "/api/v1/private/position/change_risk_level", {
      positionId,
      stopLossPrice,
      takeProfitPrice,
    });
  }

  // ── Market data (no auth needed but use same base) ────────────────

  /** Get contract info — used to determine min lot size, price precision */
  async getContractInfo(symbol: string): Promise<{
    symbol: string;
    minVol: number;
    volUnit: number;
    contractSize: number;
    pricePrecision: number;
  }> {
    const res = await fetch(`${BASE_URL}/api/v1/contract/detail?symbol=${symbol}`);
    const data = await res.json() as any;
    return data.data;
  }

  /** Calculate number of contracts for a given USD position size */
  async calcContractVol(symbol: string, positionSizeUsd: number, entryPrice: number): Promise<number> {
    try {
      const info = await this.getContractInfo(symbol);
      // vol = positionSizeUsd / (contractSize × entryPrice)
      const raw = positionSizeUsd / (info.contractSize * entryPrice);
      const vol = Math.max(info.minVol, Math.floor(raw / info.volUnit) * info.volUnit);
      return vol;
    } catch {
      // Fallback: assume 1 contract = 1 USD (safe minimum)
      return Math.max(1, Math.floor(positionSizeUsd / entryPrice));
    }
  }

  // ── Connection test ───────────────────────────────────────────────

  /** Verify API keys work — returns balance if valid */
  async testConnection(): Promise<{ ok: boolean; balance?: number; error?: string }> {
    try {
      const account = await this.getBalance();
      return { ok: true, balance: account.availableBalance };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}

// ── Singleton factory — built from stored settings ─────────────────

let _client: MexcClient | null = null;

export function getMexcClient(apiKey: string, apiSecret: string): MexcClient {
  if (!_client || _client["apiKey"] !== apiKey) {
    _client = new MexcClient(apiKey, apiSecret);
  }
  return _client;
}

/** Convert bot symbol (e.g. "BTC") to MEXC futures symbol (e.g. "BTC_USDT") */
export function toMexcSymbol(symbol: string): string {
  return `${symbol}_USDT`;
}
