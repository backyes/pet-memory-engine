#!/usr/bin/env python3
"""Build the runtime dataset for 词脉 · PET 记忆引擎.

Sources (from the sibling project `pet-vocab-starship`, built in earlier sessions):
  - data/vocab.json          rich word cards: zh / def / example / theme / audio / KET flag
  - sources/maimemo-pet21.csv the "21 天攻克 PET 核心词汇" list

Output:
  - assets/data.js           window.PET_DATA (all words + core flag + study helpers)
  - audio/*.mp3              only the audio needed by the dataset
  - docs/data-report.json    build statistics
"""
from __future__ import annotations

import csv
import json
import os
import re
import shutil
import sys
from collections import defaultdict, Counter
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC = os.path.join(os.path.dirname(APP), "pet-vocab-starship")

# Scene-specific senses that the source gloss omits.
GLOSS_EXTRA = {
    "shower": "淋浴；阵雨",
    "gate": "大门；登机口",
    "taste": "味道；品尝",
    "check-in": "值机；登记入住",
    "check out": "退房；结账离开",
    "revise": "复习；温习；修改",
    "waste": "浪费；垃圾；废弃物",
    "mark": "分数；记号；批改",
    "rent": "租用；房租",
    "fry": "煎；炒；油炸",
    "course": "课程；一道菜",
    "reception": "接待；前台",
    "facility": "设施；设备",
    "security": "安全；安检",
}

# A scene may use a sense the source definition does not mention.
DEF_EXTRA = {
    "revise": "study again before a test; to change something",
    "waste": "to use too much of something; things you throw away",
    "mark": "a score; to check and score schoolwork",
    "rent": "to pay to use something; the money you pay for a home",
    "taste": "the flavour of food; to try food",
    "fry": "to cook food in hot oil",
    "course": "a set of lessons; one part of a meal",
    "reception": "the desk where guests check in",
    "facility": "a place or service built for a purpose",
    "security": "being safe; the place where bags are checked at an airport",
    "check-in": "the desk where you sign in at an airport or hotel",
    "check out": "to leave a hotel after paying",
}

POS_EXTRA = {
    "waste": "n./v.",
    "mark": "n./v.",
    "rent": "v./n.",
    "taste": "n./v.",
    "check-in": "n.",
    "check out": "phr. v.",
}

THEMES = {
    "daily": "日常",
    "food": "饮食",
    "travel": "出行",
    "school": "学习",
    "health": "健康",
    "nature": "自然",
    "feelings": "情绪",
    "tech": "科技",
    "sport": "运动",
    "city": "城市",
    "culture": "文化",
    "people": "人际",
}

SUFFIXES = [
    # ordered longest-first so that "ation" wins over "tion"
    "ation", "ition", "itive", "ative", "ition", "ment", "ness", "ance",
    "ence", "able", "ible", "ious", "ous", "ity", "ive", "ial", "al",
    "ful", "less", "ism", "ist", "ing", "ed", "er", "or", "ly", "ty",
    "ion", "ant", "ent", "es", "s", "y",
]


def norm_zh(text: str) -> str:
    text = (text or "").replace("\r", " ").replace("\n", "；")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"[；;]{2,}", "；", text)
    return text


def _single_forms(w: str) -> set[str]:
    forms = {w}
    if w.endswith("y") and len(w) > 2 and w[-2] not in "aeiou":
        forms.add(w[:-1] + "ies")
        forms.add(w[:-1] + "ied")
    if w.endswith("e"):
        forms.add(w + "d")
        forms.add(w + "s")
        forms.add(w[:-1] + "ing")
    else:
        forms.add(w + "s")
        forms.add(w + "ed")
        forms.add(w + "ing")
        # stop / stopped / stopping
        if (
            len(w) > 2
            and w[-1] not in "aeiou"
            and w[-2] in "aeiou"
            and w[-3] not in "aeiou"
        ):
            forms.add(w + w[-1] + "ed")
            forms.add(w + w[-1] + "ing")
    # common irregulars for the rare cases they matter
    irregular = {
        "be": ["is", "are", "was", "were", "been", "being"],
        "go": ["went", "gone", "goes"],
        "do": ["did", "done", "does"],
        "have": ["had", "has", "having"],
        "make": ["made", "makes"],
        "take": ["took", "taken", "takes"],
        "get": ["got", "gotten", "gets"],
        "give": ["gave", "given", "gives"],
        "come": ["came", "comes"],
        "see": ["saw", "seen", "sees"],
        "eat": ["ate", "eaten", "eats"],
        "run": ["ran", "runs"],
        "buy": ["bought", "buys"],
        "bring": ["brought", "brings"],
        "think": ["thought", "thinks"],
        "teach": ["taught", "teaches"],
        "catch": ["caught", "catches"],
        "child": ["children"],
        "person": ["people"],
        "man": ["men"],
        "woman": ["women"],
        "foot": ["feet"],
        "tooth": ["teeth"],
        "mouse": ["mice"],
        "life": ["lives"],
        "knife": ["knives"],
        "leaf": ["leaves"],
        "shelf": ["shelves"],
    }
    forms.update(irregular.get(w, []))
    return forms


