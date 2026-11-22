#!/usr/bin/env node
/* Run: node tests/content.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

global.window = global;
const mem = {};
global.localStorage = { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } };
require("../assets/data.js");
require("../assets/scenes.js");
require("../assets/srs.js");
const core = require("../assets/core.js");
core.init();

assert.strictEqual(core.words().length, 3283);
assert.strictEqual(core.meta().core, 1245);
assert.ok(core.scenes().length === 26, "26 scenes");
assert.ok(core.sceneCoverage() >= 900, `scene coverage ${core.sceneCoverage()}`);

const seen = new Set();
for (const scene of core.scenes()) {
  assert.strictEqual(scene.anchors.length, 6, `${scene.id}: six anchors`);
  assert.strictEqual(scene.chain.length, 6, `${scene.id}: six chain lines`);
  assert.ok(scene.name && scene.en && scene.intro && scene.tagline, `${scene.id}: metadata`);
  scene.anchors.forEach((anchor, i) => {
    assert.ok(!seen.has(anchor), `${anchor} duplicated across scenes`);
    seen.add(anchor);
    const entry = core.word(anchor);
    assert.ok(entry, `${scene.id}: ${anchor} missing from data`);
    assert.strictEqual(scene.chain[i].w, anchor, `${scene.id}: chain ${i} target`);
    const sentence = scene.chain[i].en.toLowerCase();
    const forms = (entry.forms && entry.forms.length ? entry.forms : [anchor]).map((x) => x.toLowerCase());
    const ok = forms.some((form) => {
      const safe = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<![a-z])${safe}(?![a-z])`).test(sentence);
    });
    assert.ok(ok, `${scene.id}: sentence contains a form of ${anchor}`);
  });
  for (const pair of scene.pairs || []) assert.ok(scene.anchors.includes(pair.w), `${scene.id}: pair word`);
}

// Sense overrides used by scenes must be present.
const senses = {
  revise: "复习", shower: "阵雨", gate: "登机口", waste: "垃圾",
  mark: "批改", rent: "房租", taste: "品尝", fry: "煎",
  reception: "前台", facility: "设施", security: "安检",
};
for (const [term, needle] of Object.entries(senses)) {
  const entry = core.word(term);
  assert.ok(entry && entry.zh.includes(needle), `${term}: scene sense ${needle}`);
}

// All words have a Chinese gloss; every audio path exists.
let missingAudio = 0;
for (const entry of core.words()) {
  assert.ok(entry.zh, `${entry.w}: zh`);
  if (!fs.existsSync(path.join(__dirname, "..", "audio", entry.audio))) missingAudio += 1;
}
assert.strictEqual(missingAudio, 0, "all audio files exist");
console.log(`content.test.js: 26 scenes, 156 anchors, ${core.sceneCoverage()} core words mapped, ${core.words().length} entries — passed`);
