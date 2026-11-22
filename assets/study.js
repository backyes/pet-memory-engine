/* 词脉 · study engine: scene lesson + spaced review */
(function (global) {
  "use strict";

  const core = global.PET.core;
  const srs = global.PET.srs;
  const $ = (sel) => document.querySelector(sel);

  let session = null;
  let timer = 0;
  let lastSentence = "";

  const GRADE_LABELS = { 1: "忘记", 2: "模糊", 3: "记得", 4: "简单" };
  const MODE_LABELS = { recall: "认词", choice: "选义", listen: "听辨", cloze: "语境", spell: "拼写", intro: "新词" };

  function icon(name) {
    return global.PET.icon(name);
  }

  function isOpen() {
    const el = $("#study");
    return !!el && !el.hidden;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function esc(value) {
    return core.esc(value);
  }

  function sceneById(id) {
    return core.scene(id);
  }

  function sceneNumber(id) {
    const i = core.scenes().findIndex((s) => s.id === id);
    return pad2(i + 1);
  }

  function sceneChainStep(scene, term) {
    if (!scene) return null;
    return (scene.chain || []).find((s) => s.w === term) || null;
  }

  function scenePair(scene, term) {
    if (!scene) return null;
    return (scene.pairs || []).find((p) => p.w === term) || null;
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
    const re = new RegExp(`(?<![A-Za-z])(${termForms(term).join("|")})(?![A-Za-z])`, "i");
    return esc(text).replace(re, "<mark>$1</mark>");
  }

  function blankSentence(text, term) {
    const re = new RegExp(`(?<![A-Za-z])${termForms(term).join("|")}(?![A-Za-z])`, "i");
    const match = re.exec(text);
    if (!match) return esc(text);
    return `${esc(text.slice(0, match.index))}<span class="blank"></span>${esc(text.slice(match.index + match[0].length))}`;
  }

  function fmtTimer(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function startTimer() {
    stopTimer();
    timer = global.setInterval(() => {
      const el = $("#studyTimer");
      if (el && session) el.textContent = fmtTimer(Date.now() - session.start);
    }, 1000);
  }

  function stopTimer() {
    if (timer) global.clearInterval(timer);
    timer = 0;
  }

  function openOverlay() {
    const el = $("#study");
    el.hidden = false;
    document.body.classList.add("no-scroll");
    const close = $("#studyClose");
    const sound = $("#studySound");
    if (close && !close.innerHTML.trim()) close.innerHTML = icon("close");
    if (sound && !sound.innerHTML.trim()) sound.innerHTML = icon("volume");
    $("#studyStage").scrollTop = 0;
    startTimer();
  }

  function closeOverlay() {
    const el = $("#study");
    if (!el) return;
    el.hidden = true;
    stopTimer();
    document.body.classList.remove("no-scroll");
    session = null;
    $("#studyStage").innerHTML = "";
    $("#studyFoot").innerHTML = "";
    if (global.PET.app) {
      global.PET.app.updateChrome();
      global.PET.app.renderRoute();
    }
  }

  function requestClose() {
    if (!session) {
      closeOverlay();
      return;
    }
    if (session.finished) {
      closeOverlay();
      return;
    }
    const hasProgress = session.type === "review"
      ? session.results.n > 0
      : session.phase !== "overview";
    if (!hasProgress) {
      closeOverlay();
      return;
    }
    global.PET.app.confirmModal({
      title: "退出本次学习？",
      text: session.type === "review"
        ? "已经作答的卡片会保留，但本轮进度不会计入会话总结。"
        : "本次场景速记还没有完成，退出后 6 个锚词不会加入复习计划。",
      confirmLabel: "退出",
      danger: true,
      onConfirm: closeOverlay,
    });
  }

  // ---------------------------------------------------------------------
  // Review session
  // ---------------------------------------------------------------------

  function startReview(mode, options) {
    const opts = options || {};
    const items = opts.items || core.buildQueue(mode);
    if (!items.length) {
      global.PET.app.toast(mode === "review" ? "现在没有到期卡片" : "今天没有待学卡片");
      return;
    }
    session = {
      type: "review",
      mode,
      queue: items.slice(),
      idx: 0,
      current: null,
      results: { n: 0, ok: 0, new: 0, ms: 0 },
      start: Date.now(),
      cardStart: 0,
      requeued: {},
      finished: false,
      sceneFocus: opts.sceneFocus || null,
    };
    openOverlay();
    $("#studyMode").textContent = mode === "free" ? "自由练习" : mode === "weak" ? "错词修复" : "间隔复习";
    renderNextReview();
  }

  function startSingle(term) {
    startReview("single", { items: [{ w: term, kind: "review" }] });
  }

  function startSceneReview(sceneId) {
    const now = Date.now();
    const scene = sceneById(sceneId);
    if (!scene) return;
    const due = core.sceneStrongWords(sceneId)
      .filter((entry) => {
        const card = core.getCard(entry.w);
        return card.state !== "new" && card.due <= now;
      })
      .map((entry) => ({ w: entry.w, kind: "review" }));
    if (!due.length) {
      global.PET.app.toast("这个场景暂时没有到期词，可以先再走一遍记忆链");
      return;
    }
    startReview("scene", { items: due, sceneFocus: sceneId });
  }

  function pickMode(card, entry) {
    if (card.state === "new") return "intro";
    if (!core.settings().mixed) return "recall";
    const m = srs.mastery(card);
    let pool;
    if (m <= 1) pool = ["recall", "choice", "listen"];
    else if (m === 2) pool = ["recall", "listen", "spell"];
    else if (m === 3) pool = ["recall", "cloze", "spell"];
    else pool = ["cloze", "spell", "listen"];
    pool = pool.filter((mode) => {
      if (mode === "cloze") return core.clozeAvailable(entry);
      if (mode === "spell") return core.spellable(entry);
      return true;
    });
    if (!pool.length) return "recall";
    const seed = core.hashString(`${entry.w}|${card.reps || 0}|${core.dayKey()}`);
    return pool[seed % pool.length];
  }

  function renderNextReview() {
    if (!session) return;
    if (session.idx >= session.queue.length) {
      finishReview();
      return;
    }
    const item = session.queue[session.idx];
    const entry = core.word(item.w);
    if (!entry) {
      session.idx += 1;
      renderNextReview();
      return;
    }
    const card = core.getCard(entry.w);
    const mode = pickMode(card, entry);
    session.current = {
      w: entry.w,
      entry,
      mode,
      phase: mode === "intro" ? "intro" : mode === "recall" ? "front" : "question",
      cardBefore: card,
      options: [],
      choice: null,
      hintUsed: false,
      answered: false,
      result: null,
      started: Date.now(),
      requeue: false,
    };
    session.cardStart = Date.now();
    if (mode === "choice" || mode === "listen") session.current.options = makeMeaningOptions(entry);
    if (mode === "cloze") session.current.options = makeWordOptions(entry);
    updateReviewTop();
    renderReview();
  }

  function updateReviewTop() {
    if (!session) return;
    const total = session.queue.length;
    const done = Math.min(session.idx, total);
    const label = session.current ? MODE_LABELS[session.current.mode] || "复习" : "复习";
    $("#studyMode").textContent = label;
    $("#studyCount").textContent = `${Math.min(session.idx + 1, total)} / ${total}`;
    $("#studyProgress").style.width = `${(done / Math.max(1, total)) * 100}%`;
    $("#studyFoot").innerHTML = `<span class="foot-note">${session.results.n} 张已完成 · 正确 ${session.results.ok}</span><span class="shortcuts"><span><span class="kbd">Space</span> 显示 / 继续</span><span><span class="kbd">1–4</span> 选择</span><span><span class="kbd">R</span> 重听</span><span><span class="kbd">Esc</span> 退出</span></span>`;
  }

  function renderReview() {
    if (!session || !session.current) return;
    const cur = session.current;
    const stage = $("#studyStage");
    let html = "";
    if (cur.mode === "intro") html = renderIntro(cur);
    else if (cur.mode === "recall") html = cur.phase === "front" ? renderRecallFront(cur) : renderRecallAnswer(cur);
    else if (cur.mode === "choice") html = renderChoice(cur);
    else if (cur.mode === "listen") html = renderListen(cur);
    else if (cur.mode === "cloze") html = renderCloze(cur);
    else if (cur.mode === "spell") html = renderSpell(cur);
    else html = renderRecallFront(cur);
    stage.innerHTML = html;
    stage.scrollTop = 0;
    updateReviewTop();

    if (cur.mode === "intro" && core.settings().autoplay) {
      global.setTimeout(() => global.PET.app.playWord(cur.w), 180);
    }
    if (cur.mode === "listen" && cur.phase === "question") {
      global.setTimeout(() => global.PET.app.playWord(cur.w), 220);
    }
    if (cur.mode === "spell" && cur.phase === "question") {
      const input = stage.querySelector("#spellInput");
      if (input) global.setTimeout(() => input.focus(), 60);
    }
  }

  function sceneKicker(entry) {
    if (!entry.scene) return "";
    const scene = sceneById(entry.scene);
    return scene ? `<span class="dotsep"></span><span class="scene-chip">${esc(scene.name)}</span>` : "";
  }

  function renderIntro(cur) {
    const e = cur.entry;
    const scene = e.scene ? sceneById(e.scene) : null;
    const step = scene ? sceneChainStep(scene, e.w) : null;
    return `<article class="study-card">
      <div class="study-kicker"><span>NEW WORD</span><span class="dotsep"></span><span>${pad2(session.results.new + 1)}</span>${sceneKicker(e)}</div>
      <div class="word-line"><h1 class="word-big">${esc(e.w)}</h1><button class="icon-btn word-audio" data-study="replay" aria-label="播放发音">${icon("volume")}</button></div>
      <div class="word-meta">${e.pos ? `<span class="pos">${esc(e.pos)}</span>` : ""}<span>${e.ket ? "KET 基础" : "PET 核心"}</span></div>
      <div class="answer-block" style="margin-top:22px;padding-top:0;border-top:0">
        <div class="answer-main"><span class="answer-zh">${esc(e.zh)}</span></div>
        ${e.def ? `<p class="answer-def">${esc(e.def)}</p>` : ""}
        ${step ? `<div class="example-box" style="margin-top:20px"><p class="ex-en">${markWord(step.en, e.w)}</p><p class="ex-zh">${esc(step.zh)}</p><div class="ex-tools"><button class="btn ghost sm" data-study="speak-step">${icon("headphones")}朗读场景句</button></div></div>` : e.ex ? `<div class="example-box" style="margin-top:20px"><p class="ex-en">${core.highlightExample(e)}</p><div class="ex-tools"><button class="btn ghost sm" data-study="speak-example">${icon("headphones")}朗读例句</button></div></div>` : ""}
        ${scene ? `<div class="scene-ref">${icon("layers")}<span>场景 ${sceneNumber(scene.id)}</span><a href="#/scene/${scene.id}" data-study="go-scene" data-id="${scene.id}">${esc(scene.name)}</a></div>` : ""}
      </div>
      <button class="btn primary lg reveal-btn" data-study="intro-next">记住了，开始检测 <span class="kbd">Enter</span></button>
    </article>`;
  }

  function renderWordHead(cur, opts) {
    const e = cur.entry;
    return `<div class="study-kicker"><span>${esc(opts.label)}</span><span class="dotsep"></span><span>${esc(opts.count || "")}</span>${sceneKicker(e)}</div>
      <div class="word-line"><h1 class="word-big">${esc(e.w)}</h1><button class="icon-btn word-audio" data-study="replay" aria-label="播放发音">${icon("volume")}</button></div>
      <div class="word-meta">${e.pos ? `<span class="pos">${esc(e.pos)}</span>` : ""}<span>第 ${(cur.cardBefore.reps || 0) + 1} 次相遇</span></div>`;
  }

  function renderRecallFront(cur) {
    const e = cur.entry;
    return `<article class="study-card">
      ${renderWordHead(cur, { label: "RECALL", count: "认词" })}
      <p class="recall-hint">在脑中说出它的中文意思，再翻面核对。</p>
      <button class="btn primary lg reveal-btn" data-study="reveal">显示答案 <span class="kbd">Space</span></button>
      ${e.scene ? `<p class="hero-hint" style="margin-top:20px">场景：${esc(sceneById(e.scene) ? sceneById(e.scene).name : "")}</p>` : ""}
    </article>`;
  }

  function renderRecallAnswer(cur) {
    const e = cur.entry;
    const preview = srs.preview(cur.cardBefore, Date.now(), { retention: core.settings().retention });
    const scene = e.scene ? sceneById(e.scene) : null;
    return `<article class="study-card">
      ${renderWordHead(cur, { label: "RECALL", count: "认词" })}
      <div class="answer-block">
        <div class="answer-main"><span class="answer-zh">${esc(e.zh)}</span>${e.pos ? `<span class="answer-pos">${esc(e.pos)}</span>` : ""}</div>
        ${e.def ? `<p class="answer-def">${esc(e.def)}</p>` : ""}
        ${e.ex ? `<div class="example-box"><p class="ex-en">${core.highlightExample(e)}</p><div class="ex-tools"><button class="btn ghost sm" data-study="speak-example">${icon("headphones")}朗读例句</button></div></div>` : ""}
        ${e.fam && e.fam.length ? `<div class="family-row"><span>同根词</span>${e.fam.map((f) => `<span class="chip">${esc(f)}</span>`).join("")}</div>` : ""}
        ${scene ? `<div class="scene-ref">${icon("layers")}<span>场景</span><a href="#/scene/${scene.id}" data-study="go-scene" data-id="${scene.id}">${esc(scene.name)}</a>${sceneChainStep(scene, e.w) ? `<span>· 第 ${pad2(scene.anchors.indexOf(e.w) + 1)} 步</span>` : ""}</div>` : ""}
      </div>
      <div class="grade-grid">${preview.map((p) => `<button class="grade-btn g${p.grade}" data-study="grade" data-grade="${p.grade}"><b>${GRADE_LABELS[p.grade]}</b><span>${core.formatInterval(p.interval)}</span><span class="g-key">${p.grade}</span></button>`).join("")}</div>
    </article>`;
  }

  function renderChoice(cur) {
    const e = cur.entry;
    const feedback = cur.phase === "feedback";
    return `<article class="study-card">
      <div class="study-kicker"><span>MEANING</span><span class="dotsep"></span><span>选义</span>${sceneKicker(e)}</div>
      <div class="word-line"><h1 class="word-big">${esc(e.w)}</h1><button class="icon-btn word-audio" data-study="replay" aria-label="播放发音">${icon("volume")}</button></div>
      <div class="word-meta">${e.pos ? `<span class="pos">${esc(e.pos)}</span>` : ""}<span>选择正确的中文释义</span></div>
      <div class="option-grid">${cur.options.map((o, i) => optionHtml(o, i, cur)).join("")}</div>
      ${feedback ? feedbackHtml(cur, `正确答案：${esc(cur.entry.zh)}`) : `<p class="hero-hint" style="margin-top:18px">按 <span class="kbd">1</span>–<span class="kbd">4</span> 选择</p>`}
    </article>`;
  }

  function renderListen(cur) {
    const feedback = cur.phase === "feedback";
    return `<article class="study-card">
      <div class="study-kicker"><span>LISTEN</span><span class="dotsep"></span><span>听辨</span>${sceneKicker(cur.entry)}</div>
      <button class="listen-orb ${feedback ? "" : "listen-pulse"}" data-study="replay" aria-label="播放发音">${icon("volume")}</button>
      <p class="listen-hint">点击重听 · 按 R 也可以 · 再选择它的意思</p>
      <div class="option-grid">${cur.options.map((o, i) => optionHtml(o, i, cur)).join("")}</div>
      ${feedback ? feedbackHtml(cur, `正确答案：${esc(cur.entry.zh)}`) : `<p class="hero-hint" style="margin-top:18px">按 <span class="kbd">1</span>–<span class="kbd">4</span> 选择</p>`}
    </article>`;
  }

  function renderCloze(cur) {
    const e = cur.entry;
    const feedback = cur.phase === "feedback";
    return `<article class="study-card">
      <div class="study-kicker"><span>CONTEXT</span><span class="dotsep"></span><span>语境</span>${sceneKicker(e)}</div>
      <p class="cloze-sentence">${core.clozeText(e)}</p>
      <p class="cloze-zh">从上下文判断，哪一个词最合适？</p>
      <div class="option-grid">${cur.options.map((o, i) => optionHtml(o, i, cur)).join("")}</div>
      ${feedback ? feedbackHtml(cur, `正确答案：${esc(e.w)} · ${esc(e.zh)}`) : `<p class="hero-hint" style="margin-top:18px">按 <span class="kbd">1</span>–<span class="kbd">4</span> 选择</p>`}
    </article>`;
  }

  function renderSpell(cur) {
    const e = cur.entry;
    const feedback = cur.phase === "feedback";
    const letters = Array.from(e.w);
    const first = letters[0] ? letters[0].toLowerCase() : "";
    const slots = letters.map((ch, i) => {
      if (ch === " " || ch === "-") return `<span class="space">${ch === "-" ? "-" : ""}</span>`;
      const reveal = cur.hintUsed && i === 0;
      return `<span class="${reveal ? "given" : ""}">${reveal ? esc(first) : ""}</span>`;
    }).join("");
    return `<article class="study-card">
      <div class="study-kicker"><span>SPELL</span><span class="dotsep"></span><span>拼写</span>${sceneKicker(e)}</div>
      <div class="word-line"><h1 class="word-big" style="font-size:clamp(30px,5vw,44px)">${esc(e.zh)}</h1><button class="icon-btn word-audio" data-study="replay" aria-label="播放发音">${icon("volume")}</button></div>
      <div class="word-meta">${e.pos ? `<span class="pos">${esc(e.pos)}</span>` : ""}<span>${e.w.replace(/\s/g, "").length} 个字母 · 根据中文和发音拼出单词</span></div>
      <div class="spell-box">
        <div class="spell-slots">${slots}</div>
        <input class="spell-input" id="spellInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入单词" ${feedback ? "disabled" : ""} value="${feedback ? esc(e.w) : ""}">
        ${feedback ? feedbackHtml(cur, `正确拼写：${esc(e.w)} · ${esc(e.zh)}`) : `<div class="spell-actions"><button class="btn primary" data-study="check">检查 <span class="kbd">Enter</span></button><button class="btn ghost sm" data-study="hint">${icon("spark")}首字母提示</button><span class="hint-note">使用提示后，本题最高记为「模糊」</span></div>`}
      </div>
    </article>`;
  }

  function optionHtml(o, i, cur) {
    const answered = cur.phase === "feedback";
    const cls = answered ? (o.correct ? "correct" : i === cur.choice ? "wrong" : "") : "";
    return `<button class="option ${cls}" data-study="option" data-index="${i}" ${answered ? "disabled" : ""}><span class="opt-key">${String.fromCharCode(65 + i)}</span><span class="opt-text">${esc(o.text)}</span></button>`;
  }

  function feedbackHtml(cur, answerText) {
    const ok = cur.result && cur.result.ok;
    const next = cur.result ? cur.result.result.card : null;
    const interval = next ? core.formatInterval(new Date(next.due).getTime() - Date.now()) : "";
    const scene = cur.entry.scene ? sceneById(cur.entry.scene) : null;
    return `<div class="feedback ${ok ? "ok" : "bad"}">
      <div class="feedback-title">${ok ? icon("check") + "答对了" : icon("x") + "再记一次"}</div>
      <p class="feedback-answer">${answerText}</p>
      ${cur.entry.ex ? `<p class="feedback-answer" style="font-family:var(--serif);font-size:16px;color:var(--muted)">${core.highlightExample(cur.entry)}</p>` : ""}
      <div class="feedback-meta">${scene ? `<span>场景 · ${esc(scene.name)}</span>` : ""}<span>下次复习 · ${interval}</span>${cur.entry.fam && cur.entry.fam.length ? `<span>同根 · ${esc(cur.entry.fam.slice(0, 2).join(" / "))}</span>` : ""}</div>
      <button class="btn primary" data-study="next">继续 <span class="kbd">Enter</span></button>
    </div>`;
  }

  // ---------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------

  function makeMeaningOptions(entry) {
    const seed = core.hashString(`${entry.w}|meaning|${core.dayKey()}`);
    const used = new Set([entry.zh]);
    const pick = (pool) => {
      const out = [];
      core.shuffle(pool, seed + out.length).forEach((w) => {
        if (out.length >= 3) return;
        if (!w.zh || used.has(w.zh)) return;
        used.add(w.zh);
        out.push(w);
      });
      return out;
    };
    let list = pick(core.words().filter((w) => w.w !== entry.w && w.scene === entry.scene && w.pos === entry.pos)).slice(0, 3);
    if (list.length < 3) list = list.concat(pick(core.words().filter((w) => w.w !== entry.w && w.theme === entry.theme && w.pos === entry.pos))).slice(0, 3);
    if (list.length < 3) list = list.concat(pick(core.words().filter((w) => w.w !== entry.w && w.pos === entry.pos))).slice(0, 3);
    if (list.length < 3) list = list.concat(pick(core.words().filter((w) => w.w !== entry.w))).slice(0, 3);
    const options = list.slice(0, 3).map((w) => ({ text: w.zh, correct: false }));
    options.push({ text: entry.zh, correct: true });
    return core.shuffle(options, seed + 2);
  }

  function makeWordOptions(entry) {
    const seed = core.hashString(`${entry.w}|word|${core.dayKey()}`);
    const used = new Set([entry.w]);
    const pick = (pool) => {
      const out = [];
      core.shuffle(pool, seed + out.length).forEach((w) => {
        if (out.length >= 3) return;
        if (used.has(w.w)) return;
        used.add(w.w);
        out.push(w);
      });
      return out;
    };
    let list = pick(core.words().filter((w) => w.w !== entry.w && w.scene === entry.scene && w.pos === entry.pos)).slice(0, 3);
    if (list.length < 3) list = list.concat(pick(core.words().filter((w) => w.w !== entry.w && w.theme === entry.theme && w.pos === entry.pos))).slice(0, 3);
    if (list.length < 3) list = list.concat(pick(core.words().filter((w) => w.w !== entry.w && w.pos === entry.pos))).slice(0, 3);
    if (list.length < 3) list = list.concat(pick(core.words().filter((w) => w.w !== entry.w))).slice(0, 3);
    const options = list.slice(0, 3).map((w) => ({ text: w.w, correct: false, w: w.w }));
    options.push({ text: entry.w, correct: true, w: entry.w });
    return core.shuffle(options, seed + 2);
  }

  // ---------------------------------------------------------------------
  // Answering
  // ---------------------------------------------------------------------

  function recordAnswer(grade, ok, mode) {
    const cur = session.current;
    if (!cur || cur.answered) return null;
    cur.answered = true;
    const ms = Date.now() - session.cardStart;
    const res = core.answer(cur.w, grade, mode || cur.mode, ms, ok);
    cur.result = res;
    session.results.n += 1;
    session.results.ms += ms;
    if (ok) session.results.ok += 1;
    if (res.wasNew) session.results.new += 1;
    global.PET.app.tone(ok ? "ok" : "bad");
    if (grade === 1 && (session.requeued[cur.w] || 0) < 2 && session.queue.length < 80) {
      session.requeued[cur.w] = (session.requeued[cur.w] || 0) + 1;
      const pos = Math.min(session.queue.length, session.idx + 3);
      session.queue.splice(pos, 0, { w: cur.w, kind: "review", requeue: true });
    }
    return res;
  }

  function chooseOption(index) {
    const cur = session.current;
    if (!cur || cur.phase !== "question" || cur.answered) return;
    const opt = cur.options[index];
    if (!opt) return;
    cur.choice = index;
    cur.phase = "feedback";
    recordAnswer(opt.correct ? 3 : 1, opt.correct, cur.mode);
    renderReview();
  }

  function revealRecall() {
    const cur = session.current;
    if (!cur || cur.mode !== "recall" || cur.phase !== "front") return;
    cur.phase = "answer";
    renderReview();
  }

  function gradeRecall(grade) {
    const cur = session.current;
    if (!cur || cur.mode !== "recall" || cur.phase !== "answer" || cur.answered) return;
    const res = recordAnswer(grade, grade >= 2, "recall");
    if (!res) return;
    const interval = core.formatInterval(new Date(res.card.due).getTime() - Date.now());
    global.PET.app.toast(`下次复习 · ${interval}`);
    global.setTimeout(advance, 220);
  }

  function checkSpell() {
    const cur = session.current;
    if (!cur || cur.mode !== "spell" || cur.phase !== "question") return;
    const input = $("#spellInput");
    if (!input) return;
    const value = core.normalizeAnswer(input.value);
    if (!value) {
      global.PET.app.toast("先输入你记得的拼写");
      return;
    }
    const correct = value === core.normalizeAnswer(cur.entry.w);
    const grade = correct ? (cur.hintUsed ? 2 : 3) : 1;
    cur.phase = "feedback";
    cur.answered = false;
    recordAnswer(grade, correct, "spell");
    renderReview();
  }

  function showHint() {
    const cur = session.current;
    if (!cur || cur.mode !== "spell" || cur.phase !== "question") return;
    cur.hintUsed = true;
    renderReview();
    const input = $("#spellInput");
    if (input) input.focus();
  }

  function advance() {
    if (!session) return;
    session.idx += 1;
    if (session.idx >= session.queue.length) {
      finishReview();
      return;
    }
    renderNextReview();
  }

  function finishReview() {
    if (!session) return;
    session.finished = true;
    const r = session.results;
    const acc = r.n ? Math.round((r.ok / r.n) * 100) : 0;
    const due = core.dueCards().length;
    core.recordSession({
      type: "review",
      start: session.start,
      end: Date.now(),
      answered: r.n,
      ok: r.ok,
      newWords: r.new,
      ms: r.ms,
      mode: session.mode,
    });
    $("#studyMode").textContent = "完成";
    $("#studyCount").textContent = `${r.n} 张`;
    $("#studyProgress").style.width = "100%";
    $("#studyFoot").innerHTML = `<span class="foot-note">本轮完成 · ${core.formatDuration(r.ms)}</span><span class="shortcuts"><span><span class="kbd">Enter</span> 回到今日</span></span>`;
    $("#studyStage").innerHTML = `<div class="study-card lesson-summary">
      <p class="ls-eyebrow">SESSION COMPLETE</p>
      <h2>${r.n} 张，<br>${r.ok} 张记住了。</h2>
      <p>${acc >= 85 ? "这一轮的保持率很稳。间隔会继续拉长，让记忆变得更省力。" : "有几张还需要再见几次。别急，下一次出现会更短。"}</p>
      <div class="ls-grid">
        <div><b>${acc}%</b><span>正确率</span></div>
        <div><b>${r.new}</b><span>新词</span></div>
        <div><b>${core.formatDuration(r.ms)}</b><span>用时</span></div>
      </div>
      <div class="ls-actions">
        <button class="btn primary" data-study="go-today">回到今日 <span class="kbd">Enter</span></button>
        ${due ? `<button class="btn ghost" data-study="review-again">继续复习 ${due} 张</button>` : ""}
        <button class="btn ghost" data-study="go-stats">查看数据</button>
      </div>
    </div>`;
    global.PET.app.updateChrome();
  }

  // ---------------------------------------------------------------------
  // Scene lesson
  // ---------------------------------------------------------------------

  function startScene(id) {
    const scene = sceneById(id);
    if (!scene) return;
    session = {
      type: "scene",
      scene,
      phase: "overview",
      anchorIndex: 0,
      quizIndex: 0,
      quiz: {},
      quizOrder: [],
      start: Date.now(),
      anchorStart: 0,
      finished: false,
      results: { correct: 0, total: 6, ms: 0, newWords: 0 },
    };
    openOverlay();
    $("#studyMode").textContent = "场景速记";
    renderSceneOverview();
  }

  function updateSceneTop(progress) {
    if (!session) return;
    $("#studyMode").textContent = session.phase === "quiz" ? "链路回忆" : session.phase === "anchor" ? "锚点学习" : session.phase === "summary" ? "完成" : "场景速记";
    $("#studyCount").textContent = session.phase === "overview" ? `场景 ${sceneNumber(session.scene.id)} / 26` : session.phase === "summary" ? "已完成" : `${session.phase === "anchor" ? session.anchorIndex + 1 : session.quizIndex + 1} / 6`;
    $("#studyProgress").style.width = `${progress}%`;
    $("#studyFoot").innerHTML = `<span class="foot-note">${esc(session.scene.name)}</span><span class="shortcuts"><span><span class="kbd">Enter</span> 继续</span><span><span class="kbd">R</span> 重听</span><span><span class="kbd">Esc</span> 退出</span></span>`;
  }

  function renderSceneOverview() {
    const scene = session.scene;
    session.phase = "overview";
    updateSceneTop(0);
    $("#studyStage").innerHTML = `<article class="study-card">
      <div class="study-kicker"><span>SCENE ${sceneNumber(scene.id)}</span><span class="dotsep"></span><span>${esc(core.themeLabel(scene.theme))}</span><span class="dotsep"></span><span>6 个锚词</span></div>
      <div class="lesson-scene-title"><h2>${esc(scene.name)}</h2><p>${esc(scene.en)}</p></div>
      <p class="lesson-intro">${esc(scene.intro)}</p>
      <div class="lesson-chain">${scene.chain.map((step, i) => `<div class="lesson-chain-line"><span class="lcn">${pad2(i + 1)}</span><div><div class="lct">${markWord(step.en, step.w)}</div><div class="lcz">${esc(step.zh)}</div></div></div>`).join("")}</div>
      <div class="lesson-start">
        <button class="btn accent lg" data-study="scene-start">开始锚点学习 ${icon("arrowright")}</button>
        <button class="btn ghost" data-study="scene-speak">${icon("headphones")}朗读场景</button>
        <span class="note">先看懂这条线，再记 6 个词。</span>
      </div>
    </article>`;
  }

  function startAnchors() {
    session.phase = "anchor";
    session.anchorIndex = 0;
    session.anchorStart = Date.now();
    renderAnchor();
  }

  function renderAnchor() {
    const scene = session.scene;
    const term = scene.anchors[session.anchorIndex];
    const entry = core.word(term);
    if (!entry) { nextAnchor(); return; }
    const step = sceneChainStep(scene, term) || { en: entry.ex || "", zh: "" };
    const pair = scenePair(scene, term);
    session.phase = "anchor";
    updateSceneTop((session.anchorIndex / 12) * 100);
    $("#studyStage").innerHTML = `<article class="study-card">
      <div class="study-kicker"><span>ANCHOR ${pad2(session.anchorIndex + 1)}</span><span class="dotsep"></span><span>${esc(scene.name)}</span><span class="dotsep"></span><span>${session.anchorIndex + 1} / 6</span></div>
      <div class="anchor-card">
        <div class="anchor-left">
          <div class="word-line"><h1 class="word-big">${esc(entry.w)}</h1><button class="icon-btn word-audio" data-study="replay-anchor" data-w="${esc(entry.w)}" aria-label="播放发音">${icon("volume")}</button></div>
          <div class="word-meta">${entry.pos ? `<span class="pos">${esc(entry.pos)}</span>` : ""}<span>${entry.ket ? "KET 基础" : "PET 核心"}</span></div>
          <p style="margin:18px 0 0;font-family:var(--serif);font-size:25px;line-height:1.3">${esc(entry.zh)}</p>
          ${entry.def ? `<p style="margin:7px 0 0;font-size:12px;color:var(--muted);font-style:italic">${esc(entry.def)}</p>` : ""}
          ${pair ? `<div class="anchor-pair"><b>${esc(pair.phrase)}</b><span>${esc(pair.zh)}</span></div>` : ""}
        </div>
        <div class="anchor-right">
          <p class="anchor-sentence">${markWord(step.en, term)}</p>
          ${step.zh ? `<p class="anchor-sentence-zh">${esc(step.zh)}</p>` : ""}
          ${entry.ex && entry.ex !== step.en ? `<p class="anchor-sentence-zh" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">${core.highlightExample(entry)}</p>` : ""}
          <div class="anchor-progress">${scene.anchors.map((_, i) => `<i class="${i <= session.anchorIndex ? "on" : ""}"></i>`).join("")}</div>
          <div class="lesson-start" style="margin-top:22px">
            ${session.anchorIndex > 0 ? `<button class="btn ghost sm" data-study="anchor-prev">上一个</button>` : ""}
            <button class="btn primary" data-study="anchor-next">${session.anchorIndex === 5 ? "进入链路回忆" : "下一个"} <span class="kbd">Enter</span></button>
            <button class="btn ghost sm" data-study="replay-anchor" data-w="${esc(entry.w)}">${icon("volume")}发音</button>
          </div>
        </div>
      </div>
    </article>`;
    if (core.settings().autoplay) global.setTimeout(() => global.PET.app.playWord(term), 160);
  }

  function nextAnchor() {
    if (session.anchorIndex < 5) {
      session.anchorIndex += 1;
      renderAnchor();
    } else {
      startQuiz();
    }
  }

  function prevAnchor() {
    if (session.anchorIndex > 0) {
      session.anchorIndex -= 1;
      renderAnchor();
    }
  }

  function startQuiz() {
    session.phase = "quiz";
    session.quizIndex = 0;
    session.quiz = {};
    const seed = core.hashString(`${session.scene.id}|quiz|${core.dayKey()}`);
    session.quizOrder = core.shuffle(session.scene.anchors.slice(), seed);
    renderQuiz();
  }

  function renderQuiz() {
    const scene = session.scene;
    const term = session.quizOrder[session.quizIndex];
    const entry = core.word(term);
    const step = sceneChainStep(scene, term);
    const answered = session.quiz[term] !== undefined;
    const picked = session.quiz[`${term}:picked`];
    const options = core.shuffle(scene.anchors.slice(), core.hashString(`${term}|options|${scene.id}`));
    session.phase = "quiz";
    updateSceneTop(50 + (session.quizIndex / 12) * 100);
    $("#studyStage").innerHTML = `<article class="study-card quiz-wrap">
      <div class="study-kicker"><span>CHAIN RECALL</span><span class="dotsep"></span><span>第 ${pad2(scene.anchors.indexOf(term) + 1)} 步</span><span class="dotsep"></span><span>${esc(scene.name)}</span></div>
      <p class="quiz-sentence">${step ? blankSentence(step.en, term) : ""}</p>
      ${answered && step && step.zh ? `<p class="quiz-zh">${esc(step.zh)}</p>` : ""}
      <p class="hero-hint" style="margin-top:18px">这一步应该是哪个词？</p>
      <div class="word-chips">${options.map((w, i) => {
        let cls = "";
        if (answered) {
          if (w === term) cls = "correct";
          else if (w === picked) cls = "wrong";
        }
        return `<button class="word-chip ${cls}" data-study="quiz-option" data-w="${esc(w)}" data-index="${i}" ${answered ? "disabled" : ""}>${i + 1}. ${esc(w)}</button>`;
      }).join("")}</div>
      ${answered ? `<div class="feedback ${picked === term ? "ok" : "bad"}">
        <div class="feedback-title">${picked === term ? icon("check") + "接上了" : icon("x") + "再看一眼这条链"}</div>
        <p class="feedback-answer">${esc(term)} · ${esc(entry ? entry.zh : "")}</p>
        <div class="feedback-meta"><span>第 ${pad2(session.quizIndex + 1)} 步 / 6</span><span>${picked === term ? "记忆链 +1" : "稍后会再遇到它"}</span></div>
        <button class="btn primary" data-study="quiz-next">继续 <span class="kbd">Enter</span></button>
      </div>` : ""}
    </article>`;
  }

  function chooseQuiz(word) {
    const term = session.quizOrder[session.quizIndex];
    if (session.quiz[term] !== undefined) return;
    const correct = word === term;
    session.quiz[term] = correct;
    session.quiz[`${term}:picked`] = word;
    if (correct) session.results.correct += 1;
    renderQuiz();
  }

  function nextQuiz() {
    const term = session.quizOrder[session.quizIndex];
    if (session.quiz[term] === undefined) return;
    if (session.quizIndex < 5) {
      session.quizIndex += 1;
      renderQuiz();
    } else {
      finishScene();
    }
  }

  function finishScene() {
    session.phase = "summary";
    session.finished = true;
    session.results.ms = Date.now() - session.start;
    const scene = session.scene;
    const now = Date.now();
    const perWord = Math.round(session.results.ms / 6);
    const newCards = [];
    const rows = scene.anchors.map((term) => {
      const before = core.getCard(term);
      const wasNew = before.state === "new";
      const correct = Boolean(session.quiz[term]);
      if (wasNew) {
        const grade = correct ? 3 : 1;
        core.answer(term, grade, "scene", perWord, correct);
        newCards.push(term);
      }
      const after = core.getCard(term);
      return { term, entry: core.word(term), correct, wasNew, card: after };
    });
    session.results.newWords = newCards.length;
    session.wrongRows = rows.filter((r) => !r.correct);
    core.markSceneDone(scene.id, {
      correct: session.results.correct,
      total: 6,
      ms: session.results.ms,
    });
    core.recordSession({
      type: "scene",
      start: session.start,
      end: now,
      answered: newCards.length,
      ok: rows.filter((r) => r.correct).length,
      newWords: newCards.length,
      ms: session.results.ms,
      mode: "scene",
      scene: scene.id,
    });
    updateSceneTop(100);
    $("#studyMode").textContent = "完成";
    $("#studyCount").textContent = "6 个锚词";
    $("#studyFoot").innerHTML = `<span class="foot-note">${esc(scene.name)} · ${core.formatDuration(session.results.ms)}</span><span class="shortcuts"><span><span class="kbd">Enter</span> 返回场景</span></span>`;
    $("#studyStage").innerHTML = `<article class="study-card lesson-summary">
      <p class="ls-eyebrow">SCENE COMPLETE · ${sceneNumber(scene.id)} / 26</p>
      <h2>${esc(scene.name)}，<br>走完了。</h2>
      <p>${session.results.correct >= 5 ? "六步链路基本接上了。接下来交给间隔复习，让它们从「场景里记得」变成「随时想得起」。" : "链路里还有几步不太稳。错词已经进入复习队列，下一次会以更短的间隔回来。"}</p>
      <div class="ls-grid">
        <div><b>${session.results.correct}/6</b><span>链路正确</span></div>
        <div><b>${session.results.newWords}</b><span>新词入库</span></div>
        <div><b>${core.formatDuration(session.results.ms)}</b><span>用时</span></div>
      </div>
      <div class="ls-words">${rows.map((r) => `<div class="ls-word-row"><b>${esc(r.term)}</b><span>${esc(r.entry ? r.entry.zh : "")}</span><span class="${r.correct ? "ok" : "bad"}">${r.correct ? "接上" : "再记"}</span><span class="next">${r.wasNew ? "新词 · " : ""}${core.dueLabel(r.card.due)}</span></div>`).join("")}</div>
      <div class="ls-actions">
        <button class="btn primary" data-study="scene-go">返回场景 <span class="kbd">Enter</span></button>
        ${session.wrongRows && session.wrongRows.length ? `<button class="btn accent" data-study="scene-fix">巩固 ${session.wrongRows.length} 个错词</button>` : ""}
        <button class="btn ghost" data-study="scene-next">再学一个场景</button>
        ${core.dueCards().length ? `<button class="btn ghost" data-study="review-again">复习到期 ${core.dueCards().length} 张</button>` : ""}
      </div>
    </article>`;
    global.PET.app.updateChrome();
  }

  function nextUnlearnedScene() {
    const list = core.scenes();
    const idx = list.findIndex((s) => s.id === session.scene.id);
    for (let i = 1; i <= list.length; i += 1) {
      const s = list[(idx + i) % list.length];
      const st = core.sceneStats(s.id);
      if (st.learned < 6) return s;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Actions from the stage
  // ---------------------------------------------------------------------

  function handleStudyAction(el, event) {
    const action = el.dataset.study;
    if (!action) return;
    if (action === "reveal") { revealRecall(); return; }
    if (action === "grade") { gradeRecall(Number(el.dataset.grade)); return; }
    if (action === "option") { chooseOption(Number(el.dataset.index)); return; }
    if (action === "next") { advance(); return; }
    if (action === "check") { checkSpell(); return; }
    if (action === "hint") { showHint(); return; }
    if (action === "replay") { replay(); return; }
    if (action === "intro-next") {
      if (!session || !session.current) return;
      session.current.mode = "choice";
      session.current.phase = "question";
      session.current.options = makeMeaningOptions(session.current.entry);
      session.current.started = Date.now();
      session.cardStart = Date.now();
      renderReview();
      return;
    }
    if (action === "replay-anchor") {
      const w = el.dataset.w || session.scene.anchors[session.anchorIndex];
      global.PET.app.playWord(w);
      return;
    }
    if (action === "speak-step") {
      const term = session.current.entry.w;
      const scene = session.current.entry.scene ? sceneById(session.current.entry.scene) : null;
      const step = scene ? sceneChainStep(scene, term) : null;
      global.PET.app.speak(step ? step.en : session.current.entry.ex);
      return;
    }
    if (action === "speak-example") {
      global.PET.app.speak(session.current.entry.ex);
      return;
    }
    if (action === "go-scene") {
      const id = el.dataset.id;
      closeOverlay();
      global.location.hash = `#/scene/${id}`;
      return;
    }
    if (action === "go-today") { closeOverlay(); global.location.hash = "#/today"; return; }
    if (action === "go-stats") { closeOverlay(); global.location.hash = "#/stats"; return; }
    if (action === "review-again") { closeOverlay(); startReview("review"); return; }

    if (action === "scene-start") { startAnchors(); return; }
    if (action === "scene-speak") { global.PET.app.speak(session.scene.chain.map((s) => s.en).join(" ")); return; }
    if (action === "anchor-prev") { prevAnchor(); return; }
    if (action === "anchor-next") { nextAnchor(); return; }
    if (action === "quiz-option") { chooseQuiz(el.dataset.w); return; }
    if (action === "quiz-next") { nextQuiz(); return; }
    if (action === "scene-go") { const id = session.scene.id; closeOverlay(); global.location.hash = `#/scene/${id}`; return; }
    if (action === "scene-fix") {
      const items = (session.wrongRows || []).map((r) => ({ w: r.term, kind: "review" }));
      closeOverlay();
      if (items.length) startReview("review", { items });
      return;
    }
    if (action === "scene-next") {
      const next = nextUnlearnedScene();
      if (!next) { global.PET.app.toast("所有场景都学过了"); return; }
      closeOverlay();
      global.setTimeout(() => startScene(next.id), 80);
      return;
    }
  }

  function replay() {
    if (!session) return;
    if (session.type === "scene") {
      if (session.phase === "anchor") {
        global.PET.app.playWord(session.scene.anchors[session.anchorIndex]);
      } else if (session.phase === "quiz") {
        const term = session.quizOrder[session.quizIndex];
        global.PET.app.playWord(term);
      } else if (session.phase === "overview") {
        global.PET.app.speak(session.scene.chain.map((s) => s.en).join(" "));
      }
      return;
    }
    if (session.current) global.PET.app.playWord(session.current.w);
  }

  function onKey(event) {
    if (!isOpen()) return;
    if (!$("#modalWrap").hidden) return;
    const tag = (event.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea";
    if (typing) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (session.type === "review" && session.current && session.current.mode === "spell" && session.current.phase === "question") checkSpell();
        else if (session.type === "review" && session.current && session.current.phase === "feedback") advance();
        return;
      }
      return;
    }
    if (event.repeat) return;
    if (session.type === "scene") {
      if (session.phase === "overview") {
        if (event.key === "Enter" || event.code === "Space") { event.preventDefault(); startAnchors(); }
        else if (event.key.toLowerCase() === "r") { event.preventDefault(); replay(); }
      } else if (session.phase === "anchor") {
        if (event.key === "ArrowRight" || event.key === "Enter") { event.preventDefault(); nextAnchor(); }
        else if (event.key === "ArrowLeft") { event.preventDefault(); prevAnchor(); }
        else if (event.key.toLowerCase() === "r" || event.code === "Space") { event.preventDefault(); replay(); }
      } else if (session.phase === "quiz") {
        const term = session.quizOrder[session.quizIndex];
        const answered = session.quiz[term] !== undefined;
        if (answered) {
          if (event.key === "Enter") { event.preventDefault(); nextQuiz(); }
        } else if (/^[1-6]$/.test(event.key)) {
          event.preventDefault();
          const idx = Number(event.key) - 1;
          const options = core.shuffle(session.scene.anchors.slice(), core.hashString(`${term}|options|${session.scene.id}`));
          chooseQuiz(options[idx]);
        } else if (event.key.toLowerCase() === "r") { event.preventDefault(); replay(); }
      } else if (session.phase === "summary") {
        if (event.key === "Enter") { event.preventDefault(); const id = session.scene.id; closeOverlay(); global.location.hash = `#/scene/${id}`; }
      }
      return;
    }
    const cur = session.current;
    if (!cur) return;
    if (cur.mode === "intro") {
      if (event.key === "Enter" || event.code === "Space") { event.preventDefault(); session.current.mode = "choice"; session.current.phase = "question"; session.current.options = makeMeaningOptions(session.current.entry); session.cardStart = Date.now(); renderReview(); }
      else if (event.key.toLowerCase() === "r") { event.preventDefault(); replay(); }
      return;
    }
    if (cur.phase === "front") {
      if (event.key === "Enter" || event.code === "Space") { event.preventDefault(); revealRecall(); }
    } else if (cur.phase === "answer" && cur.mode === "recall") {
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); gradeRecall(Number(event.key)); }
    } else if (cur.phase === "question") {
      if (cur.mode === "spell") {
        if (event.key === "Enter") { event.preventDefault(); checkSpell(); }
        else if (event.key.toLowerCase() === "r") { event.preventDefault(); replay(); }
      } else if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        chooseOption(Number(event.key) - 1);
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        replay();
      }
    } else if (cur.phase === "feedback") {
      if (event.key === "Enter" || event.code === "Space") { event.preventDefault(); advance(); }
    }
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------

  document.addEventListener("click", (event) => {
    if (!isOpen()) return;
    const el = event.target.closest("[data-study]");
    if (el) {
      event.preventDefault();
      handleStudyAction(el, event);
    }
  });

  document.addEventListener("keydown", onKey);
  const stage = document.getElementById("studyStage");
  if (stage) stage.setAttribute("tabindex", "-1");

  global.PET.study = {
    startReview,
    startSingle,
    startScene,
    startSceneReview,
    requestClose,
    replay,
    isOpen,
    __getSession: () => session,
  };
})(window);
