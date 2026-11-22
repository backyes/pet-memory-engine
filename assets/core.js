/* 词脉 · data layer: persistence, daily stats, queue building, text helpers */
(function (global) {
  "use strict";

  const srs = global.PET.srs;
  const DAY = 86400000;
  const STORE_KEY = "cimai.pet.v1";
  const VERSION = 1;

  const DEFAULT_SETTINGS = {
    newPerDay: 12,
    dailyGoal: 24,
    retention: 0.9,
    scope: "core",
    mixed: true,
    autoplay: true,
    sound: true,
    theme: "auto",
    sessionCap: 50,
  };

  // Official Cambridge topics → the scene that should catch the word by default.
  const TOPIC_DEFAULT = {
    "food-and-drink": "kitchen",
    "travel-and-transport": "transport",
    "house-and-home": "home",
    education: "campus",
    sport: "fitness",
    "health-medicine-and-exercise": "health",
    "work-and-jobs": "work",
    "communications-and-technology": "tech",
    "entertainment-and-media": "media",
    "personal-feelings-opinions-and-experiences": "feelings",
    shopping: "shopping",
    "clothes-and-accessories": "clothes",
    "the-natural-world": "nature",
    weather: "weather",
    environment: "environment",
    "places-town-and-city": "city",
    "places-buildings": "city",
    services: "city",
    "places-countryside": "nature",
    "hobbies-and-leisure": "hobbies",
    language: "campus",
  };

  // Keyword hits beat topic defaults; on a tie, the more specific scene wins.
  const SCENE_PRIORITY = {
    airport: 100, restaurant: 95, exam: 92, chores: 88, hotel: 86,
    holiday: 84, fitness: 82, environment: 80, weather: 78, clothes: 76,
    shopping: 74, tech: 72, media: 70, culture: 68, city: 66,
    nature: 64, feelings: 62, social: 60, work: 58, health: 56,
    home: 54, campus: 52, transport: 50, kitchen: 48, emergency: 46,
    hobbies: 44,
  };

  const SCOPES = {
    core: { label: "21 天核心", note: "1,245 词", test: (w) => w.core },
    pet: { label: "PET 新增", note: "1,579 词", test: (w) => !w.ket },
    all: { label: "全部词库", note: "3,283 词", test: () => true },
  };

  const MASTERY_LABELS = ["新词", "初见", "熟悉", "记住", "牢固", "长驻"];
  const THEME_LABELS = {
    daily: "日常", food: "饮食", travel: "出行", school: "学习",
    health: "健康", nature: "自然", feelings: "情绪", tech: "科技",
    sport: "运动", city: "城市", culture: "文化", people: "人际", shopping: "购物",
  };

  const state = {
    data: null,
    words: [],
    byWord: new Map(),
    db: null,
    saveTimer: 0,
    memoryOnly: false,
  };

  // ---------- generic helpers ----------
  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeReg(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, seed) {
    const rng = mulberry32(seed || Date.now());
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function dayKey(ts) {
    const d = new Date(ts == null ? Date.now() : ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function startOfDay(ts) {
    const d = new Date(ts == null ? Date.now() : ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function addDays(ts, n) {
    const d = new Date(ts);
    d.setDate(d.getDate() + n);
    return d.getTime();
  }

  function dateLabelCN(ts) {
    const d = new Date(ts);
    const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    return {
      md: `${d.getMonth() + 1} 月 ${d.getDate()} 日`,
      week: `周${week}`,
      full: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`,
      short: `${d.getMonth() + 1}.${d.getDate()}`,
      ymd: dayKey(ts),
    };
  }

  function greeting(ts) {
    const h = new Date(ts == null ? Date.now() : ts).getHours();
    if (h < 5) return "夜深了";
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }

  function formatDuration(ms) {
    if (!ms || ms < 0) return "0 分钟";
    const mins = Math.round(ms / 60000);
    if (mins < 1) return "不到 1 分钟";
    if (mins < 60) return `${mins} 分钟`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
  }

  function formatInterval(ms) {
    if (!ms || ms <= 0) return "现在";
    if (ms < 3600000) {
      const m = Math.max(1, Math.round(ms / 60000));
      return `${m} 分钟`;
    }
    if (ms < DAY * 1.5) return "1 天";
    const days = Math.round(ms / DAY);
    if (days < 30) return `${days} 天`;
    if (days < 365) {
      const months = Math.round(days / 30);
      return `${months} 个月`;
    }
    const years = Math.round(days / 365 * 10) / 10;
    return `${years} 年`;
  }

  function dueLabel(ts, now) {
    const base = now == null ? Date.now() : now;
    if (!ts) return "未安排";
    if (ts <= base) return "现在";
    const today = startOfDay(base);
    const target = startOfDay(ts);
    const diff = Math.round((target - today) / DAY);
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    if (diff < 7) return `${diff} 天后`;
    const d = dateLabelCN(ts);
    return `${d.md}`;
  }

  function plural(n, unit) {
    return `${n} ${unit}`;
  }

  function escapeWord(word) {
    return esc(word);
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  function spellable(entry) {
    return /^[a-zA-Z][a-zA-Z' -]*$/.test(entry.w) && entry.w.length <= 22;
  }

  function clozeAvailable(entry) {
    return Boolean(entry.exb && entry.exb.indexOf("___") !== -1);
  }

  function themeLabel(id) {
    return THEME_LABELS[id] || "综合";
  }

  function masteryLabel(level) {
    return MASTERY_LABELS[level] || "新词";
  }

  function highlightExample(entry) {
    const ex = entry.ex || "";
    if (!ex) return "";
    const forms = (entry.forms || [entry.w]).filter(Boolean).map(escapeReg);
    if (!forms.length) return esc(ex);
    const re = new RegExp(`(?<![A-Za-z])(${forms.join("|")})(?![A-Za-z])`, "gi");
    let out = "";
    let last = 0;
    ex.replace(re, (match, _g, offset) => {
      out += esc(ex.slice(last, offset));
      out += `<mark>${esc(match)}</mark>`;
      last = offset + match.length;
      return match;
    });
    out += esc(ex.slice(last));
    return out;
  }

  function clozeText(entry) {
    return esc(entry.exb || "");
  }

  // ---------- data ----------
  function initData() {
    const payload = global.PET_DATA;
    if (!payload || !Array.isArray(payload.words)) {
      throw new Error("词库 data.js 未加载");
    }
    state.data = payload;
    state.words = payload.words;
    state.byWord = new Map(payload.words.map((w) => [w.w, w]));
    state.byWordLower = new Map(payload.words.map((w) => [w.w.toLowerCase(), w]));
    state.themeCounts = payload.meta.themes || {};
    state.sceneById = new Map((global.PET_SCENES || []).map((s) => [s.id, s]));
    assignScenes();
    state.scopeCounts = {
      core: payload.words.filter((w) => w.core).length,
      pet: payload.words.filter((w) => !w.ket).length,
      all: payload.words.length,
    };
  }

  function word(term) {
    return state.byWord.get(term) || state.byWordLower.get(String(term || "").toLowerCase()) || null;
  }

  function words() {
    return state.words;
  }

  function meta() {
    return state.data ? state.data.meta : {};
  }

  function scopeWords(scope) {
    const def = SCOPES[scope] || SCOPES.core;
    return state.words.filter(def.test);
  }

  function scopeLabel(scope) {
    return (SCOPES[scope] || SCOPES.core).label;
  }

  // ---------- scene assignment ----------
  const CJK = /[\u4e00-\u9fff]/;

  function prepareScenes() {
    (global.PET_SCENES || []).forEach((scene) => {
      scene.anchorSet = new Set(scene.anchors);
      scene.kwEn = new Set();
      scene.kwZh = [];
      (scene.keywords || []).forEach((k) => {
        const keyword = String(k).toLowerCase();
        if (CJK.test(keyword)) scene.kwZh.push(keyword);
        else scene.kwEn.add(keyword);
      });
      scene.topicSet = new Set(scene.topics || []);
    });
  }

  function sceneScore(entry, scene) {
    let score = 0;
    if (scene.anchorSet.has(entry.w)) score += 1000;
    const topics = entry.topics || [];
    for (let i = 0; i < topics.length; i += 1) {
      if (TOPIC_DEFAULT[topics[i]] === scene.id) score += 10;
    }
    if (scene.kwEn.has(entry.w.toLowerCase())) score += 30;
    const zh = entry.zh || "";
    for (let i = 0; i < scene.kwZh.length; i += 1) {
      if (zh.includes(scene.kwZh[i])) score += 8;
    }
    if (entry.theme === scene.theme) score += 1;
    return score;
  }

  function assignScenes() {
    if (!global.PET_SCENES) return;
    prepareScenes();
    const scenes = global.PET_SCENES;
    const byScene = new Map(scenes.map((s) => [s.id, []]));
    let assigned = 0;
    let coreAssigned = 0;
    state.words.forEach((entry) => {
      let best = null;
      let bestScore = 0;
      for (let i = 0; i < scenes.length; i += 1) {
        const scene = scenes[i];
        const score = sceneScore(entry, scene);
        if (
          score > bestScore ||
          (score === bestScore && score > 0 && best &&
            (SCENE_PRIORITY[scene.id] || 0) > (SCENE_PRIORITY[best.id] || 0))
        ) {
          best = scene;
          bestScore = score;
        }
      }
      if (best && bestScore >= 8) {
        entry.scene = best.id;
        entry.sceneScore = bestScore;
        byScene.get(best.id).push(entry);
        assigned += 1;
        if (entry.core) coreAssigned += 1;
      } else {
        entry.scene = null;
        entry.sceneScore = 0;
      }
    });
    // sort each scene: anchors in chain order, then strongest first
    byScene.forEach((list, id) => {
      const scene = state.sceneById.get(id);
      const anchorOrder = new Map((scene.anchors || []).map((w, i) => [w, i]));
      list.sort((a, b) => {
        const ai = anchorOrder.has(a.w) ? anchorOrder.get(a.w) : 999;
        const bi = anchorOrder.has(b.w) ? anchorOrder.get(b.w) : 999;
        if (ai !== bi) return ai - bi;
        if (a.sceneScore !== b.sceneScore) return b.sceneScore - a.sceneScore;
        if (a.core !== b.core) return a.core ? -1 : 1;
        return a.w.localeCompare(b.w);
      });
    });
    state.wordsByScene = byScene;
    state.sceneAnchorSet = new Set(scenes.flatMap((scene) => scene.anchors || []));
    state.sceneCoverage = coreAssigned;
    state.sceneAssignedAll = assigned;
  }

  function scenes() {
    return global.PET_SCENES || [];
  }

  function scene(id) {
    return state.sceneById.get(id) || null;
  }

  function sceneWords(id) {
    return (state.wordsByScene && state.wordsByScene.get(id)) || [];
  }

  function sceneStrongWords(id) {
    const scene = state.sceneById.get(id);
    if (!scene) return [];
    const anchorSet = new Set(scene.anchors);
    return sceneWords(id).filter((w) => anchorSet.has(w.w) || (w.sceneScore || 0) >= 30);
  }

  function sceneStats(id) {
    const scene = state.sceneById.get(id);
    if (!scene) return null;
    const anchors = scene.anchors.map((term) => {
      const card = getCard(term);
      return { term, entry: word(term), card, learned: card.state !== "new", mastered: srs.isMastered(card), due: srs.isDue(card, Date.now()) };
    });
    const learned = anchors.filter((a) => a.learned).length;
    const mastered = anchors.filter((a) => a.mastered).length;
    const due = anchors.filter((a) => a.due).length;
    const words = sceneWords(id);
    const coreWords = words.filter((w) => w.core);
    return {
      id,
      learned,
      mastered,
      due,
      anchors,
      total: words.length,
      coreTotal: coreWords.length,
      strongTotal: sceneStrongWords(id).length,
      progress: learned / 6,
      done: Boolean(state.db.scenes && state.db.scenes[id]),
    };
  }

  function nextScene(now) {
    const list = scenes();
    const ts = now || Date.now();
    // Finish a scene that was already started before opening a brand-new one.
    for (let i = 0; i < list.length; i += 1) {
      const stats = sceneStats(list[i].id);
      if (stats && stats.learned > 0 && stats.learned < 6) return list[i];
    }
    for (let i = 0; i < list.length; i += 1) {
      const stats = sceneStats(list[i].id);
      if (stats && stats.learned === 0) return list[i];
    }
    return null;
  }

  function scenesByStatus(status) {
    return scenes().filter((s) => {
      const stats = sceneStats(s.id);
      if (status === "new") return stats.learned === 0;
      if (status === "learning") return stats.learned > 0 && stats.learned < 6;
      if (status === "done") return stats.learned === 6;
      return true;
    });
  }

  function markSceneDone(id, result) {
    if (!state.db.scenes) state.db.scenes = {};
    state.db.meta.focusScene = id;
    state.db.scenes[id] = {
      doneAt: Date.now(),
      correct: result.correct || 0,
      total: result.total || 6,
      ms: result.ms || 0,
    };
    state.db.totals.scenes = (state.db.totals.scenes || 0) + 1;
    scheduleSave();
  }

  function sceneDone(id) {
    return Boolean(state.db.scenes && state.db.scenes[id]);
  }

  // ---------- persistence ----------
  function sanitizeSettings(input) {
    const s = Object.assign({}, DEFAULT_SETTINGS, input || {});
    s.newPerDay = clamp(Math.round(Number(s.newPerDay)), 0, 60);
    s.dailyGoal = clamp(Math.round(Number(s.dailyGoal)), 5, 200);
    s.sessionCap = clamp(Math.round(Number(s.sessionCap)), 10, 120);
    s.retention = clamp(Number(s.retention) || 0.9, 0.75, 0.97);
    s.scope = SCOPES[s.scope] ? s.scope : "core";
    s.theme = ["auto", "paper", "night"].includes(s.theme) ? s.theme : "auto";
    s.mixed = Boolean(s.mixed);
    s.autoplay = Boolean(s.autoplay);
    s.sound = Boolean(s.sound);
    return s;
  }

  function blankDb() {
    return {
      version: VERSION,
      created: Date.now(),
      settings: Object.assign({}, DEFAULT_SETTINGS),
      cards: {},
      logs: {},
      sessions: [],
      scenes: {},
      totals: { answered: 0, ok: 0, new: 0, ms: 0, scenes: 0 },
      meta: { lastOpen: 0, focusScene: null },
    };
  }

  function load() {
    let parsed = null;
    try {
      const raw = global.localStorage.getItem(STORE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch (err) {
      state.memoryOnly = true;
      console.warn("localStorage unavailable, progress will not persist", err);
    }
    const db = blankDb();
    if (parsed && typeof parsed === "object") {
      db.created = parsed.created || db.created;
      db.settings = sanitizeSettings(parsed.settings);
      db.cards = parsed.cards && typeof parsed.cards === "object" ? parsed.cards : {};
      db.logs = parsed.logs && typeof parsed.logs === "object" ? parsed.logs : {};
      db.sessions = Array.isArray(parsed.sessions) ? parsed.sessions.slice(-120) : [];
      db.scenes = parsed.scenes && typeof parsed.scenes === "object" ? parsed.scenes : {};
      db.totals = Object.assign(db.totals, parsed.totals || {});
      db.meta = Object.assign(db.meta, parsed.meta || {});
    }
    // repair cards that predate a field
    Object.keys(db.cards).forEach((key) => {
      const card = db.cards[key];
      if (!card || typeof card !== "object") {
        delete db.cards[key];
        return;
      }
      if (!card.state) card.state = "new";
      if (!Array.isArray(card.history)) card.history = [];
      if (typeof card.flagged !== "boolean") card.flagged = false;
    });
    state.db = db;
    db.meta.lastOpen = Date.now();
    saveNow();
    return db;
  }

  function scheduleSave() {
    if (state.memoryOnly) return;
    if (state.saveTimer) return;
    state.saveTimer = global.setTimeout(() => {
      state.saveTimer = 0;
      saveNow();
    }, 120);
  }

  function saveNow() {
    if (state.memoryOnly || !state.db) return;
    state.db.meta.lastOpen = Date.now();
    try {
      global.localStorage.setItem(STORE_KEY, JSON.stringify(state.db));
    } catch (err) {
      state.memoryOnly = true;
      console.warn("save failed", err);
    }
  }

  function db() {
    return state.db;
  }

  function settings() {
    return state.db.settings;
  }

  function updateSettings(patch) {
    Object.assign(state.db.settings, patch);
    saveNow();
    return state.db.settings;
  }

  function getCard(term) {
    const saved = state.db.cards[term];
    if (saved) return saved;
    return srs.newCard(term);
  }

  function ensureCard(term) {
    if (!state.db.cards[term]) state.db.cards[term] = srs.newCard(term);
    return state.db.cards[term];
  }

  function saveCard(card) {
    state.db.cards[card.w] = card;
    scheduleSave();
  }

  function resetWord(term) {
    delete state.db.cards[term];
    saveNow();
  }

  function resetAll() {
    const keepSettings = Object.assign({}, state.db.settings);
    const keepCreated = state.db.created;
    state.db = blankDb();
    state.db.settings = keepSettings;
    state.db.created = keepCreated;
    saveNow();
  }

  function markMastered(term) {
    const now = Date.now();
    const card = ensureCard(term);
    card.state = "review";
    card.reps = Math.max(1, card.reps || 0);
    card.s = 60;
    card.d = 5;
    card.last = now;
    card.due = now + 30 * DAY;
    card.flagged = false;
    card.history = (card.history || []).concat({
      t: now, g: 4, s: card.s, d: card.d, i: 30, manual: true,
    });
    saveCard(card);
    return card;
  }

  function toggleFlag(term) {
    const card = ensureCard(term);
    card.flagged = !card.flagged;
    saveCard(card);
    return card.flagged;
  }

  // ---------- answering ----------
  function answer(term, grade, mode, ms, ok) {
    const now = Date.now();
    const before = getCard(term);
    const wasNew = before.state === "new";
    const res = srs.schedule(before, grade, now, { retention: settings().retention });
    res.card.mode = mode;
    saveCard(res.card);

    const key = dayKey(now);
    const log = state.db.logs[key] || { n: 0, ok: 0, new: 0, rev: 0, ms: 0, modes: {}, newWords: [] };
    log.n += 1;
    if (ok) log.ok += 1;
    if (wasNew) {
      log.new += 1;
      if (!log.newWords) log.newWords = [];
      log.newWords.push(term);
    } else {
      log.rev += 1;
    }
    log.ms += Math.max(0, ms || 0);
    log.modes[mode] = (log.modes[mode] || 0) + 1;
    state.db.logs[key] = log;

    state.db.totals.answered += 1;
    if (ok) state.db.totals.ok += 1;
    if (wasNew) state.db.totals.new += 1;
    state.db.totals.ms += Math.max(0, ms || 0);

    scheduleSave();
    return { card: res.card, result: res, wasNew, ok, grade };
  }

  function recordSession(summary) {
    state.db.sessions.push(summary);
    if (state.db.sessions.length > 120) state.db.sessions = state.db.sessions.slice(-120);
    scheduleSave();
  }

  // ---------- daily stats ----------
  function todayLog(now) {
    return state.db.logs[dayKey(now)] || { n: 0, ok: 0, new: 0, rev: 0, ms: 0, modes: {}, newWords: [] };
  }

  function todayNewWords(now) {
    const log = todayLog(now);
    return (log.newWords || []).map(word).filter(Boolean);
  }

  function dueCards(now) {
    const out = [];
    Object.keys(state.db.cards).forEach((term) => {
      const card = state.db.cards[term];
      if (card.state !== "new" && card.due <= now) out.push(card);
    });
    out.sort((a, b) => {
      if ((b.lapses || 0) !== (a.lapses || 0)) return (b.lapses || 0) - (a.lapses || 0);
      return a.due - b.due;
    });
    return out;
  }

  function trackedCards() {
    return Object.keys(state.db.cards).map((k) => state.db.cards[k]);
  }

  function learnedCards() {
    return trackedCards().filter((c) => c.state !== "new" && (c.reps || 0) > 0);
  }

  function masteredCards() {
    return trackedCards().filter((c) => srs.isMastered(c));
  }

  function newCandidates(scope) {
    const list = scopeWords(scope || settings().scope);
    const seen = new Set();
    return list.filter((entry) => {
      if (seen.has(entry.w)) return false;
      seen.add(entry.w);
      if (state.sceneAnchorSet && state.sceneAnchorSet.has(entry.w)) return false;
      const card = state.db.cards[entry.w];
      return !card || card.state === "new";
    });
  }

  function newRemaining(now, scope) {
    const log = todayLog(now);
    const daily = Math.max(0, settings().newPerDay - (log.new || 0));
    return Math.min(daily, newCandidates(scope).length);
  }

  function pickNew(count, now, scope) {
    if (count <= 0) return [];
    const pool = newCandidates(scope);
    const seed = hashString(`${dayKey(now)}|${scope || settings().scope}|${state.db.created}`);
    const shuffled = shuffle(pool, seed);
    const picked = [];
    // Words from the scene just studied come first: new words keep the scene context.
    const focus = state.db.meta && state.db.meta.focusScene;
    if (focus) {
      const focusWords = shuffled.filter((entry) => entry.scene === focus);
      focusWords.slice(0, count).forEach((entry) => picked.push(entry));
    }
    if (picked.length >= count) return picked;
    const taken = new Set(picked.map((entry) => entry.w));
    // round-robin by theme so the rest of a session interleaves semantic fields
    const buckets = new Map();
    shuffled.forEach((entry) => {
      if (taken.has(entry.w)) return;
      if (!buckets.has(entry.theme)) buckets.set(entry.theme, []);
      buckets.get(entry.theme).push(entry);
    });
    const keys = shuffle(Array.from(buckets.keys()), seed ^ 0x9e3779b9);
    let guard = 0;
    while (picked.length < count && guard < 2000) {
      guard += 1;
      let added = false;
      keys.forEach((key) => {
        if (picked.length >= count) return;
        const bucket = buckets.get(key);
        if (bucket && bucket.length) {
          picked.push(bucket.shift());
          added = true;
        }
      });
      if (!added) break;
    }
    return picked;
  }

  function interleave(reviews, fresh) {
    if (!fresh.length) return reviews.map((c) => ({ w: c.w, kind: c.state === "review" ? "review" : "learning" }));
    if (!reviews.length) return fresh.map((w) => ({ w: w.w, kind: "new" }));
    const out = [];
    let ri = 0;
    let ni = 0;
    let sinceNew = 0;
    while (ri < reviews.length || ni < fresh.length) {
      if (ni < fresh.length && (sinceNew >= 4 || ri >= reviews.length)) {
        out.push({ w: fresh[ni].w, kind: "new" });
        ni += 1;
        sinceNew = 0;
      } else if (ri < reviews.length) {
        const card = reviews[ri];
        out.push({ w: card.w, kind: card.state === "review" ? "review" : "learning" });
        ri += 1;
        sinceNew += 1;
      }
    }
    return out;
  }

  function buildQueue(mode, now) {
    const ts = now || Date.now();
    const cap = Math.max(10, settings().sessionCap || 60);
    if (mode === "free") {
      const seed = hashString(`${dayKey(ts)}|free|${Date.now()}`);
      return shuffle(scopeWords(settings().scope), seed).slice(0, 10).map((w) => ({ w: w.w, kind: "free" }));
    }
    if (mode === "weak") {
      return weakCards(20).map((c) => ({ w: c.w, kind: "review" }));
    }
    const due = dueCards(ts);
    const newCount = mode === "review" ? 0 : newRemaining(ts);
    const newWords = pickNew(Math.min(newCount, cap), ts);
    const reviewCap = Math.max(0, cap - newWords.length);
    const keptReviews = due.slice(0, reviewCap);
    return interleave(keptReviews, newWords);
  }

  function queuePreview(now) {
    const ts = now || Date.now();
    const due = dueCards(ts);
    const newCount = newRemaining(ts);
    const cap = Math.max(10, settings().sessionCap || 60);
    const total = Math.min(cap, due.length + newCount);
    return {
      due: due.length,
      new: newCount,
      total,
      minutes: Math.max(1, Math.round(total * 0.42)),
      overflow: Math.max(0, due.length + newCount - total),
    };
  }

  function weakCards(limit) {
    return trackedCards()
      .filter((c) => (c.lapses || 0) > 0 || c.flagged)
      .sort((a, b) => {
        if ((b.lapses || 0) !== (a.lapses || 0)) return (b.lapses || 0) - (a.lapses || 0);
        return (a.s || 0) - (b.s || 0);
      })
      .slice(0, limit || 8);
  }

  function streak(now) {
    const ts = now || Date.now();
    let cursor = startOfDay(ts);
    const today = dayKey(cursor);
    if (!state.db.logs[today] || !state.db.logs[today].n) {
      cursor = addDays(cursor, -1);
    }
    let count = 0;
    for (let i = 0; i < 3650; i += 1) {
      const log = state.db.logs[dayKey(cursor)];
      if (log && log.n > 0) {
        count += 1;
        cursor = addDays(cursor, -1);
      } else {
        break;
      }
    }
    return count;
  }

  function retention(days, now) {
    const ts = now || Date.now();
    let n = 0;
    let ok = 0;
    for (let i = 0; i < days; i += 1) {
      const log = state.db.logs[dayKey(addDays(ts, -i))];
      if (log) {
        n += log.n || 0;
        ok += log.ok || 0;
      }
    }
    return n ? ok / n : null;
  }

  function heatmap(weeks, now) {
    const ts = now || Date.now();
    const today = startOfDay(ts);
    const days = weeks * 7;
    const start = addDays(today, -(days - 1 - ((new Date(today).getDay() + 6) % 7)));
    const cells = [];
    for (let i = 0; i < days; i += 1) {
      const t = addDays(start, i);
      const log = state.db.logs[dayKey(t)] || null;
      cells.push({ t, key: dayKey(t), n: log ? log.n : 0, ok: log ? log.ok : 0 });
    }
    return cells;
  }

  function dailySeries(days, now) {
    const ts = now || Date.now();
    const out = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const t = addDays(ts, -i);
      const log = state.db.logs[dayKey(t)] || { n: 0, new: 0, rev: 0, ok: 0, ms: 0 };
      out.push({ t, ...log });
    }
    return out;
  }

  function forecast(days, now) {
    const ts = now || Date.now();
    const start = startOfDay(ts);
    const out = [];
    for (let i = 0; i < days; i += 1) out.push({ t: addDays(start, i), n: 0 });
    trackedCards().forEach((card) => {
      if (card.state === "new") return;
      const idx = Math.floor((startOfDay(card.due) - start) / DAY);
      if (idx < 0) out[0].n += 1;
      else if (idx < out.length) out[idx].n += 1;
    });
    return out;
  }

  function masteryDistribution() {
    const dist = [0, 0, 0, 0, 0, 0];
    trackedCards().forEach((card) => {
      if ((card.reps || 0) === 0) return;
      dist[srs.mastery(card)] += 1;
    });
    return dist;
  }

  function snapshot(now) {
    const ts = now || Date.now();
    const log = todayLog(ts);
    const due = dueCards(ts);
    const q = queuePreview(ts);
    return {
      now: ts,
      log,
      due: due.length,
      dueAll: due,
      newRemaining: newRemaining(ts),
      queue: q,
      learned: learnedCards().length,
      mastered: masteredCards().length,
      streak: streak(ts),
      retention7: retention(7, ts),
      retention30: retention(30, ts),
      goal: settings().dailyGoal,
      goalProgress: clamp((log.n || 0) / Math.max(1, settings().dailyGoal), 0, 1),
      totals: state.db.totals,
      weak: weakCards(6),
      todayNew: todayNewWords(ts),
    };
  }

  function totalsByMode() {
    const out = {};
    Object.values(state.db.logs).forEach((log) => {
      Object.keys(log.modes || {}).forEach((mode) => {
        out[mode] = (out[mode] || 0) + log.modes[mode];
      });
    });
    return out;
  }

  // ---------- import / export ----------
  function exportJson() {
    return JSON.stringify({
      app: "cimai",
      version: VERSION,
      exportedAt: new Date().toISOString(),
      db: state.db,
    }, null, 2);
  }

  function importJson(text) {
    const payload = JSON.parse(text);
    const incoming = payload && payload.db ? payload.db : payload;
    if (!incoming || typeof incoming !== "object" || !incoming.cards || !incoming.settings) {
      throw new Error("不是有效的词脉备份文件");
    }
    const next = blankDb();
    next.created = incoming.created || Date.now();
    next.settings = sanitizeSettings(incoming.settings);
    next.cards = incoming.cards || {};
    next.logs = incoming.logs || {};
    next.sessions = Array.isArray(incoming.sessions) ? incoming.sessions.slice(-120) : [];
    next.scenes = incoming.scenes && typeof incoming.scenes === "object" ? incoming.scenes : {};
    next.totals = Object.assign(next.totals, incoming.totals || {});
    state.db = next;
    saveNow();
    return { cards: Object.keys(next.cards).length, logs: Object.keys(next.logs).length };
  }

  function clearAll() {
    resetAll();
  }

  // ---------- init ----------
  function init() {
    initData();
    load();
    return state;
  }

  global.PET = global.PET || {};
  global.PET.core = {
    init,
    state,
    SCOPES,
    DEFAULT_SETTINGS,
    word,
    words,
    meta,
    scopeWords,
    scopeLabel,
    scenes,
    scene,
    sceneWords,
    sceneStrongWords,
    sceneStats,
    nextScene,
    scenesByStatus,
    markSceneDone,
    sceneDone,
    sceneCoverage: () => state.sceneCoverage || 0,
    settings,
    updateSettings,
    db,
    getCard,
    saveCard,
    answer,
    recordSession,
    todayLog,
    todayNewWords,
    dueCards,
    trackedCards,
    learnedCards,
    masteredCards,
    newCandidates,
    newRemaining,
    buildQueue,
    queuePreview,
    weakCards,
    streak,
    retention,
    heatmap,
    dailySeries,
    forecast,
    masteryDistribution,
    snapshot,
    totalsByMode,
    resetWord,
    resetAll,
    markMastered,
    toggleFlag,
    exportJson,
    importJson,
    saveNow,
    // helpers
    esc,
    hashString,
    shuffle,
    dayKey,
    startOfDay,
    addDays,
    dateLabelCN,
    greeting,
    formatDuration,
    formatInterval,
    dueLabel,
    normalizeAnswer,
    spellable,
    clozeAvailable,
    themeLabel,
    masteryLabel,
    highlightExample,
    clozeText,
    clamp,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.PET.core;
})(typeof window !== "undefined" ? window : globalThis);
