#!/usr/bin/env node
/* Run: node tests/srs.test.js */
const assert = require("assert");
const srs = require("../assets/srs.js");

const DAY = 86400000;
const now = Date.UTC(2026, 10, 22, 8, 0, 0);

function fresh() { return srs.newCard("test"); }
function at(card, t) { return srs.schedule(card, 3, t, { retention: 0.9 }); }

// 1. new -> Good graduates to a review card around 2 days
let card = fresh();
let res = srs.schedule(card, 3, now, { retention: 0.9 });
assert.strictEqual(res.card.state, "review");
assert.ok(res.card.s > 2 && res.card.s < 3, `initial stability ${res.card.s}`);
assert.ok(res.interval >= 1.5 * DAY && res.interval <= 2.5 * DAY, `initial interval ${res.interval / DAY}`);

// 2. intervals are ordered Again < Hard < Good < Easy on a review card
card = srs.schedule(fresh(), 3, now, { retention: 0.9 }).card;
const preview = srs.preview(card, now + 3 * DAY, { retention: 0.9 });
assert.strictEqual(preview.length, 4);
assert.ok(preview[0].interval <= preview[1].interval);
assert.ok(preview[1].interval <= preview[2].interval);
assert.ok(preview[2].interval <= preview[3].interval);

// 3. a successful review grows stability and the next interval
res = srs.schedule(card, 3, now + 3 * DAY, { retention: 0.9 });
assert.ok(res.card.s > card.s, `${res.card.s} should exceed ${card.s}`);
assert.ok(res.interval > 2 * DAY);

// 4. a lapse goes to relearning with a 10-minute step
res = srs.schedule(card, 1, now + 3 * DAY, { retention: 0.9 });
assert.strictEqual(res.card.state, "relearning");
assert.strictEqual(res.interval, 10 * 60 * 1000);

// 5. higher desired retention shortens intervals
const low = srs.schedule(card, 3, now + 3 * DAY, { retention: 0.85 });
const high = srs.schedule(card, 4, now + 3 * DAY, { retention: 0.97 });
assert.ok(high.interval < low.interval, `${high.interval} < ${low.interval}`);

// 6. long good-streak remains finite and monotone
card = fresh();
let t = now;
let prevInterval = 0;
for (let i = 0; i < 12; i += 1) {
  const next = srs.schedule(card, 3, t, { retention: 0.9 });
  const interval = next.interval / DAY;
  assert.ok(Number.isFinite(interval) && interval >= 1, `interval ${interval}`);
  assert.ok(interval >= prevInterval - 1, `interval should not collapse: ${interval} < ${prevInterval}`);
  prevInterval = interval;
  card = next.card;
  t = card.due;
}
assert.ok(card.s > 0 && card.s <= 36500);

// 7. mastery labels move with stability
assert.strictEqual(srs.mastery(fresh()), 0);
assert.strictEqual(srs.mastery({ state: "learning", s: 0.2 }), 1);
assert.strictEqual(srs.mastery({ state: "review", s: 3 }), 2);
assert.strictEqual(srs.mastery({ state: "review", s: 10 }), 3);
assert.strictEqual(srs.mastery({ state: "review", s: 30 }), 4);
assert.strictEqual(srs.mastery({ state: "review", s: 90 }), 5);

console.log("srs.test.js: all assertions passed");
