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
import { MEXC_CONTRACT_OVERRIDES } from "./mexc-market";

const BASE_URL = "https://contract.mexc.com";

export interface MexcOrder {
  symbol: string;           // e.g. "BTC_USDT"
  side: 1 | 2 | 3 | 4;     // 1=open long, 2=close short, 3=open short, 4=close long
  openType: 1 | 2;         // 1=isolated, 2=cross
  type: 1 | 2 | 3 | 4 | 5 | 6; // 1=limit, 5=market
  vol: number;              // number of contracts
  leverage?: number;        // 1-200
  price?: number;           // required for limit orders
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

export interface MexcPosition {
  positionId: number;        // MEXC position ID — needed for setTpSl
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

export interface MexcContractInfo {
  symbol?: string;
  minVol: number;
  volUnit: number;
  contractSize: number;
  pricePrecision?: number;
}

export interface MexcStopOrder {
  id: number;
  symbol: string;
  positionId: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  state: number;            // 1=untriggered, 2=cancelled, 3=executed, 4=invalid, 5=failed
  positionType?: 1 | 2;
  vol?: number;
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
  async getPosition(symbol: string, positionType?: 1 | 2): Promise<MexcPosition | null> {
    const positions = await this.getPositions();
    return selectOpenPosition(positions, symbol, positionType);
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
    // MEXC futures: 4 closes long, 2 closes short.
    const side = getCloseOrderSide(positionType);
    return this.request<{ orderId: string }>("POST", "/api/v1/private/order/submit", {
      symbol,
      side,
      openType: 2,  // cross margin
      type: 5,      // market
      vol,
    });
  }

  /** Close part of a position at market price. */
  async closePartialPosition(symbol: string, positionType: 1 | 2, holdVol: number, closePct: number): Promise<{ orderId: string; vol: number }> {
    const info = await this.getContractInfo(symbol).catch(() => null);
    const vol = calcPartialCloseVol(holdVol, closePct, info?.volUnit, info?.minVol);
    if (vol <= 0) throw new Error("Partial close volume must be positive");
    const order = await this.closePosition(symbol, positionType, vol);
    return { ...order, vol };
  }

  /** Get active stop-limit/TP-SL orders. */
  async getStopOrders(symbol?: string): Promise<MexcStopOrder[]> {
    return this.request<MexcStopOrder[]>("GET", "/api/v1/private/stoporder/list/orders", {
      ...(symbol ? { symbol } : {}),
      is_finished: 0,
      page_num: 1,
      page_size: 100,
    });
  }

  /** Change Stop Loss and Take Profit on an existing position stop order. */
  async changeStopPlanPrice(stopPlanOrderId: number, stopLossPrice: number, takeProfitPrice: number): Promise<void> {
    await this.request("POST", "/api/v1/private/stoporder/change_plan_price", {
      stopPlanOrderId,
      stopLossPrice,
      takeProfitPrice,
    });
  }

  /** Set Stop Loss and Take Profit on an open position. */
  async setTpSl(symbol: string, positionId: string, stopLossPrice: number, takeProfitPrice: number): Promise<void> {
    const stopOrder = selectActiveStopOrder(await this.getStopOrders(symbol), symbol, Number(positionId));
    if (!stopOrder) throw new Error(`No active MEXC TP/SL stop order found for ${symbol} position ${positionId}`);
    await this.changeStopPlanPrice(stopOrder.id, stopLossPrice, takeProfitPrice);
  }

  // ── Market data (no auth needed but use same base) ────────────────

  /** Get contract info — used to determine min lot size, price precision */
  async getContractInfo(symbol: string): Promise<MexcContractInfo> {
    const res = await fetch(`${BASE_URL}/api/v1/contract/detail?symbol=${symbol}`);
    const data = await res.json() as any;
    return data.data;
  }

  /** Calculate number of contracts for a given USD position size */
  async calcContractVol(symbol: string, positionSizeUsd: number, entryPrice: number): Promise<number> {
    const info = await this.getContractInfo(symbol);
      // vol = positionSizeUsd / (contractSize × entryPrice)
    return calcContractVolFromInfo(info, positionSizeUsd, entryPrice);
  }

  /** Calculate USD notional for an existing futures contract volume */
  async calcPositionNotional(symbol: string, vol: number, entryPrice: number): Promise<number> {
    const info = await this.getContractInfo(symbol);
    return calcContractNotional(vol, info.contractSize, entryPrice);
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
  if (!_client || _client["apiKey"] !== apiKey || _client["apiSecret"] !== apiSecret) {
    _client = new MexcClient(apiKey, apiSecret);
  }
  return _client;
}

/** Convert bot symbol (e.g. "BTC") to MEXC futures symbol (e.g. "BTC_USDT") */
export function toMexcSymbol(symbol: string): string {
  return MEXC_CONTRACT_OVERRIDES[symbol] ?? `${symbol}_USDT`;
}

export function getOpenOrderSide(direction: "LONG" | "SHORT"): 1 | 3 {
  return direction === "LONG" ? 1 : 3;
}

export function getCloseOrderSide(positionType: 1 | 2): 4 | 2 {
  return positionType === 1 ? 4 : 2;
}

export function calcContractNotional(vol: number, contractSize: number, entryPrice: number): number {
  return vol * contractSize * entryPrice;
}

export function calcContractVolFromInfo(
  info: Pick<MexcContractInfo, "minVol" | "volUnit" | "contractSize">,
  positionSizeUsd: number,
  entryPrice: number,
): number {
  if (
    info.minVol <= 0 ||
    info.volUnit <= 0 ||
    info.contractSize <= 0 ||
    positionSizeUsd <= 0 ||
    entryPrice <= 0
  ) {
    throw new Error("Invalid MEXC contract metadata for volume calculation");
  }

  const raw = positionSizeUsd / (info.contractSize * entryPrice);
  const rounded = Math.floor(raw / info.volUnit) * info.volUnit;
  const vol = Math.max(info.minVol, rounded);
  return Math.round((Math.round(vol / info.volUnit) * info.volUnit) * 1e12) / 1e12;
}

export function calcPartialCloseVol(holdVol: number, closePct: number, volUnit = 1, minVol = 1): number {
  if (holdVol <= 0 || closePct <= 0) return 0;
  if (holdVol <= minVol) return holdVol;

  const unit = volUnit > 0 ? volUnit : 1;
  const raw = holdVol * closePct;
  const rounded = Math.floor(raw / unit) * unit;
  const minAllowed = Math.min(minVol, holdVol);
  const vol = Math.max(minAllowed, rounded);

  return Math.min(holdVol, Math.round(vol / unit) * unit);
}

export function selectActiveStopOrder(stopOrders: MexcStopOrder[], symbol: string, positionId: number): MexcStopOrder | null {
  return stopOrders.find(o =>
    o.symbol === symbol &&
    o.positionId === positionId &&
    o.state === 1
  ) ?? null;
}

export function selectOpenPosition(positions: MexcPosition[], symbol: string, positionType?: 1 | 2): MexcPosition | null {
  return positions.find(p =>
    p.symbol === symbol &&
    p.holdVol > 0 &&
    (positionType == null || p.positionType === positionType)
  ) ?? null;
}