def word_forms(word: str) -> list[str]:
    """Inflected surface forms that may appear in the example or scene sentence."""
    w = word.lower().strip()
    if " " in w:
        parts = w.split(" ")
        head, tail = parts[0], " ".join(parts[1:])
        forms = {w}
        for form in _single_forms(head):
            forms.add(f"{form} {tail}")
        # noun phrases pluralise the last word too
        if tail.endswith(("s", "sh", "ch", "x")):
            forms.add(f"{head} {tail}es")
        else:
            forms.add(f"{head} {tail}s")
        return sorted(forms, key=len, reverse=True)
    if "-" in w:
        return [w]
    return sorted(_single_forms(w), key=len, reverse=True)


def make_blank(example: str, forms: list[str]) -> str:
    if not example:
        return ""
    for form in forms:
        pattern = re.compile(r"(?<![A-Za-z])" + re.escape(form) + r"(?![A-Za-z])", re.I)
        if pattern.search(example):
            return pattern.sub("___", example, count=1)
    return ""


def base_candidates(word: str) -> set[str]:
    w = word.lower()
    cands: set[str] = set()
    if len(w) < 4:
        return cands
    for suf in SUFFIXES:
        if not w.endswith(suf):
            continue
        b = w[: -len(suf)]
        if len(b) < 3:
            continue
        if suf in {"s", "es"} and len(b) < 4:
            continue
        cands.add(b)
        # restore a silent -e (create -> creation, arrive -> arrival)
        if suf not in {"y", "s", "es", "ed", "ing", "ly", "er", "or", "ist", "ism"}:
            cands.add(b + "e")
        # happy -> happiness, vary -> various, easy -> easily
        if b.endswith("i") and suf in {"ous", "ness", "ly"}:
            cands.add(b[:-1] + "y")
        # stop -> stopped / stopping
        if suf in {"ed", "ing"} and len(b) > 2 and b[-1] == b[-2]:
            cands.add(b[:-1])
        # important -> importance, different -> difference
        if suf in {"ance", "ence"}:
            cands.add(b + "ant")
            cands.add(b + "ent")
    cands.discard(w)
    return cands


FUNCTION_POS = {"det.", "pron.", "prep.", "conj.", "int."}
# Pairs that suffix stripping gets wrong; better to show no family than a false one.
STOP_PAIRS = {
    ("fine", "final"), ("fast", "fasten"), ("care", "career"),
    ("corn", "corner"), ("her", "here"), ("hers", "here"),
    ("apart", "apartment"), ("universe", "university"),
    ("story", "store"), ("press", "presentation"),
    ("both", "bother"), ("car", "carry"), ("as", "assist"),
}


def build_families(words: list[dict]) -> dict[str, list[str]]:
    """Link a word to its siblings via safe suffix-stripping candidates."""
    wordset = {w["w"].lower(): w for w in words if " " not in w["w"]}
    graph: dict[str, set[str]] = defaultdict(set)
    for entry in words:
        word = entry["w"].lower()
        if " " in word:
            continue
        for cand in base_candidates(word):
            base = wordset.get(cand)
            if not base or cand == word:
                continue
            if base.get("pos") in FUNCTION_POS:
                continue
            if (cand, word) in STOP_PAIRS or (word, cand) in STOP_PAIRS:
                continue
            graph[word].add(cand)
            graph[cand].add(word)
    # connected components (bounded size)
    seen: set[str] = set()
    families: dict[str, list[str]] = {}
    for word in wordset:
        if word in seen:
            continue
        stack = [word]
        comp = []
        seen.add(word)
        while stack:
            cur = stack.pop()
            comp.append(wordset[cur]["w"])
            if len(comp) > 12:
                break
            for nxt in graph.get(cur, ()):
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        if len(comp) > 1:
            comp.sort(key=lambda x: (len(x), x))
            for item in comp:
                siblings = [x for x in comp if x != item][:6]
                families[item.lower()] = siblings
    return families


