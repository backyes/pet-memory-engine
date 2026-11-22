/* 词脉 · FSRS-6 scheduler
 * Memory model: stability / difficulty / retrievability.
 * Default weights are the published FSRS-6 defaults; learning steps are
 * handled explicitly so the UI stays predictable.
 */
(function (global) {
  "use strict";

  const DAY = 86400000;
  const MIN = 60000;
  const MAX_S = 36500;
  const MIN_S = 0.001;

  // FSRS-6 default weights (open-spaced-repetition)
  const W = [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
    1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
    1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
  ];

  const DECAY = -W[20];
  const FACTOR = Math.exp(Math.log(0.9) / DECAY) - 1;

  const GRADES = {
    1: { key: "again", label: "忘记", short: "忘记" },
    2: { key: "hard", label: "模糊", short: "模糊" },
    3: { key: "good", label: "记得", short: "记得" },
    4: { key: "easy", label: "简单", short: "简单" },
  };

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const round = (n, p = 8) => {
    const f = Math.pow(10, p);
    return Math.round(n * f) / f;
  };

  function forgettingCurve(elapsedDays, stability) {
    if (!stability || stability <= 0) return 0;
    const t = Math.max(0, elapsedDays);
    return Math.pow(1 + (FACTOR * t) / stability, DECAY);
  }

  function retrievability(card, now) {
    if (!card || card.state === "new" || !card.s || !card.last) return null;
    return forgettingCurve(Math.max(0, (now - card.last) / DAY), card.s);
  }

  function initStability(g) {
    return clamp(W[g - 1], MIN_S, MAX_S);
  }

  function initDifficulty(g) {
    return round(clamp(W[4] - Math.exp((g - 1) * W[5]) + 1, 1, 10));
  }

  function meanReversion(init, current) {
    return round(W[7] * init + (1 - W[7]) * current);
  }

  function nextDifficulty(d, g) {
    const delta = -W[6] * (g - 3);
    const damped = delta * ((10 - d) / 9);
    return round(clamp(meanReversion(initDifficulty(4), d + damped), 1, 10));
  }

  function nextRecallStability(d, s, r, g) {
    const hardPenalty = g === 2 ? W[15] : 1;
    const easyBonus = g === 4 ? W[16] : 1;
    const next =
      s *
      (1 +
        Math.exp(W[8]) *
          (11 - d) *
          Math.pow(s, -W[9]) *
          (Math.exp((1 - r) * W[10]) - 1) *
          hardPenalty *
          easyBonus);
    return round(clamp(next, MIN_S, MAX_S));
  }

  function nextForgetStability(d, s, r) {
    const next =
      W[11] *
      Math.pow(d, -W[12]) *
      (Math.pow(s + 1, W[13]) - 1) *
      Math.exp((1 - r) * W[14]);
    return round(clamp(next, MIN_S, MAX_S));
  }

  function nextShortTermStability(s, g) {
    const sinc = Math.pow(s, -W[19]) * Math.exp(W[17] * (g - 3 + W[18]));
    const masked = g >= 2 ? Math.max(sinc, 1) : sinc;
    return round(clamp(s * masked, MIN_S, MAX_S));
  }

  function intervalDays(stability, retention) {
    const desired = clamp(retention || 0.9, 0.75, 0.97);
    const days = (stability / FACTOR) * (Math.pow(desired, 1 / DECAY) - 1);
    return Math.max(1, Math.min(3650, Math.round(days)));
  }

  function newCard(word) {
    return {
      w: word,
      state: "new",
      due: 0,
      s: 0,
      d: 0,
      reps: 0,
      lapses: 0,
      last: 0,
      step: 0,
      flagged: false,
      history: [],
    };
  }

  function clone(card) {
    return Object.assign({}, card, { history: (card.history || []).slice() });
  }

  function schedule(card, grade, now, opts) {
    const o = opts || {};
    const retention = o.retention || 0.9;
    const next = clone(card || newCard());
    const prevLast = next.last || 0;
    next.reps = (next.reps || 0) + 1;
    next.last = now;
    let interval = 0;
    let phase = "review";

    if (next.state === "new") {
      if (grade === 1) {
        next.state = "learning";
        next.step = 0;
        next.s = initStability(1);
        next.d = initDifficulty(1);
        next.due = now + 1 * MIN;
        interval = 1 * MIN;
        phase = "learning";
      } else if (grade === 2) {
        next.state = "learning";
        next.step = 0;
        next.s = initStability(2);
        next.d = initDifficulty(2);
        next.due = now + 5 * MIN;
        interval = 5 * MIN;
        phase = "learning";
      } else {
        next.state = "review";
        next.s = initStability(grade);
        next.d = initDifficulty(grade);
        next.due = now + intervalDays(next.s, retention) * DAY;
        interval = next.due - now;
      }
      next.flagged = next.flagged || false;
      if (grade === 1) next.lapses = (next.lapses || 0) + 1;
    } else if (next.state === "learning" || next.state === "relearning") {
      const shortStep = next.state === "relearning" ? 10 : 5;
      if (grade === 1) {
        next.step = 0;
        next.due = now + 1 * MIN;
        interval = 1 * MIN;
        phase = "learning";
      } else if (grade === 2) {
        next.due = now + shortStep * MIN;
        interval = shortStep * MIN;
        phase = "learning";
      } else {
        next.state = "review";
        next.step = 0;
        next.s = nextShortTermStability(next.s || initStability(1), grade);
        next.d = nextDifficulty(next.d || initDifficulty(grade), grade);
        next.due = now + intervalDays(next.s, retention) * DAY;
        interval = next.due - now;
        if (grade === 1) next.lapses = (next.lapses || 0) + 1;
      }
    } else {
      const elapsed = prevLast ? Math.max(0, (now - prevLast) / DAY) : 0;
      const r = forgettingCurve(elapsed, next.s);
      if (grade === 1) {
        next.state = "relearning";
        next.step = 0;
        next.lapses = (next.lapses || 0) + 1;
        next.s = nextForgetStability(next.d, next.s, r);
        next.d = nextDifficulty(next.d, 1);
        next.due = now + 10 * MIN;
        interval = 10 * MIN;
        phase = "learning";
      } else {
        next.s = nextRecallStability(next.d, next.s, r, grade);
        next.d = nextDifficulty(next.d, grade);
        next.due = now + intervalDays(next.s, retention) * DAY;
        interval = next.due - now;
      }
    }

    next.history = (next.history || []).concat({
      t: now,
      g: grade,
      s: round(next.s),
      d: round(next.d),
      i: Math.round(interval / DAY),
    });
    if (next.history.length > 20) next.history = next.history.slice(-20);
    return { card: next, interval, phase, retrievability: retrievability(card, now) };
  }

  function preview(card, now, opts) {
    const base = card || newCard();
    const out = [];
    for (let g = 1; g <= 4; g += 1) {
      const res = schedule(base, g, now, opts);
      out.push({
        grade: g,
        label: GRADES[g].label,
        state: res.card.state,
        s: res.card.s,
        d: res.card.d,
        interval: res.interval,
        due: res.card.due,
      });
    }
    return out;
  }

  function mastery(card) {
    if (!card || card.state === "new") return 0;
    if (card.state === "learning" || card.state === "relearning") return 1;
    const s = card.s || 0;
    if (s < 2) return 1;
    if (s < 7) return 2;
    if (s < 21) return 3;
    if (s < 60) return 4;
    return 5;
  }

  const MASTERY = [
    { level: 0, label: "新词" },
    { level: 1, label: "初见" },
    { level: 2, label: "熟悉" },
    { level: 3, label: "记住" },
    { level: 4, label: "牢固" },
    { level: 5, label: "长驻" },
  ];

  function isDue(card, now) {
    return !!card && card.state !== "new" && card.due <= now;
  }

  function isMastered(card) {
    return !!card && card.state === "review" && (card.s || 0) >= 21;
  }

  global.PET = global.PET || {};
  global.PET.srs = {
    DAY,
    MIN,
    W,
    GRADES,
    MASTERY,
    newCard,
    clone,
    schedule,
    preview,
    retrievability,
    intervalDays,
    mastery,
    isDue,
    isMastered,
    forgettingCurve,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.PET.srs;
  }
})(typeof window !== "undefined" ? window : globalThis);
