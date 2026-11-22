/* 词脉 · app shell, icons, audio, routing */
(function (global) {
  "use strict";

  const core = global.PET.core;

  // ---------------------------------------------------------------------
  // Icons (inline SVG, 24×24, stroke currentColor)
  // ---------------------------------------------------------------------

  const ICONS = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    scenes: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    stats: '<path d="M3 3v18h18"/><path d="M7 15v3M12 9v9M17 5v13"/>',
    settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
    play: '<path d="M8 5v14l11-7Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    volume: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/>',
    headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="7" rx="2"/><rect x="17" y="14" width="4" height="7" rx="2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    arrowleft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    arrowright: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.4 6.7"/><path d="M20 4v7h-7"/>',
    shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m5.6 5.6 2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flame: '<path d="M12 3c1 4 4 6 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 0-8Z"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="m6 7 1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h.01M11 14h2M15 14h.01M17 14h.01"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    waveform: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>',
  };

  const ICON_ALIASES = { "arrow-left": "arrowleft", "arrow-right": "arrowright" };

  function icon(name, cls) {
    const body = ICONS[ICON_ALIASES[name] || name] || ICONS.info;
    return `<svg class="${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  // ---------------------------------------------------------------------
  // UI state + helpers
  // ---------------------------------------------------------------------

  const ui = {
    library: { q: "", filter: "all", tier: "core", sort: "default", limit: 60 },
    sceneFilter: "all",
    sceneExpanded: false,
    confirm: null,
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function toast(message) {
    const stack = $("#toastStack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    stack.appendChild(el);
    global.setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity .2s";
      global.setTimeout(() => el.remove(), 220);
    }, 2200);
  }

  function closeDrawer() {
    const drawer = $("#drawer");
    const scrim = $("#scrim");
    if (!drawer) return;
    drawer.hidden = true;
    drawer.innerHTML = "";
    if (scrim) scrim.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function closeModal() {
    const wrap = $("#modalWrap");
    if (!wrap) return;
    wrap.hidden = true;
    $("#modal").innerHTML = "";
    ui.confirm = null;
    document.body.classList.remove("no-scroll");
  }

  function confirmModal(opts) {
    const wrap = $("#modalWrap");
    const modal = $("#modal");
    if (!wrap || !modal) return;
    modal.innerHTML = `<h3>${core.esc(opts.title)}</h3><p>${opts.html || core.esc(opts.text || "")}</p>
      <div class="modal-actions"><button class="btn ghost" data-action="modal-cancel">取消</button><button class="btn ${opts.danger ? "danger" : "primary"}" data-action="modal-confirm">${core.esc(opts.confirmLabel || "确认")}</button></div>`;
    wrap.hidden = false;
    document.body.classList.add("no-scroll");
    ui.confirm = opts.onConfirm || null;
    const btn = modal.querySelector('[data-action="modal-confirm"]');
    if (btn) btn.focus();
  }

  // ---------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------

  function resolvedTheme() {
    const pref = core.settings().theme || "auto";
    if (pref !== "auto") return pref;
    return global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "paper";
  }

  function applyTheme() {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
    const btn = $("#themeBtn");
    if (btn) btn.innerHTML = icon(theme === "night" ? "sun" : "moon");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "night" ? "#101310" : "#f3efe6");
  }

  // ---------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------

  const audioCache = new Map();
  let audioCtx = null;

  function audioEl(entry) {
    if (!entry) return null;
    if (!audioCache.has(entry.w)) {
      const el = new Audio(`audio/${entry.audio}`);
      el.preload = "auto";
      audioCache.set(entry.w, el);
    }
    return audioCache.get(entry.w);
  }

  function playWord(term, opts) {
    const entry = core.word(term);
    if (!entry) return;
    const el = audioEl(entry);
    if (!el) return;
    try {
      el.currentTime = 0;
      el.playbackRate = (opts && opts.rate) || 1;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    } catch (err) { /* autoplay blocked */ }
  }

  function tone(kind) {
    if (!core.settings().sound) return;
    try {
      audioCtx = audioCtx || new (global.AudioContext || global.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(kind === "ok" ? 660 : 220, now);
      if (kind === "ok") osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      else osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (err) { /* no audio context */ }
  }

  function speak(text, rate) {
    if (!text || !("speechSynthesis" in global)) {
      toast("当前浏览器不支持语音朗读");
      return;
    }
    try {
      global.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
      u.rate = rate || 0.92;
      u.pitch = 1;
      const voices = global.speechSynthesis.getVoices();
      const v = voices.find((x) => /en-GB/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      global.speechSynthesis.speak(u);
    } catch (err) { /* ignore */ }
  }

  // ---------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------

  function currentRoute() {
    const hash = (global.location.hash || "").replace(/^#\/?/, "");
    if (!hash) return { name: "today" };
    const parts = hash.split("/").filter(Boolean);
    return { name: parts[0], id: parts.slice(1).join("/") };
  }

  function renderRoute() {
    closeDrawer();
    const route = currentRoute();
    const view = $("#view");
    if (!view) return;
    let html = "";
    let nav = route.name;
    if (route.name === "today") html = global.PET.views.renderToday();
    else if (route.name === "scenes") html = global.PET.views.renderScenes();
    else if (route.name === "scene") html = global.PET.views.renderScene(decodeURIComponent(route.id));
    else if (route.name === "library") html = global.PET.views.renderLibrary();
    else if (route.name === "stats") html = global.PET.views.renderStats();
    else if (route.name === "settings") html = global.PET.views.renderSettings();
    else if (route.name === "word") {
      html = global.PET.views.renderLibrary();
      nav = "library";
    } else html = global.PET.views.renderNotFound();

    view.innerHTML = html;
    if (route.name === "scene") nav = "scenes";
    $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
    updateChrome();
    if (route.name === "word") {
      global.setTimeout(() => global.PET.views.openWordDrawer(decodeURIComponent(route.id)), 30);
    }
    global.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function updateChrome() {
    const snap = core.snapshot();
    const streak = $("#streakValue");
    if (streak) streak.textContent = snap.streak;
    const pill = $("#streakPill");
    if (pill) pill.title = `连续学习 ${snap.streak} 天`;
    const foot = $("#footStats");
    if (foot) foot.textContent = `已学 ${snap.learned} 词 · 已掌握 ${snap.mastered} · 连续 ${snap.streak} 天 · 本地存储`;
    fillIcons();
  }

  function fillIcons() {
    $$("[data-icon]").forEach((el) => {
      if (el.dataset.filled) return;
      el.innerHTML = icon(el.dataset.icon);
      el.dataset.filled = "1";
    });
  }

  function refresh() {
    updateChrome();
    const view = $("#view");
    if (!view) return;
    const route = currentRoute();
    if (route.name === "today") view.innerHTML = global.PET.views.renderToday();
    else if (route.name === "library") view.innerHTML = global.PET.views.renderLibrary();
    else if (route.name === "scenes") view.innerHTML = global.PET.views.renderScenes();
    else if (route.name === "stats") view.innerHTML = global.PET.views.renderStats();
    else if (route.name === "scene") view.innerHTML = global.PET.views.renderScene(decodeURIComponent(route.id));
  }

  // ---------------------------------------------------------------------
  // Export / import
  // ---------------------------------------------------------------------

  function downloadBackup() {
    const text = core.exportJson();
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `词脉备份-${core.dayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    global.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("备份已导出");
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      confirmModal({
        title: "导入学习备份？",
        text: "当前设备上的学习记录会被备份中的记录替换。建议先导出当前进度。",
        confirmLabel: "替换并导入",
        onConfirm: () => {
          try {
            const result = core.importJson(text);
            closeModal();
            toast(`已导入 ${result.cards} 个词的学习记录`);
            renderRoute();
          } catch (err) {
            closeModal();
            toast(err.message || "导入失败，文件格式不正确");
          }
        },
      });
    };
    reader.readAsText(file);
  }

  // ---------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------

  function handleAction(el, event) {
    const action = el.dataset.action;
    if (!action) return;

    if (action === "go") {
      const href = el.dataset.href;
      if (href) global.location.hash = href;
      return;
    }
    if (action === "start-scene") {
      event.preventDefault();
      global.PET.study.startScene(el.dataset.id);
      return;
    }
    if (action === "start-review") {
      global.PET.study.startReview(el.dataset.mode || "daily");
      return;
    }
    if (action === "review-scene") {
      global.PET.study.startSceneReview(el.dataset.id);
      return;
    }
    if (action === "speak-scene") {
      const scene = core.scene(el.dataset.id);
      if (scene) speak(scene.chain.map((s) => s.en).join(" "));
      return;
    }
    if (action === "speak-text") {
      speak(el.dataset.text, 0.88);
      return;
    }
    if (action === "play-word") {
      event.stopPropagation();
      playWord(el.dataset.w);
      return;
    }
    if (action === "open-word") {
      global.PET.views.openWordDrawer(el.dataset.w);
      return;
    }
    if (action === "close-drawer") {
      closeDrawer();
      if (currentRoute().name === "word") global.location.hash = "#/library";
      return;
    }
    if (action === "scene-filter") {
      ui.sceneFilter = el.dataset.filter;
      $("#view").innerHTML = global.PET.views.renderScenes();
      return;
    }
    if (action === "expand-scene-words") {
      ui.sceneExpanded = !ui.sceneExpanded;
      const route = currentRoute();
      if (route.name === "scene") $("#view").innerHTML = global.PET.views.renderScene(decodeURIComponent(route.id));
      return;
    }
    if (action === "lib-filter") {
      ui.library.filter = el.dataset.filter;
      ui.library.limit = 60;
      $("#view").innerHTML = global.PET.views.renderLibrary();
      return;
    }
    if (action === "lib-tier") {
      ui.library.tier = el.dataset.tier;
      ui.library.limit = 60;
      $("#view").innerHTML = global.PET.views.renderLibrary();
      return;
    }
    if (action === "lib-load") {
      ui.library.limit += 80;
      $("#view").innerHTML = global.PET.views.renderLibrary();
      return;
    }
    if (action === "lib-clear") {
      ui.library.q = "";
      $("#view").innerHTML = global.PET.views.renderLibrary();
      const input = $("#libSearch");
      if (input) input.focus();
      return;
    }
    if (action === "step-setting") {
      const key = el.dataset.key;
      const step = Number(el.dataset.step);
      const current = core.settings()[key];
      const limits = { newPerDay: [0, 60], dailyGoal: [5, 200], sessionCap: [10, 120] };
      const [min, max] = limits[key] || [0, 999];
      const next = Math.min(max, Math.max(min, current + step));
      core.updateSettings({ [key]: next });
      const out = $("#out-" + key);
      if (out) out.textContent = next;
      updateChrome();
      return;
    }
    if (action === "set-retention") {
      core.updateSettings({ retention: Number(el.dataset.value) });
      $("#view").innerHTML = global.PET.views.renderSettings();
      toast(`目标保持率 ${Math.round(Number(el.dataset.value) * 100)}%`);
      return;
    }
    if (action === "set-theme") {
      core.updateSettings({ theme: el.dataset.theme });
      applyTheme();
      $("#view").innerHTML = global.PET.views.renderSettings();
      return;
    }
    if (action === "export-data") {
      downloadBackup();
      return;
    }
    if (action === "import-data") {
      const input = $("#importFile");
      if (input) input.click();
      return;
    }
    if (action === "reset-data") {
      confirmModal({
        title: "清空所有学习进度？",
        text: "所有卡片、复习记录、连续学习的统计都会被删除，无法恢复。词库和场景内容不受影响。",
        confirmLabel: "清空进度",
        danger: true,
        onConfirm: () => {
          core.resetAll();
          closeModal();
          updateChrome();
          renderRoute();
          toast("学习进度已清空");
        },
      });
      return;
    }
    if (action === "mark-mastered") {
      core.markMastered(el.dataset.w);
      toast("已标记为掌握");
      global.PET.views.openWordDrawer(el.dataset.w);
      updateChrome();
      return;
    }
    if (action === "flag-word") {
      const flagged = core.toggleFlag(el.dataset.w);
      toast(flagged ? "已加入薄弱词" : "已取消标记");
      global.PET.views.openWordDrawer(el.dataset.w);
      return;
    }
    if (action === "reset-word") {
      const term = el.dataset.w;
      confirmModal({
        title: `重置「${term}」？`,
        text: "这个词的复习历史、稳定度和到期时间会被清除，重新变回新词。",
        confirmLabel: "重置",
        danger: true,
        onConfirm: () => {
          core.resetWord(term);
          closeModal();
          global.PET.views.openWordDrawer(term);
          updateChrome();
        },
      });
      return;
    }
    if (action === "review-word") {
      closeDrawer();
      global.PET.study.startSingle(el.dataset.w);
      return;
    }
    if (action === "modal-cancel") {
      closeModal();
      return;
    }
    if (action === "modal-confirm") {
      const fn = ui.confirm;
      closeModal();
      if (typeof fn === "function") fn();
      return;
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const el = event.target.closest("[data-action]");
      if (el) handleAction(el, event);
    });

    document.addEventListener("input", (event) => {
      if (event.target.id === "libSearch") {
        ui.library.q = event.target.value;
        ui.library.limit = 60;
        const cursor = event.target.selectionStart;
        const view = $("#view");
        view.innerHTML = global.PET.views.renderLibrary();
        const input = $("#libSearch");
        if (input) {
          input.focus();
          const pos = Math.min(cursor, input.value.length);
          input.setSelectionRange(pos, pos);
        }
      }
    });

    document.addEventListener("change", (event) => {
      const el = event.target;
      if (el.id === "libSort") {
        ui.library.sort = el.value;
        ui.library.limit = 60;
        $("#view").innerHTML = global.PET.views.renderLibrary();
        return;
      }
      if (el.id === "importFile") {
        handleImportFile(el.files && el.files[0]);
        el.value = "";
        return;
      }
      const key = el.dataset && el.dataset.setting;
      if (key) {
        let value;
        if (el.type === "checkbox") value = el.checked;
        else value = el.value;
        if (key === "scope") value = String(value);
        core.updateSettings({ [key]: value });
        if (key === "scope") {
          toast(`词库范围已切换为 ${core.scopeLabel(value)}`);
        }
        if (key === "sound" && value) tone("ok");
      }
    });

    global.addEventListener("hashchange", renderRoute);

    const themeBtn = $("#themeBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const next = resolvedTheme() === "night" ? "paper" : "night";
        core.updateSettings({ theme: next });
        applyTheme();
        if (currentRoute().name === "settings") $("#view").innerHTML = global.PET.views.renderSettings();
      });
    }

    const mq = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq && mq.addEventListener) {
      mq.addEventListener("change", () => {
        if ((core.settings().theme || "auto") === "auto") applyTheme();
      });
    }

    const studyClose = $("#studyClose");
    if (studyClose) studyClose.addEventListener("click", () => global.PET.study.requestClose());
    const studySound = $("#studySound");
    if (studySound) studySound.addEventListener("click", () => global.PET.study.replay());
    const scrim = $("#scrim");
    if (scrim) scrim.addEventListener("click", () => {
      const route = currentRoute();
      closeDrawer();
      if (route.name === "word") global.location.hash = "#/library";
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!$("#modalWrap").hidden) { closeModal(); return; }
        if (!$("#drawer").hidden) {
          const route = currentRoute();
          closeDrawer();
          if (route.name === "word") global.location.hash = "#/library";
          return;
        }
        if (global.PET.study.isOpen()) {
          event.preventDefault();
          global.PET.study.requestClose();
          return;
        }
      }
      if (global.PET.study.isOpen()) return;
      const tag = (event.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || event.target.isContentEditable;
      if (typing) return;
      const target = event.target;
      const typingTarget = target && target.closest && target.closest("button, a, input, select, textarea, [contenteditable]");
      if (event.code === "Space" && currentRoute().name === "today" && !event.metaKey && !event.ctrlKey && !typingTarget) {
        const scene = core.nextScene();
        if (scene) {
          event.preventDefault();
          global.PET.study.startScene(scene.id);
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------

  function init() {
    try {
      core.init();
    } catch (err) {
      console.error(err);
      const view = $("#view");
      if (view) view.innerHTML = `<div style="padding:60px 0;text-align:center"><h1 style="font-family:var(--serif)">词库加载失败</h1><p style="color:var(--muted)">${core.esc(err.message || String(err))}</p></div>`;
      return;
    }
    global.PET.ui = ui;
    applyTheme();
    fillIcons();
    bindEvents();
    renderRoute();
    updateChrome();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  // public API used by study/views
  global.PET.icon = icon;
  global.PET.ui = ui;
  global.PET.app = {
    toast,
    closeDrawer,
    closeModal,
    confirmModal,
    playWord,
    tone,
    speak,
    refresh,
    renderRoute,
    updateChrome,
    applyTheme,
    refreshIcons: fillIcons,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