def main() -> int:
    vocab_path = os.path.join(SRC, "data", "vocab.json")
    core_path = os.path.join(SRC, "sources", "maimemo-pet21.csv")
    official_path = os.path.join(SRC, "sources", "pet-official-full.json")
    audio_src = os.path.join(SRC, "audio")

    with open(vocab_path, encoding="utf-8") as fh:
        payload = json.load(fh)
    raw = payload["words"]

    with open(core_path, encoding="utf-8", newline="") as fh:
        core_rows = [row[0].strip().lower() for row in csv.reader(fh) if row and row[0].strip()]
    core_order = list(dict.fromkeys(core_rows))
    core_set = set(core_order)

    # Official Cambridge topic lists give us trustworthy semantic groups.
    with open(official_path, encoding="utf-8") as fh:
        official = json.load(fh)
    topic_terms: dict[str, set[str]] = {}
    for topic in official.get("topicLists", []):
        for term in topic.get("terms", []):
            clean = re.sub(r"\s*\([^)]*\)", "", str(term).lower()).strip()
            clean = re.sub(r"\s*/\s*.*$", "", clean).strip()
            clean = re.sub(r"^(the|a|an)\s+", "", clean)
            if len(clean) >= 3:
                topic_terms.setdefault(clean, set()).add(topic["id"])

    families = build_families(raw)

    words = []
    missing_audio = []
    missing_core = [w for w in core_order if w not in {x["w"].lower() for x in raw}]

    for idx, item in enumerate(raw):
        word = item["w"].strip()
        lower = word.lower()
        audio_name = os.path.basename(item.get("audio") or f"{item.get('slug') or lower}.mp3")
        if not os.path.exists(os.path.join(audio_src, audio_name)):
            missing_audio.append(word)
        forms = word_forms(word)
        example = (item.get("ex") or "").strip()
        blank = make_blank(example, forms)
        gloss = GLOSS_EXTRA.get(lower) or norm_zh(item.get("zh"))
        entry = {
            "w": word,
            "zh": gloss,
            "pos": POS_EXTRA.get(lower) or (item.get("pos") or "").strip(),
            "def": DEF_EXTRA.get(lower) or (item.get("def") or "").strip(),
            "ex": example,
            "exb": blank,
            "forms": forms,
            "theme": item.get("theme") or "daily",
            "ket": bool(item.get("ket")),
            "core": lower in core_set,
            "audio": audio_name,
            "fam": families.get(lower, []),
            "topics": sorted(topic_terms.get(lower, [])),
        }
        words.append(entry)

    # Prefer core words first in the raw array? No: keep source order, the app shuffles.
    core_count = sum(1 for w in words if w["core"])
    pet_count = sum(1 for w in words if not w["ket"])
    with_ex = sum(1 for w in words if w["ex"])
    with_cloze = sum(1 for w in words if w["exb"])
    with_fam = sum(1 for w in words if w["fam"])
    with_audio = len(words) - len(missing_audio)

    meta = {
        "title": "词脉 · PET 记忆引擎",
        "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": len(words),
        "core": core_count,
        "pet": pet_count,
        "ket": len(words) - pet_count,
        "withExample": with_ex,
        "withCloze": with_cloze,
        "withFamily": with_fam,
        "withAudio": with_audio,
        "coreListRaw": len(core_rows),
        "coreListUnique": len(core_order),
        "coreListMissing": missing_core,
        "missingAudio": missing_audio,
        "themes": dict(Counter(w["theme"] for w in words)),
    }

    out = {
        "meta": meta,
        "themes": THEMES,
        "words": words,
    }
    data_path = os.path.join(APP, "assets", "data.js")
    with open(data_path, "w", encoding="utf-8") as fh:
        fh.write("/* Generated by scripts/build_data.py — do not edit by hand. */\n")
        fh.write("window.PET_DATA = ")
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    # Copy audio (idempotent; skip files already present with same size)
    dst_dir = os.path.join(APP, "audio")
    os.makedirs(dst_dir, exist_ok=True)
    copied = 0
    for entry in words:
        src = os.path.join(audio_src, entry["audio"])
        dst = os.path.join(dst_dir, entry["audio"])
        if not os.path.exists(src):
            continue
        if os.path.exists(dst) and os.path.getsize(dst) == os.path.getsize(src):
            continue
        shutil.copy2(src, dst)
        copied += 1

    report = dict(meta)
    report["audioCopied"] = copied
    report["dataBytes"] = os.path.getsize(data_path)
    with open(os.path.join(APP, "docs", "data-report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nWrote {data_path} ({os.path.getsize(data_path)/1024:.0f} KB), copied {copied} audio files.")
    if missing_audio:
        print("Missing audio:", missing_audio[:20], file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
