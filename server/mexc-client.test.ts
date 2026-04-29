import test from "node:test";
import assert from "node:assert/strict";
import {
  calcContractNotional,
  calcContractVolFromInfo,
  calcPartialCloseVol,
  getCloseOrderSide,
  getMexcClient,
  getOpenOrderSide,
  selectOpenPosition,
  selectActiveStopOrder,
} from "./mexc-client";

test("maps bot directions to MEXC open-order sides", () => {
  assert.equal(getOpenOrderSide("LONG"), 1);
  assert.equal(getOpenOrderSide("SHORT"), 3);
});

test("maps MEXC position types to close-order sides", () => {
  assert.equal(getCloseOrderSide(1), 4);
  assert.equal(getCloseOrderSide(2), 2);
});

test("calculates futures notional from contracts, contract size, and price", () => {
  assert.equal(calcContractNotional(25, 0.001, 50_000), 1_250);
});

test("calculates contract volume from MEXC contract metadata", () => {
  assert.equal(calcContractVolFromInfo({ minVol: 1, volUnit: 1, contractSize: 0.001 }, 1_250, 50_000), 25);
  assert.equal(calcContractVolFromInfo({ minVol: 0.1, volUnit: 0.1, contractSize: 1 }, 125, 100), 1.2);
});

test("rejects invalid contract metadata for volume calculation", () => {
  assert.throws(
    () => calcContractVolFromInfo({ minVol: 1, volUnit: 0, contractSize: 1 }, 100, 10),
    /Invalid MEXC contract metadata/,
  );
});

test("calculates a safe partial-close contract volume", () => {
  assert.equal(calcPartialCloseVol(25, 0.6), 15);
  assert.equal(calcPartialCloseVol(25, 0.01), 1);
  assert.equal(calcPartialCloseVol(1, 0.6), 1);
  assert.equal(calcPartialCloseVol(0, 0.6), 0);
  assert.equal(calcPartialCloseVol(0.5, 0.6), 0.5);
  assert.equal(calcPartialCloseVol(2.5, 0.6, 0.1, 0.1), 1.5);
});

test("selects the active stop order for a position", () => {
  const selected = selectActiveStopOrder([
    { id: 11, symbol: "BTC_USDT", positionId: 5, state: 2 },
    { id: 12, symbol: "BTC_USDT", positionId: 5, state: 1 },
    { id: 13, symbol: "ETH_USDT", positionId: 5, state: 1 },
  ], "BTC_USDT", 5);

  assert.equal(selected?.id, 12);
});

test("selects open position by symbol and side", () => {
  const selected = selectOpenPosition([
    { symbol: "BTC_USDT", positionType: 1, holdVol: 0, positionId: 1, openAvgPrice: 100, closeAvgPrice: 0, realised: 0, unrealised: 0, leverage: 5, im: 1 },
    { symbol: "BTC_USDT", positionType: 2, holdVol: 3, positionId: 2, openAvgPrice: 99, closeAvgPrice: 0, realised: 0, unrealised: 0, leverage: 5, im: 1 },
    { symbol: "BTC_USDT", positionType: 1, holdVol: 4, positionId: 3, openAvgPrice: 101, closeAvgPrice: 0, realised: 0, unrealised: 0, leverage: 5, im: 1 },
  ], "BTC_USDT", 1);

  assert.equal(selected?.positionId, 3);
});

test("recreates singleton client when API secret changes for the same key", () => {
  const first = getMexcClient("same-key", "old-secret");
  const second = getMexcClient("same-key", "new-secret");

  assert.notEqual(first, second);
});
