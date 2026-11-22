/* 词脉 · views */
(function (global) {
  "use strict";

  const core = global.PET.core;
  const srs = global.PET.srs;

  const seen = new Set();

  function icon(name, cls) {
    return global.PET.icon ? global.PET.icon(name, cls) : "";
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function sceneIndex(id) {
    const list = core.scenes();
    const i = list.findIndex((s) => s.id === id);
    return i < 0 ? 0 : i + 1;
  }

  function sceneNumber(id) {
    return pad2(sceneIndex(id));
  }

  function masteryDots(card) {
    const level = srs.mastery(card);
    let out = "";
    for (let i = 1; i <= 5; i += 1) out += `<i class="${i <= level ? "on" : ""}"></i>`;
    return `<span class="mdots">${out}</span>`;
  }

  function sceneDots(stats) {
    return stats.anchors
      .map((a) => `<i class="${a.learned ? "on" : ""} ${a.due ? "due" : ""}"></i>`)
      .join("");
  }

  function termForms(term) {
    const entry = core.word(term);
    const list = (entry && entry.forms && entry.forms.length ? entry.forms : [term]).slice();
    if (!list.some((x) => x.toLowerCase() === String(term).toLowerCase())) list.push(term);
    return list
      .sort((a, b) => b.length - a.length)
      .map((x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }

  function markWord(text, term) {
    if (!text) return "";
    const re = new RegExp(`(?<![A-Za-z])(${termForms(term).join("|")})(?![A-Za-z])`, "i");
    if (!re.test(text)) return core.esc(text);
    return core.esc(text).replace(re, "<mark>$1</mark>");
  }

  function entrySceneLink(entry) {
    if (!entry || !entry.scene) return "";
    const scene = core.scene(entry.scene);
    if (!scene) return "";
    return `<div class="scene-ref">${icon("layers")}<span>场景</span><a href="#/scene/${scene.id}" data-action="go" data-href="#/scene/${scene.id}">${core.esc(scene.name)}</a><span>· 第 ${pad2((scene.anchors || []).indexOf(entry.w) + 1)} 步</span></div>`;
  }

  function emptyState(title, text, action) {
    return `<div class="lib-empty"><b>${core.esc(title)}</b><p>${core.esc(text)}</p>${action || ""}</div>`;
  }

  // ======================================================================
  // Today
  // ======================================================================

  function renderToday() {
    const now = Date.now();
    const snap = core.snapshot(now);
    const next = core.nextScene(now);
    const nextStats = next ? core.sceneStats(next.id) : null;
    const date = core.dateLabelCN(now);
    const meta = core.meta();
    const coverage = core.sceneCoverage();
    const totalCore = meta.core || 0;
    const goalPct = Math.round(snap.goalProgress * 100);
    const queue = snap.queue;
    const allDone = !next;

    const hero = allDone
      ? `<section class="today-hero">
          <div class="hero-copy">
            <p class="eyebrow">TODAY · ${date.md} ${date.week} · ALL SCENES DONE</p>
            <h1>26 个场景，<em>都走过了。</em></h1>
            <p class="hero-sub">接下来，让记忆自己生长。到期复习会把每个词在快要忘记时送回来。</p>
            <div class="hero-actions">
              <button class="btn primary lg" data-action="start-review" data-mode="daily" ${queue.total ? "" : "disabled"}>${icon("play")}${queue.total ? "开始今日复习" : "今日已清空"}</button>
              <button class="btn ghost" data-action="start-review" data-mode="free">${icon("shuffle")}自由练习 10 词</button>
            </div>
          </div>
          <aside class="hero-side">${ringBlock(goalPct, snap)}</aside>
        </section>`
      : `<section class="today-hero">
          <div class="hero-copy">
            <p class="eyebrow">TODAY · ${date.md} ${date.week} · 场景 ${sceneNumber(next.id)} / 26</p>
            <h1>今天，走进<br><em>${core.esc(next.name)}</em>。</h1>
            <p class="hero-sub">先经历一条真实的场景链，再把 6 个锚词放回这条链上。词不是背下来的，是<strong>有位置</strong>的。</p>
            <div class="scene-spotlight" style="--scene-accent:${next.accent}">
              <span class="spot-index">${sceneNumber(next.id)}</span>
              <div>
                <h3>${core.esc(next.name)}</h3>
                <p>${core.esc(next.en)} · ${core.esc(next.tagline)}</p>
                <div class="spot-words">${next.anchors.map((w) => `<span>${core.esc(w)}</span>`).join("")}</div>
              </div>
              <button class="btn accent" data-action="start-scene" data-id="${next.id}">${icon("play")}进入速记</button>
            </div>
            <div class="hero-actions">
              <button class="btn primary lg" data-action="start-scene" data-id="${next.id}">${icon("spark")}开始场景速记<span class="kbd">Space</span></button>
              ${queue.total ? `<button class="btn ghost" data-action="start-review" data-mode="daily">${icon("refresh")}先复习 ${queue.total} 张</button>` : `<button class="btn ghost" data-action="start-review" data-mode="free">${icon("shuffle")}自由练习</button>`}
            </div>
            <p class="hero-hint">约 4 分钟 · 6 个锚词 · 1 条记忆链 · 链路回忆</p>
          </div>
          <aside class="hero-side">${ringBlock(goalPct, snap)}</aside>
        </section>`;

    const metrics = `<section class="metrics-strip">
      <div class="metric-cell"><span class="metric-ico">${icon("layers")}</span><div><b>${coverage} <small style="font-size:12px;color:var(--muted);font-weight:400">/ ${totalCore}</small></b><span>核心词已归入场景</span></div></div>
      <div class="metric-cell"><span class="metric-ico">${icon("check")}</span><div><b>${snap.learned}</b><span>已进入记忆库</span></div></div>
      <div class="metric-cell"><span class="metric-ico">${icon("target")}</span><div><b>${snap.mastered}</b><span>稳定掌握（≥ 21 天）</span></div></div>
    </section>`;

    const queuePanel = `<section class="panel queue-card">
      <div class="section-title"><h2>今日队列</h2><p>${queue.minutes} 分钟</p></div>
      <div class="queue-row review"><span class="q-num">${queue.due}</span><div><b>到期复习</b><p>按 FSRS 记忆曲线安排</p></div><span class="q-time">${queue.due ? "现在" : "已清空"}</span></div>
      <div class="queue-row new"><span class="q-num">${queue.new}</span><div><b>额外新词</b><p>${focusSceneName() ? `来自「${focusSceneName()}」` : "场景锚词之外的核心词"}</p></div><span class="q-time">今日上限 ${core.settings().newPerDay}</span></div>
      <div class="queue-row"><span class="q-num">${snap.weak.length}</span><div><b>待修复</b><p>错误次数较多，优先出现</p></div><span class="q-time">${snap.weak.length ? "优先" : "干净"}</span></div>
      <div style="display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn primary" data-action="start-review" data-mode="daily" ${queue.total ? "" : "disabled"}>${icon("play")}${queue.total ? `开始复习 ${queue.total} 张` : "今日复习已清空"}</button>
        <button class="btn ghost" data-action="start-review" data-mode="free">${icon("shuffle")}自由练习</button>
      </div>
      ${miniBars()}
    </section>`;

    const weakPanel = `<section class="panel">
      <div class="section-title"><h2>待修复的词</h2><a href="#/library" data-nav-link>查看词库 →</a></div>
      ${snap.weak.length ? `<div class="word-list">${snap.weak.map(weakRow).join("")}</div>` : `<div class="lib-empty" style="padding:26px 0"><b>没有明显薄弱词</b><p>继续保持节奏，让间隔复习替你守住。</p></div>`}
    </section>`;

    const nextScenes = core.scenes().filter((s) => {
      const st = core.sceneStats(s.id);
      return st && st.learned > 0 && st.learned < 6;
    }).slice(0, 3);
    const progressPanel = nextScenes.length ? `<section class="panel">
      <div class="section-title"><h2>正在进行的场景</h2><a href="#/scenes">全部 →</a></div>
      <div class="stack" style="gap:12px">${nextScenes.map((s) => {
        const st = core.sceneStats(s.id);
        return `<a class="queue-row" href="#/scene/${s.id}" style="grid-template-columns:38px 1fr auto;text-decoration:none">
          <span class="q-num" style="width:38px;height:38px;background:${s.accent}18;color:${s.accent};font-size:11px">${sceneNumber(s.id)}</span>
          <div><b>${core.esc(s.name)}</b><p>${st.learned}/6 锚词 · ${st.due ? `${st.due} 个到期` : "继续场景"}</p></div>
          <span class="q-time">→</span>
        </a>`;
      }).join("")}</div>
    </section>` : "";

    const method = `<section class="method-strip">
      <div class="method-step"><span class="ms-num">01 / ANCHOR</span><b>场景锚定</b><p>6 个词，一条有时间顺序的经历。先理解，再记忆。</p></div>
      <div class="method-step"><span class="ms-num">02 / RETRIEVE</span><b>链路回忆</b><p>遮住词，让它在句子里的位置先回来。这是提取练习。</p></div>
      <div class="method-step"><span class="ms-num">03 / SPACE</span><b>间隔重遇</b><p>FSRS 在遗忘临界点把词送回来，越来越少，但越来越牢。</p></div>
    </section>`;

    return `${hero}${metrics}<div class="today-grid">${queuePanel}<div class="stack">${weakPanel}${progressPanel}</div></div>${method}`;
  }

  function focusSceneName() {
    const id = core.db().meta && core.db().meta.focusScene;
    const scene = id ? core.scene(id) : null;
    return scene ? scene.name : "";
  }

  function ringBlock(pct, snap) {
    return `<div class="goal-ring" style="--p:${pct}"><div class="ring-inner"><b>${pct}%</b><span>今日目标</span></div></div>
      <div class="side-metrics">
        <div class="side-metric"><span>连续学习</span><b>${snap.streak} <small>天</small></b></div>
        <div class="side-metric"><span>7 日保持率</span><b>${snap.retention7 == null ? "—" : Math.round(snap.retention7 * 100) + "%"}</b></div>
        <div class="side-metric"><span>今日已答</span><b>${snap.log.n || 0} <small>/ ${snap.goal}</small></b></div>
      </div>`;
  }

  function weakRow(card) {
    const entry = core.word(card.w);
    if (!entry) return "";
    return `<div class="wl-row" data-action="open-word" data-w="${core.esc(card.w)}">
      <div class="wl-word"><b>${core.esc(card.w)}</b><span>${core.esc(entry.zh)}</span></div>
      <span class="wl-meta">错 ${card.lapses || 0} 次</span>
      <button class="icon-btn sm wl-audio" data-action="play-word" data-w="${core.esc(card.w)}" aria-label="播放 ${core.esc(card.w)}">${icon("volume")}</button>
    </div>`;
  }

  function miniBars() {
    const series = core.dailySeries(14);
    const max = Math.max(1, ...series.map((d) => (d.n || 0)));
    const bars = series.map((d, i) => {
      const total = d.n || 0;
      const rev = d.rev || 0;
      const nw = d.new || 0;
      const hTotal = total ? (total / max) * 78 : 0;
      const hRev = total ? (rev / total) * hTotal : 0;
      const hNew = total ? (nw / total) * hTotal : 0;
      return `<div class="mini-bar" title="${core.esc(d.t ? core.dateLabelCN(d.t).md : "")} · ${total} 次">
        ${total ? `<i class="rev" style="height:${hRev}px"></i><i style="height:${hNew}px"></i>` : `<i style="height:2px;opacity:.25"></i>`}
      </div>`;
    }).join("");
    return `<div style="margin-top:8px"><div class="mini-bars">${bars}</div><div class="bar-axis"><span>14 天前</span><span>7 天</span><span>今天</span></div></div>`;
  }

  // ======================================================================
  // Scenes index
  // ======================================================================

  function renderScenes() {
    const list = core.scenes();
    const filter = (global.PET.ui && global.PET.ui.sceneFilter) || "all";
    const filtered = core.scenesByStatus(filter);
    const coverage = core.sceneCoverage();
    const totalCore = core.meta().core || 0;
    const doneCount = list.filter((s) => core.sceneStats(s.id).learned === 6).length;

    const filters = [
      ["all", "全部", list.length],
      ["new", "未开始", list.filter((s) => core.sceneStats(s.id).learned === 0).length],
      ["learning", "进行中", list.filter((s) => { const st = core.sceneStats(s.id); return st.learned > 0 && st.learned < 6; }).length],
      ["done", "已完成", doneCount],
    ];

    return `<header class="page-head">
      <div><p class="eyebrow">SCENES · 26 个真实情境</p><h1>场景</h1><p>每个场景是一条可以复述的经历：6 个锚词按顺序落在里面，再连同搭配、对比和同场景词群一起复习。</p></div>
      <div class="head-aside">${coverage} / ${totalCore}<br>核心词已归入场景</div>
    </header>
    <div class="scene-summary-note">${icon("info")}<div><b>先走场景，再进复习。</b>场景速记会带来 6 个新词；它们随后进入 FSRS 队列，在你快忘记时再次出现。场景不是分类，是一条<b>有因果和顺序</b>的线。</div></div>
    <div class="scene-toolbar">
      <div class="seg">${filters.map(([id, label, n]) => `<button class="${filter === id ? "active" : ""}" data-action="scene-filter" data-filter="${id}">${label} <span style="opacity:.55">${n}</span></button>`).join("")}</div>
      <div style="display:flex;gap:8px;align-items:center;color:var(--muted);font-size:11px">${icon("layers")} ${doneCount} 个场景已完成</div>
    </div>
    <div class="scene-grid">${filtered.map(sceneCard).join("")}</div>`;
  }

  function sceneCard(scene) {
    const st = core.sceneStats(scene.id);
    const done = st.learned === 6;
    return `<a class="scene-card ${done ? "done" : ""}" href="#/scene/${scene.id}" style="--scene-accent:${scene.accent}">
      <div class="scene-card-top"><span class="sc-num">SCENE ${sceneNumber(scene.id)}</span><span class="sc-theme">${core.themeLabel(scene.theme)}</span></div>
      <h3>${core.esc(scene.name)}</h3>
      <p class="sc-en">${core.esc(scene.en)}</p>
      <p class="sc-tag">${core.esc(scene.tagline)}</p>
      <div class="anchor-chips">${scene.anchors.map((w) => `<span>${core.esc(w)}</span>`).join("")}</div>
      <div class="scene-card-foot">
        <span class="dots">${sceneDots(st)}</span>
        <small>${st.learned}/6 · ${st.strongTotal} 词群${st.due ? ` · ${st.due} 到期` : ""}</small>
      </div>
    </a>`;
  }

  // ======================================================================
  // Scene detail
  // ======================================================================

  function renderScene(id) {
    const scene = core.scene(id);
    if (!scene) return renderNotFound();
    const st = core.sceneStats(id);
    const words = core.sceneStrongWords(id);
    const expanded = global.PET.ui && global.PET.ui.sceneExpanded;
    const shown = expanded ? words : words.slice(0, 24);
    const started = st.learned > 0;

    return `<header class="scene-hero" data-index="${sceneNumber(id)}" style="--scene-accent:${scene.accent}">
      <a class="back-link" href="#/scenes">${icon("arrow-left")}所有场景</a>
      <div class="sh-kicker">SCENE ${sceneNumber(id)} / 26 · ${core.themeLabel(scene.theme)}</div>
      <h1>${core.esc(scene.name)}</h1>
      <p class="sh-en">${core.esc(scene.en)}</p>
      <p class="sh-intro">${core.esc(scene.intro)}</p>
      <div class="sh-actions">
        <button class="btn accent lg" data-action="start-scene" data-id="${scene.id}">${icon(started ? "refresh" : "play")}${started ? "再走一遍记忆链" : "开始场景速记"}</button>
        <button class="btn ghost" data-action="speak-scene" data-id="${scene.id}">${icon("headphones")}朗读场景</button>
        ${st.due ? `<button class="btn ghost" data-action="review-scene" data-id="${scene.id}">${icon("target")}复习本场景 · ${st.due}</button>` : ""}
      </div>
      <div class="sh-meta">
        <span><b>${st.learned}/6</b> 锚词已学</span>
        <span><b>${st.strongTotal}</b> 个强关联词</span>
        <span><b>${st.coreTotal}</b> 个核心词</span>
        <span>${st.due ? `<b>${st.due}</b> 个到期` : "暂无到期"}</span>
      </div>
    </header>

    <section class="panel chain-panel">
      <div class="section-title"><h2>记忆链</h2><p>按顺序读一遍：先有画面，再记词。</p></div>
      <ol class="chain">${scene.chain.map((step, i) => chainStep(scene, step, i)).join("")}</ol>
    </section>

    <div class="relation-grid">
      <section class="panel">
        <div class="section-title"><h2>搭配</h2><p>词在句子里怎么用</p></div>
        <div class="pair-list">${(scene.pairs || []).map((p) => `<div class="pair-row"><div><span class="pair-phrase">${core.esc(p.phrase)}</span><span class="pair-word">${core.esc(p.w)}</span></div><span class="pair-zh">${core.esc(p.zh)}</span></div>`).join("")}</div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>对比</h2><p>把相邻概念分开</p></div>
        ${(scene.contrasts || []).map((c) => `<div class="contrast-row"><b>${core.esc(c.a)}</b><span class="vs">↔</span><b>${core.esc(c.b)}</b><em>${core.esc(c.note)}</em></div>`).join("")}
      </section>
    </div>

    <section class="panel scene-words-panel">
      <div class="section-title"><h2>本场景词群</h2><p>强关联词 · ${words.length} 个</p></div>
      <div class="scene-word-grid">${shown.map((entry) => sceneWordRow(entry)).join("")}</div>
      ${words.length > 24 ? `<div class="more-words"><button class="btn ghost sm" data-action="expand-scene-words">${expanded ? "收起" : `展开全部 ${words.length} 个`}</button></div>` : ""}
    </section>
    <div class="scene-cta-bottom">
      <button class="btn accent lg" data-action="start-scene" data-id="${scene.id}">${icon(started ? "refresh" : "play")}${started ? "再走一遍记忆链" : "开始场景速记"}</button>
      <a class="btn ghost" href="#/scenes">返回场景列表</a>
    </div>`;
  }

  function chainStep(scene, step, i) {
    const entry = core.word(step.w);
    const pos = entry && entry.pos ? entry.pos : "";
    return `<li class="chain-step anchor">
      <span class="chain-num">${pad2(i + 1)}</span>
      <div class="chain-body">
        <div class="chain-wordline">
          <span class="chain-word">${core.esc(step.w)}</span>
          ${pos ? `<span class="chain-pos">${core.esc(pos)}</span>` : ""}
          ${entry ? `<button class="icon-btn sm chain-audio" data-action="play-word" data-w="${core.esc(step.w)}" aria-label="播放 ${core.esc(step.w)}">${icon("volume")}</button>` : ""}
          <span class="chain-tag">STEP ${pad2(i + 1)}</span>
        </div>
        <p class="chain-en">${markWord(step.en, step.w)}</p>
        <p class="chain-zh">${core.esc(step.zh)}</p>
      </div>
    </li>`;
  }

  function sceneWordRow(entry) {
    const card = core.getCard(entry.w);
    const level = srs.mastery(card);
    return `<button class="scene-word" data-action="open-word" data-w="${core.esc(entry.w)}">
      <span class="sw-word">${core.esc(entry.w)}</span>
      <span class="sw-zh">${core.esc(entry.zh)}</span>
      <span class="sw-dots">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= level ? "on" : ""}"></i>`).join("")}</span>
    </button>`;
  }

  // ======================================================================
  // Library
  // ======================================================================

  function libState() {
    global.PET.ui = global.PET.ui || {};
    if (!global.PET.ui.library) {
      global.PET.ui.library = { q: "", filter: "all", tier: "core", sort: "default", limit: 60 };
    }
    return global.PET.ui.library;
  }

  function libraryData() {
    const st = libState();
    const q = st.q.trim().toLowerCase();
    let list = core.words().filter((e) => {
      if (st.tier === "core" && !e.core) return false;
      if (st.tier === "pet" && e.ket) return false;
      if (q && !(`${e.w} ${e.zh} ${e.def}`.toLowerCase().includes(q))) return false;
      const card = core.getCard(e.w);
      if (st.filter === "new") return card.state === "new" || (card.reps || 0) === 0;
      if (st.filter === "learning") return card.state === "learning" || card.state === "relearning";
      if (st.filter === "due") return srs.isDue(card, Date.now());
      if (st.filter === "mastered") return srs.isMastered(card);
      if (st.filter === "no-scene") return !e.scene;
      return true;
    });
    list.sort((a, b) => {
      if (st.sort === "mastery") {
        const d = srs.mastery(core.getCard(a.w)) - srs.mastery(core.getCard(b.w));
        if (d) return d;
      } else if (st.sort === "due") {
        const ca = core.getCard(a.w);
        const cb = core.getCard(b.w);
        const va = ca.state === "new" ? Infinity : ca.due;
        const vb = cb.state === "new" ? Infinity : cb.due;
        if (va !== vb) return va - vb;
      } else if (st.sort === "lapses") {
        const d = (core.getCard(b.w).lapses || 0) - (core.getCard(a.w).lapses || 0);
        if (d) return d;
      }
      return a.w.toLowerCase().localeCompare(b.w.toLowerCase());
    });
    return { list, shown: list.slice(0, st.limit), st, total: list.length };
  }

  function renderLibrary() {
    const { list, shown, st, total } = libraryData();
    const counts = {
      all: core.words().length,
      core: core.meta().core || 0,
      learned: core.learnedCards().length,
    };
    const filters = [
      ["all", "全部"],
      ["new", "新词"],
      ["learning", "学习中"],
      ["due", "待复习"],
      ["mastered", "已掌握"],
      ["no-scene", "未归场景"],
    ];
    const rows = shown.map(libRow).join("");

    return `<header class="page-head">
      <div><p class="eyebrow">LIBRARY · ${counts.all} 词条</p><h1>词库</h1><p>按场景、掌握度和到期时间查看每一个词。核心词 ${counts.core} 个，已进入记忆库 ${counts.learned} 个。</p></div>
      <div class="head-aside">${core.sceneCoverage()} 个核心词<br>已归入 26 个场景</div>
    </header>
    <div class="lib-toolbar">
      <div class="search-box">${icon("search")}<input id="libSearch" type="search" placeholder="搜索单词、中文释义、英文释义…" value="${core.esc(st.q)}" autocomplete="off"><button class="icon-btn sm search-clear" data-action="lib-clear" aria-label="清空搜索">${icon("close")}</button></div>
      <div class="lib-filters">${filters.map(([id, label]) => `<button class="filter-btn ${st.filter === id ? "active" : ""}" data-action="lib-filter" data-filter="${id}">${label}</button>`).join("")}</div>
      <select class="lib-select" id="libSort" aria-label="排序">
        <option value="default" ${st.sort === "default" ? "selected" : ""}>按字母</option>
        <option value="mastery" ${st.sort === "mastery" ? "selected" : ""}>按掌握度</option>
        <option value="due" ${st.sort === "due" ? "selected" : ""}>按到期时间</option>
        <option value="lapses" ${st.sort === "lapses" ? "selected" : ""}>按错误次数</option>
      </select>
    </div>
    <div class="lib-summary"><span>筛选后 <b>${total}</b> 个</span><span>词库范围 <b>${st.tier === "core" ? "21 天核心" : st.tier === "pet" ? "PET 新增" : "全部"}</b></span><span>点击任意词查看记忆状态</span></div>
    <div class="seg" style="margin-bottom:14px;width:max-content">${[["core", "21 天核心"], ["pet", "PET 新增"], ["all", "全部 3,283"]].map(([id, label]) => `<button class="${st.tier === id ? "active" : ""}" data-action="lib-tier" data-tier="${id}">${label}</button>`).join("")}</div>
    <div class="lib-head-row"><span>单词</span><span>释义</span><span>掌握度</span><span>到期</span><span></span></div>
    ${total ? `<div class="lib-list">${rows}</div>` : emptyState("没有匹配的词", "换一个关键词，或把筛选条件放宽。")}
    ${total > st.limit ? `<div class="load-more"><button class="btn ghost" data-action="lib-load">加载更多 · 还有 ${total - st.limit} 个</button></div>` : ""}`;
  }

  function libRow(entry) {
    const card = core.getCard(entry.w);
    const level = srs.mastery(card);
    const due = card.state === "new" || (card.reps || 0) === 0 ? "新词" : card.state === "learning" || card.state === "relearning" ? "学习中" : core.dueLabel(card.due);
    return `<div class="lib-row" data-action="open-word" data-w="${core.esc(entry.w)}">
      <div class="lib-word"><b>${core.esc(entry.w)}</b>${entry.pos ? `<small>${core.esc(entry.pos)}</small>` : ""}</div>
      <div class="lib-zh">${core.esc(entry.zh)}</div>
      <div class="mastery">${masteryDots(card)}<span>${core.masteryLabel(level)}</span></div>
      <div class="lib-due ${card.state !== "new" && srs.isDue(card, Date.now()) ? "now" : ""}">${core.esc(due)}</div>
      <button class="icon-btn sm" data-action="play-word" data-w="${core.esc(entry.w)}" aria-label="播放 ${core.esc(entry.w)}">${icon("volume")}</button>
    </div>`;
  }

  // ======================================================================
  // Stats
  // ======================================================================

  function renderStats() {
    const now = Date.now();
    const snap = core.snapshot(now);
    const totals = snap.totals || {};
    const learned = snap.learned;
    const mastered = snap.mastered;
    const ret7 = snap.retention7;
    const time = core.formatDuration(totals.ms || 0);

    const heat = core.heatmap(16, now);
    const heatCells = heat.map((c) => {
      const l = c.n === 0 ? 0 : c.n < 8 ? 1 : c.n < 20 ? 2 : c.n < 40 ? 3 : 4;
      return `<i data-l="${l}" title="${core.esc(core.dateLabelCN(c.t).md)} · ${c.n} 次 · 正确 ${c.ok}"></i>`;
    }).join("");

    const series = core.dailySeries(14, now);
    const max = Math.max(1, ...series.map((d) => d.n || 0));
    const bars = series.map((d) => {
      const hRev = ((d.rev || 0) / max) * 100;
      const hNew = ((d.new || 0) / max) * 100;
      return `<div class="big-bar" title="${core.dateLabelCN(d.t).md} · ${d.n || 0} 次"><i class="rev" style="height:${hRev}%"></i><i style="height:${hNew}%"></i></div>`;
    }).join("");
    const axis = series.map((d) => `<span>${new Date(d.t).getDate()}</span>`).join("");
    const hasSeries = series.some((d) => (d.n || 0) > 0);

    const dist = core.masteryDistribution();
    const distSum = dist.reduce((a, b) => a + b, 0);
    const totalDist = Math.max(1, distSum);
    const distRows = dist.map((n, i) => `<div class="dist-row"><span class="dr-label">${core.masteryLabel(i)}</span><div class="dr-track"><div class="dr-fill" style="width:${(n / totalDist) * 100}%"></div></div><b>${n}</b></div>`).join("");

    const forecast = core.forecast(14, now);
    const hasForecast = forecast.some((f) => f.n > 0);
    const fmax = Math.max(1, ...forecast.map((f) => f.n));
    const forecastBars = forecast.map((f, i) => `<div class="fc" title="${core.dateLabelCN(f.t).md} · ${f.n} 个到期"><b>${f.n || ""}</b><i style="height:${(f.n / fmax) * 100}%"></i><span>${i === 0 ? "今天" : new Date(f.t).getDate()}</span></div>`).join("");

    const modes = core.totalsByMode();
    const modeLabels = { recall: "认词", choice: "选义", listen: "听辨", cloze: "语境", spell: "拼写", scene: "场景" };
    const modeMax = Math.max(1, ...Object.values(modes));
    const modeRows = Object.keys(modes).sort((a, b) => modes[b] - modes[a]).slice(0, 6).map((m) => `<div class="dist-row"><span class="dr-label">${modeLabels[m] || m}</span><div class="dr-track"><div class="dr-fill" style="width:${(modes[m] / modeMax) * 100}%"></div></div><b>${modes[m]}</b></div>`).join("");

    return `<header class="page-head">
      <div><p class="eyebrow">DATA · 记忆仪表盘</p><h1>数据</h1><p>这里不追求「背了多少」，只看两件事：是否在忘记前复习，以及能否在真实语境里想起。</p></div>
      <div class="head-aside">连续 ${snap.streak} 天<br>累计 ${core.formatDuration(totals.ms || 0)}</div>
    </header>
    <div class="stat-cards">
      <div class="stat-card"><div class="sc-label">LEARNED</div><div class="sc-value">${learned}<small>词</small></div><div class="sc-sub">已进入 FSRS 记忆库</div></div>
      <div class="stat-card"><div class="sc-label">MASTERED</div><div class="sc-value">${mastered}<small>词</small></div><div class="sc-sub">稳定度 ≥ 21 天</div></div>
      <div class="stat-card"><div class="sc-label">RETENTION · 7D</div><div class="sc-value">${ret7 == null ? "—" : Math.round(ret7 * 100)}<small>%</small></div><div class="sc-sub">最近 7 天首次作答正确率</div></div>
      <div class="stat-card"><div class="sc-label">TIME</div><div class="sc-value" style="font-size:22px">${core.esc(time)}</div><div class="sc-sub">累计专注时长</div></div>
    </div>
    <div class="grid-2" style="align-items:start">
      <section class="panel">
        <div class="section-title"><h2>学习热力</h2><p>最近 16 周</p></div>
        <div class="heat-wrap"><div class="heat">${heatCells}</div></div>
        <div class="heat-legend">少 <i data-l="0"></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i> 多</div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>每日节奏</h2><p>复习 / 新词</p></div>
        ${hasSeries ? `<div class="big-bars">${bars}</div><div class="big-axis">${axis}</div><div class="heat-legend" style="margin-top:14px"><i style="background:var(--accent);opacity:.22"></i> 复习 <i style="background:var(--accent)"></i> 新词</div>` : `<div class="empty-note">完成第一次学习后，这里会出现你的每日节奏。</div>`}
      </section>
      <section class="panel">
        <div class="section-title"><h2>掌握分布</h2><p>${distSum} 个已学词</p></div>
        <div class="dist">${distRows}</div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>未来 14 天到期</h2><p>提前安排节奏</p></div>
        ${hasForecast ? `<div class="forecast">${forecastBars}</div>` : `<div class="empty-note">还没有安排到未来的卡片。学完第一个场景后，这里会出现复习曲线。</div>`}
      </section>
      <section class="panel">
        <div class="section-title"><h2>训练方式</h2><p>累计作答</p></div>
        <div class="dist">${modeRows || `<p style="color:var(--muted);font-size:12px">还没有作答记录。</p>`}</div>
      </section>
      <section class="panel">
        <div class="section-title"><h2>最需要修复</h2><a href="#/library" data-nav-link>词库 →</a></div>
        ${snap.weak.length ? `<div class="word-list">${snap.weak.slice(0, 6).map(weakRow).join("")}</div>` : `<p style="color:var(--muted);font-size:12px">暂无薄弱词，继续保持。</p>`}
      </section>
    </div>
    <section class="panel" style="margin-top:20px">
      <div class="section-title"><h2>场景覆盖</h2><p>${core.sceneCoverage()} / ${core.meta().core || 0} 核心词已归入场景</p></div>
      <div class="dist">${core.scenes().slice(0, 8).map((s) => {
        const st = core.sceneStats(s.id);
        return `<div class="dist-row"><span class="dr-label" style="width:74px">${core.esc(s.name)}</span><div class="dr-track"><div class="dr-fill" style="width:${st.progress * 100}%"></div></div><b>${st.learned}/6</b></div>`;
      }).join("")}</div>
      <div style="margin-top:14px"><a class="btn ghost sm" href="#/scenes" data-nav-link>查看全部场景 ${icon("arrow-right")}</a></div>
    </section>`;
  }

  // ======================================================================
  // Settings
  // ======================================================================

  function renderSettings() {
    const s = core.settings();
    const db = core.db();
    const size = (() => {
      try { return Math.round(JSON.stringify(db).length / 1024) + " KB"; } catch (e) { return "—"; }
    })();
    const themes = [["auto", "跟随系统"], ["paper", "纸白"], ["night", "夜读"]];
    const scopes = [
      ["core", "21 天核心", "1,245 个词 · 默认，场景优先"],
      ["pet", "PET 新增", "1,579 个 PET 新增词"],
      ["all", "全部词库", "3,283 个词 · 含 KET 基础"],
    ];

    return `<header class="page-head">
      <div><p class="eyebrow">SETTINGS · 学习参数</p><h1>设置</h1><p>默认值已经按「每天 1 个场景 + 到期复习」调好。想加速或放慢，只改这里。</p></div>
      <div class="head-aside">本地存储 ${size}<br>${Object.keys(db.cards).length} 个词有学习记录</div>
    </header>
    <div class="settings-grid">
      <div class="stack">
        <section class="panel">
          <div class="section-title"><h2>学习节奏</h2><p>每日预算</p></div>
          <div class="setting-group">
            ${settingRow("每天新词上限", "场景速记的 6 个锚词计入此上限；复习队列只会补充非锚词。", stepper("newPerDay", s.newPerDay, 0, 60))}
            ${settingRow("每日目标卡数", "用于首页圆环和连续学习统计。", stepper("dailyGoal", s.dailyGoal, 5, 200))}
            ${settingRow("目标记忆保持率", "越高，复习越频繁。90% 是大多数人的平衡点。", retentionSeg(s.retention))}
            ${settingRow("单次会话上限", "一次复习最多放多少张，避免疲劳。", stepper("sessionCap", s.sessionCap, 10, 120))}
          </div>
        </section>
        <section class="panel">
          <div class="section-title"><h2>训练方式</h2><p>提取难度</p></div>
          <div class="setting-group">
            ${settingRow("混合训练模式", "复习时在认词、听辨、语境、拼写之间切换，避免只认脸。", switchEl("mixed", s.mixed))}
            ${settingRow("自动播放单词发音", "进入卡片时自动播放英式发音。", switchEl("autoplay", s.autoplay))}
            ${settingRow("反馈音效", "答对/答错时播放轻提示音。", switchEl("sound", s.sound))}
          </div>
        </section>
        <section class="panel">
          <div class="section-title"><h2>词库范围</h2><p>新词来源</p></div>
          <div class="option-cards">${scopes.map(([id, title, desc]) => `<label class="option-card"><input type="radio" name="scope" value="${id}" data-setting="scope" ${s.scope === id ? "checked" : ""}><span class="oc-main"><b>${title}</b><span>${desc}</span></span><span class="oc-check"></span></label>`).join("")}</div>
        </section>
      </div>
      <div class="stack">
        <section class="panel">
          <div class="section-title"><h2>外观</h2><p>界面主题</p></div>
          <div class="seg" style="width:100%">${themes.map(([id, label]) => `<button class="${themeOf(s) === id ? "active" : ""}" style="flex:1" data-action="set-theme" data-theme="${id}">${label}</button>`).join("")}</div>
          <p style="margin:14px 0 0;font-size:11.5px;color:var(--muted);line-height:1.7">纸白适合白天，夜读降低亮度。跟随系统会随 macOS / iOS 外观自动切换。</p>
        </section>
        <section class="panel">
          <div class="section-title"><h2>数据</h2><p>只存在这台设备</p></div>
          <p style="margin:0 0 14px;font-size:11.5px;color:var(--muted);line-height:1.7">学习记录保存在浏览器 localStorage。换设备时导出 JSON，再在新设备导入即可。</p>
          <div class="data-actions">
            <button class="btn sm" data-action="export-data">${icon("download")}导出备份</button>
            <button class="btn sm" data-action="import-data">${icon("upload")}导入备份</button>
            <button class="btn sm danger" data-action="reset-data">${icon("trash")}清空进度</button>
          </div>
          <input type="file" id="importFile" accept="application/json,.json" hidden>
        </section>
        <section class="panel">
          <div class="section-title"><h2>快捷键</h2><p>键盘优先</p></div>
          <table class="shortcut-table">
            <tr><td>显示答案 / 继续</td><td><span class="kbd">Space</span></td></tr>
            <tr><td>选择选项</td><td><span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span><span class="kbd">4</span></td></tr>
            <tr><td>自评（认词）</td><td><span class="kbd">1</span>–<span class="kbd">4</span></td></tr>
            <tr><td>提交拼写</td><td><span class="kbd">Enter</span></td></tr>
            <tr><td>重听发音</td><td><span class="kbd">R</span></td></tr>
            <tr><td>退出学习</td><td><span class="kbd">Esc</span></td></tr>
          </table>
        </section>
        <section class="panel">
          <div class="section-title"><h2>关于词脉</h2><p>v1.0</p></div>
          <p style="margin:0;font-size:11.5px;color:var(--muted);line-height:1.8">26 个 PET 高频场景，每个场景 6 个锚词、一条记忆链、搭配与对比关系。词表来自 Cambridge B1 Preliminary 官方词表、Turtle Bay PET 词卡与「21 天攻克 PET 核心词汇」清单；仅用于个人学习，不用于商业用途。</p>
        </section>
      </div>
    </div>`;
  }

  function themeOf(settings) {
    return settings.theme || "auto";
  }

  function settingRow(title, desc, control) {
    return `<div class="setting-row"><div class="setting-copy"><b>${title}</b><p>${desc}</p></div><div class="setting-control">${control}</div></div>`;
  }

  function stepper(key, value, min, max) {
    return `<div class="stepper"><button type="button" data-action="step-setting" data-key="${key}" data-step="-1" aria-label="减少">−</button><output id="out-${key}">${value}</output><button type="button" data-action="step-setting" data-key="${key}" data-step="1" aria-label="增加">+</button></div>`;
  }

  function switchEl(key, checked) {
    return `<label class="switch"><input type="checkbox" data-setting="${key}" ${checked ? "checked" : ""} aria-label="${key}"><span></span></label>`;
  }

  function retentionSeg(value) {
    return `<div class="seg">${[0.85, 0.9, 0.95].map((v) => `<button class="${Math.abs(value - v) < 0.001 ? "active" : ""}" data-action="set-retention" data-value="${v}">${Math.round(v * 100)}%</button>`).join("")}</div>`;
  }

  // ======================================================================
  // Word drawer
  // ======================================================================

  function openWordDrawer(term) {
    const entry = core.word(term);
    if (!entry) return;
    const card = core.getCard(entry.w);
    const level = srs.mastery(card);
    const st = card.state;
    const stateText = st === "new" ? "未学习" : st === "learning" || st === "relearning" ? "学习中" : "复习中";
    const r = card.last ? srs.retrievability(card, Date.now()) : null;
    const scene = entry.scene ? core.scene(entry.scene) : null;
    const history = (card.history || []).slice(-8).reverse();

    const html = `<div class="drawer-head">
      <span class="pill ${level >= 3 ? "accent" : ""}">${core.masteryLabel(level)} · ${stateText}</span>
      <button class="icon-btn" data-action="close-drawer" aria-label="关闭">${icon("close")}</button>
    </div>
    <p class="eyebrow" style="margin-bottom:8px">${core.esc(entry.pos || "word")} ${entry.ket ? "· KET 基础" : "· PET"}</p>
    <div class="word-line"><h2 class="word-big">${core.esc(entry.w)}</h2><button class="icon-btn word-audio" data-action="play-word" data-w="${core.esc(entry.w)}" aria-label="播放">${icon("volume")}</button></div>
    <p style="margin:12px 0 0;font-family:var(--serif);font-size:24px;line-height:1.35">${core.esc(entry.zh)}</p>
    ${entry.def ? `<p style="margin:8px 0 0;font-size:12.5px;color:var(--muted);font-style:italic">${core.esc(entry.def)}</p>` : ""}
    ${entry.ex ? `<blockquote class="example-box" style="margin-top:20px"><p class="ex-en">${core.highlightExample(entry)}</p><div class="ex-tools"><button class="btn ghost sm" data-action="speak-text" data-text="${core.esc(entry.ex)}">${icon("headphones")}朗读例句</button></div></blockquote>` : ""}
    ${entry.fam && entry.fam.length ? `<div class="family-row"><span>同根词</span>${entry.fam.map((f) => `<span class="chip">${core.esc(f)}</span>`).join("")}</div>` : ""}
    ${scene ? `<div class="scene-ref" style="margin-top:18px">${icon("layers")}<span>场景</span><a href="#/scene/${scene.id}" data-action="go" data-href="#/scene/${scene.id}">${core.esc(scene.name)}</a></div>` : `<div class="scene-ref" style="margin-top:18px;color:var(--faint)">${icon("info")}<span>这个词还没有归入场景，仍会进入复习队列。</span></div>`}
    <div class="drawer-section">
      <h4>记忆状态</h4>
      <div class="stat-line"><span>稳定度 S</span><b>${card.s ? card.s.toFixed(1) + " 天" : "—"}</b></div>
      <div class="stat-line"><span>难度 D</span><b>${card.d ? card.d.toFixed(1) : "—"}</b></div>
      <div class="stat-line"><span>下次到期</span><b>${st === "new" ? "未安排" : core.dueLabel(card.due)}</b></div>
      <div class="stat-line"><span>现在记得的概率</span><b>${r == null ? "—" : Math.round(r * 100) + "%"}</b></div>
      <div class="stat-line"><span>复习 / 遗忘</span><b>${card.reps || 0} / ${card.lapses || 0}</b></div>
      <div class="drawer-actions">
        <button class="btn sm" data-action="review-word" data-w="${core.esc(entry.w)}">${icon("play")}立即复习</button>
        <button class="btn sm ghost" data-action="flag-word" data-w="${core.esc(entry.w)}">${card.flagged ? "取消标记" : "标为薄弱"}</button>
        <button class="btn sm ghost" data-action="mark-mastered" data-w="${core.esc(entry.w)}">标记已掌握</button>
      </div>
    </div>
    ${history.length ? `<div class="drawer-section"><h4>最近记录</h4>${history.map((h) => `<div class="history-row"><span class="h-dot g${h.g}"></span><span>${h.manual ? "手动掌握" : ["", "忘记", "模糊", "记得", "简单"][h.g] || "复习"}</span><span class="h-date">${new Date(h.t).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span></div>`).join("")}</div>` : ""}
    <div class="drawer-section" style="padding-top:14px"><button class="btn sm danger" data-action="reset-word" data-w="${core.esc(entry.w)}">重置此词</button></div>`;

    const drawer = document.getElementById("drawer");
    const scrim = document.getElementById("scrim");
    drawer.innerHTML = html;
    drawer.hidden = false;
    scrim.hidden = false;
    document.body.classList.add("no-scroll");
    drawer.scrollTop = 0;
  }

  // ======================================================================
  // 404
  // ======================================================================

  function renderNotFound() {
    return `<div style="padding:80px 0;text-align:center"><p class="eyebrow">404</p><h1 style="font-family:var(--serif);font-size:52px;font-weight:500;margin:0">这里没有词。</h1><p style="color:var(--muted);margin-top:10px">换一条路径，或者回到今日。</p><div style="margin-top:22px"><a class="btn primary" href="#/today" data-nav-link>回到今日</a></div></div>`;
  }

  global.PET.views = {
    renderToday,
    renderScenes,
    renderScene,
    renderLibrary,
    renderStats,
    renderSettings,
    openWordDrawer,
    renderNotFound,
    libraryData,
  };
})(window);
