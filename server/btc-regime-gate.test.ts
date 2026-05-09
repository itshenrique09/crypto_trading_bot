import test from "node:test";
import assert from "node:assert/strict";
import { classifyBtcRegime, defaultBtcContext } from "./btc-regime-gate";

test("risk_on: BTC weekly up + daily up → maxOpen 6", () => {
  const ctx = classifyBtcRegime({ daily: "up", weekly: "up" });
  assert.equal(ctx.regime, "risk_on");
  assert.equal(ctx.maxOpen, 6);
});

test("risk_off: BTC weekly down + daily down → maxOpen 2", () => {
  const ctx = classifyBtcRegime({ daily: "down", weekly: "down" });
  assert.equal(ctx.regime, "risk_off");
  assert.equal(ctx.maxOpen, 2);
});

test("volatile_drift: BTC weekly down + daily up → maxOpen 3 (possible bull-trap)", () => {
  const ctx = classifyBtcRegime({ daily: "up", weekly: "down" });
  assert.equal(ctx.regime, "volatile_drift");
  assert.equal(ctx.maxOpen, 3);
  assert.match(ctx.reason, /bull-trap/);
});

test("neutral_bearish: weekly up + daily down → maxOpen 4 (daily warning)", () => {
  const ctx = classifyBtcRegime({ daily: "down", weekly: "up" });
  assert.equal(ctx.regime, "neutral_bearish");
  assert.equal(ctx.maxOpen, 4);
});

test("neutral_bearish: weekly down + daily neutral → maxOpen 4", () => {
  const ctx = classifyBtcRegime({ daily: "neutral", weekly: "down" });
  assert.equal(ctx.regime, "neutral_bearish");
  assert.equal(ctx.maxOpen, 4);
});

test("neutral_bearish: weekly neutral + daily down → maxOpen 4", () => {
  const ctx = classifyBtcRegime({ daily: "down", weekly: "neutral" });
  assert.equal(ctx.regime, "neutral_bearish");
  assert.equal(ctx.maxOpen, 4);
});

test("neutral_bullish: weekly up + daily neutral → maxOpen 5", () => {
  const ctx = classifyBtcRegime({ daily: "neutral", weekly: "up" });
  assert.equal(ctx.regime, "neutral_bullish");
  assert.equal(ctx.maxOpen, 5);
});

test("neutral_bullish: all neutral → maxOpen 5", () => {
  const ctx = classifyBtcRegime({ daily: "neutral", weekly: "neutral" });
  assert.equal(ctx.regime, "neutral_bullish");
  assert.equal(ctx.maxOpen, 5);
});

test("neutral_bullish: daily up + weekly neutral → maxOpen 5", () => {
  const ctx = classifyBtcRegime({ daily: "up", weekly: "neutral" });
  assert.equal(ctx.regime, "neutral_bullish");
  assert.equal(ctx.maxOpen, 5);
});

test("defaultBtcContext preserves the prior maxOpen=6 behaviour", () => {
  const ctx = defaultBtcContext();
  assert.equal(ctx.maxOpen, 6);
  assert.equal(ctx.regime, "neutral_bullish");
});

test("regime is monotonic: risk-off has the lowest maxOpen, risk-on the highest", () => {
  const all = [
    classifyBtcRegime({ daily: "up",      weekly: "up"      }).maxOpen,
    classifyBtcRegime({ daily: "neutral", weekly: "up"      }).maxOpen,
    classifyBtcRegime({ daily: "up",      weekly: "neutral" }).maxOpen,
    classifyBtcRegime({ daily: "neutral", weekly: "neutral" }).maxOpen,
    classifyBtcRegime({ daily: "down",    weekly: "up"      }).maxOpen,
    classifyBtcRegime({ daily: "down",    weekly: "neutral" }).maxOpen,
    classifyBtcRegime({ daily: "neutral", weekly: "down"    }).maxOpen,
    classifyBtcRegime({ daily: "up",      weekly: "down"    }).maxOpen,
    classifyBtcRegime({ daily: "down",    weekly: "down"    }).maxOpen,
  ];
  // Risk-on must yield the most exposure
  assert.equal(Math.max(...all), 6);
  // Risk-off must yield the least
  assert.equal(Math.min(...all), 2);
  // No regime should produce a maxOpen < 2 or > 6 (sanity)
  for (const m of all) {
    assert.ok(m >= 2 && m <= 6, `unexpected maxOpen=${m}`);
  }
});
