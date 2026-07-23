#!/usr/bin/env python3
"""题库.pdf (1612页, 干净文字层) → 完整 case 结构 (背景+Exhibit+连题)。

结构: 每 case 以"01 单选题"起 (编号重置); 背景在 case 首题之前;
每题 = 题干+选项 → "答案：正确答案X本题正确率Y%知识点：Z 难度" → 解析。
图片(Exhibit图表/公式)按页抽取, 见 extract_images()。
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TXT = ROOT / "import" / "qbank_pdf.txt"
sys.path.insert(0, str(ROOT / "tool"))
from parse_pages import map_topic, _stem_end   # 复用知识点→topic 映射与题干线索

ANS = re.compile(r"答案：正确答案\s*([ABC])本题正确率(\d+)%知识点：([\s\S]+?)难度：", re.M)
QMARK = re.compile(r"(\d{1,2})\s*单选题")
PAGE = re.compile(r"<<<PAGE (\d+)>>>")


def _clean_lines(block: str) -> list[str]:
    out = []
    for l in block.split("\n"):
        l = PAGE.sub("", l).strip()
        if l in ("·", "•"):
            continue
        if l and not re.match(r"^(数量|道德|权益|固收|衍生|组合|另类|公司金融|经济|收藏|纠错|收藏\s*纠错|基础题|\d{1,2}\s*综合题|\d{1,2}\s*单选题)$", l):
            out.append(l)
    return out


def _split_opts(pre: list[str]) -> tuple[list[str], list[str]]:
    """PDF 选项格式: 末尾 [A][文本..][B][文本..][C][文本..]。返回(题干行, [A,B,C])。"""
    # 从后往前找 A/B/C 三个单字母标记行
    idx = {}
    for i in range(len(pre) - 1, -1, -1):
        if pre[i] in ("A", "B", "C") and pre[i] not in idx:
            idx[pre[i]] = i
        if len(idx) == 3:
            break
    if len(idx) == 3 and idx["A"] < idx["B"] < idx["C"]:
        a, b, c = idx["A"], idx["B"], idx["C"]
        oa = " ".join(pre[a + 1:b]).strip()
        ob = " ".join(pre[b + 1:c]).strip()
        oc = " ".join(pre[c + 1:]).strip()
        if oa and ob and oc:
            return pre[:a], [oa, ob, oc]
    # 兜底: 末尾3行
    return pre[:-3], pre[-3:] if len(pre) >= 3 else pre


def parse():
    raw = TXT.read_text(encoding="utf-8")
    # 记录每个字符位置的页号
    marks = [(m.start(), int(m.group(1))) for m in PAGE.finditer(raw)]
    def page_at(pos):
        p = 0
        for mp, pn in marks:
            if mp <= pos:
                p = pn
            else:
                break
        return p

    qmarks = [(m.start(), m.end(), int(m.group(1))) for m in QMARK.finditer(raw)]
    cases = []
    cur = None
    for qi, (s, e, num) in enumerate(qmarks):
        seg_end = qmarks[qi + 1][0] if qi + 1 < len(qmarks) else len(raw)
        seg = raw[e:seg_end]
        am = ANS.search(seg)
        if not am:
            continue
        stem_opt = _clean_lines(seg[:am.start()])
        expl_region = _clean_lines(seg[am.end():])
        pre, opts = _split_opts(stem_opt)
        # 题干: pre 里最后一个问句行往回
        stem_lines, bg_lines = [], []
        if pre:
            si = len(pre) - 1
            while si >= 0 and not _stem_end(pre[si]):
                si -= 1
            if si < 0:
                stem_lines = pre[-1:]
                bg_lines = pre[:-1]
            else:
                st = si
                while st - 1 >= 0 and not _stem_end(pre[st - 1]) and len(pre[st - 1]) > 25 \
                        and not pre[st - 1].endswith("."):
                    st -= 1
                stem_lines = pre[st:si + 1]
                bg_lines = pre[:st]        # 题干之前的散文 = 背景/Exhibit(仅 case 首题有)
        topic, module = map_topic(re.sub(r"\s+"," ",am.group(3)))
        q = {
            "num": num, "topic": topic, "module": module, "kp": am.group(3).strip(),
            "answer": am.group(1), "rate": int(am.group(2)),
            "stem": " ".join(stem_lines).strip(),
            "options": [o.strip() for o in opts],
            "explanation": "\n".join(expl_region).strip(),
            "page": page_at(s),
            "bg_lines": bg_lines,
        }
        if num == 1:                       # 新 case
            cur = {"background": "\n".join(bg_lines).strip(), "page": q["page"], "questions": []}
            cases.append(cur)
        if cur is None:
            cur = {"background": "", "page": q["page"], "questions": []}
            cases.append(cur)
        q.pop("bg_lines")
        cur["questions"].append(q)
    return cases


if __name__ == "__main__":
    cases = parse()
    nq = sum(len(c["questions"]) for c in cases)
    print(f"cases: {len(cases)}, questions: {nq}")
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    if n:
        for c in cases[n - 1:n]:
            print("=== CASE p", c["page"], "===")
            print("背景:", c["background"][:400])
            for q in c["questions"]:
                print(f"  [{q['num']}] {q['topic']}|率{q['rate']}|答{q['answer']} {q['stem'][:70]}")
                print("     选项:", [o[:35] for o in q["options"]])


def build(pdf_path="/tmp/claude-0/-home-user-CFA/4fa97b66-e60d-5c05-a4ee-ec875de36d43/scratchpad/qbank/题库.pdf"):
    """parse() + 抽Exhibit图 → bank/qbank.json (case结构, 图片附到页)。替换 pages_bank。"""
    import fitz
    cases = parse()
    exdir = ROOT / "app" / "exhibits"
    exdir.mkdir(parents=True, exist_ok=True)
    for f in exdir.glob("*.png"):
        f.unlink()
    doc = fitz.open(pdf_path)
    page_imgs = {}          # page → [相对路径]
    for i in range(doc.page_count):
        saved = []
        for j, im in enumerate(doc[i].get_images(full=True)):
            pix = fitz.Pixmap(doc, im[0])
            if pix.width * pix.height < 4000:
                continue
            if pix.n - pix.alpha >= 4:      # CMYK→RGB
                pix = fitz.Pixmap(fitz.csRGB, pix)
            name = f"p{i}-{j}.png"
            pix.save(str(exdir / name))
            saved.append(f"exhibits/{name}")
        if saved:
            page_imgs[i] = saved

    out_cases, out_q = [], []
    seenq = set()
    for ci, c in enumerate(cases):
        qs = [q for q in c["questions"] if q["topic"] != "?" and len(q["stem"]) >= 8 and len(q["options"]) == 3]
        if not qs:
            continue
        pages = sorted({q["page"] for q in c["questions"]})
        imgs = []
        for p in range(min(pages), max(pages) + 1):
            imgs += page_imgs.get(p, [])
        cid = f"QB-CASE-{ci}"
        topic = qs[0]["topic"]
        has_case = bool(c["background"]) or bool(imgs) or len(qs) > 1
        if has_case:
            out_cases.append({
                "id": cid, "topic": topic,
                "title": f"{qs[0]['module']} 综合题",
                "background": c["background"],
                "images": imgs[:6],
            })
        for q in qs:
            key = q["stem"][:50] + q["answer"]
            if key in seenq:
                continue
            seenq.add(key)
            blob = q["stem"] + q["explanation"]
            is_calc = bool(re.search(r"\d[\d,]*\.\d|=|closest to|×|\$\d|calculated", blob))
            out_q.append({
                "id": f"QB-{topic}-{ci}-{len(out_q)}",
                "case": cid if has_case else None,
                "topic": topic, "module": q["module"], "los": re.sub(r"\s+", " ", q["kp"]),
                "type": "calc" if is_calc else "concept",
                "stem": q["stem"],
                "choices": {"A": q["options"][0], "B": q["options"][1], "C": q["options"][2]},
                "answer": q["answer"], "explanation": q["explanation"], "freq": q["rate"],
                "source": "CFA L2 题库 (past, public)", "verified": {"method": "verbatim-pdf"},
            })
    (ROOT / "bank" / "qbank.json").write_text(
        json.dumps({"cases": out_cases, "questions": out_q}, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    print(f"qbank.json: {len(out_cases)} cases, {len(out_q)} 题, {sum(len(v) for v in page_imgs.values())} 图")
    print("topic:", dict(Counter(q["topic"] for q in out_q)))
