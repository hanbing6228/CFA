#!/usr/bin/env python3
"""把 .pages 提取的 1071 道真题文本 → 结构化 JSON (逐字, 确定性解析)。

锚点: 每题结尾 "答案：正确答案 X本题正确率Y%知识点：Z 难度：W 推荐："
解析: 答案字母 X / 正确率 Y / 知识点(→topic+module) Z / 题干+选项(答案行之前) / 解析(答案行之后到下题)。
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "import" / "pages_raw_v2.txt"   # 不去重、保序的重新提取版 (修复选项丢失)

# 知识点(module) → 我的 topic key。基于 los_map 的 module 归属。
MODULE_TOPIC = {
    "Multinational Operations": "FSA", "Intercorporate Investments": "FSA",
    "Employee Compensation": "FSA", "Analysis of Financial Institutions": "FSA",
    "Evaluating Quality of Financial Reports": "FSA", "Integration of Financial": "FSA",
    "Discounted Dividend Valuation": "Equity", "Free Cash Flow Valuation": "Equity",
    "Market-Based Valuation": "Equity", "Residual Income Valuation": "Equity",
    "Private Company Valuation": "Equity", "Equity Valuation": "Equity", "Return Concepts": "Equity",
    "Industry and Company Analysis": "Equity",
    "Term Structure": "FI", "Arbitrage-Free Valuation": "FI",
    "Bonds with Embedded": "FI", "Valuation and Analysis of Bonds": "FI",
    "Credit Analysis Models": "FI", "Credit Default Swaps": "FI", "Fixed-Income": "FI",
    "Time-Series Analysis": "QM", "Big Data Projects": "QM", "Machine Learning": "QM",
    "Multiple Regression": "QM", "Extensions of Multiple Regression": "QM",
    "Model Misspecification": "QM", "Evaluating Regression Model": "QM",
    "Quantitative Methods": "QM", "Financial Statement Analysis": "FSA",
    "Alternative Investments": "Alts", "Economics": "Econ",
    "Multifactor Models": "PM", "Using Multifactor Models": "PM",
    "Measuring and Managing Market Risk": "PM", "Backtesting and Simulation": "PM",
    "Analysis of Active Portfolio": "PM", "Economics and Investment Markets": "PM",
    "Trading Costs": "PM", "Exchange-Traded Funds": "PM", "Portfolio Management": "PM",
    "Pricing and Valuation of Forward": "Derivatives", "Valuation of Contingent Claims": "Derivatives",
    "Pricing and Valuation of Futures": "Derivatives", "Swaps": "Derivatives",
    "Introduction to Commodities": "Alts", "Overview of Types of Real Estate": "Alts",
    "Investments in Real Estate": "Alts", "Investments in Private Equity": "Alts",
    "Hedge Fund Strategies": "Alts", "Private Real Estate": "Alts", "Publicly Traded Real Estate": "Alts",
    "Currency Exchange Rates": "Econ", "Economic Growth": "Econ",
    "Guidance for Standards": "Ethics", "Code of Ethics": "Ethics",
    "Application of the Code": "Ethics", "Ethical": "Ethics",
    "Analysis of Dividends": "Corp", "Share Repurchases": "Corp", "ESG": "Corp",
    "Cost of Capital": "Corp", "Corporate Restructuring": "Corp", "Capital Structure": "Corp",
    "Business Models": "Corp",
}

ANS_RE = re.compile(r"答案：正确答案\s*([ABC])本题正确率(\d+)%知识点：(.+?)\s*难度：(\S+)")
_CUES = ("closest to:", "most likely", "least likely", "most appropriate", "best described",
         "best explain", "is correct", "will most", "is most", "would most", "appropriate:",
         "following", "?")


def _stem_end(line: str) -> bool:
    """这一行像不像题干的结尾(问句)。"""
    l = line.strip()
    if l.endswith(":") or l.endswith("?"):
        return True
    low = l.lower()
    return any(c in low for c in _CUES) and (l.endswith(":") or l.endswith(".") or l.endswith("?"))


def map_topic(kp: str) -> tuple[str, str]:
    for frag, topic in MODULE_TOPIC.items():
        if frag in kp:
            return topic, kp.strip()
    return "?", kp.strip()


def clean(s: str) -> str:
    return s.replace("￼", "[公式]").strip()


def parse() -> list[dict]:
    lines = [l.rstrip() for l in RAW.read_text(encoding="utf-8").split("\n")]
    ans_idx = [i for i, l in enumerate(lines) if ANS_RE.search(l)]
    out = []
    prev_ans = -1
    for qi, ai in enumerate(ans_idx):
        m = ANS_RE.search(lines[ai])
        ansletter, rate, kp, diff = m.group(1), int(m.group(2)), m.group(3), m.group(4)
        topic, module = map_topic(kp)
        # region(本答案行前) 含: 上题解析尾 + 本题干 + 本题选项。answer 行之后是本题解析。
        region = lines[prev_ans + 1: ai]
        region = [r for r in region if not re.match(r"^\s*\d{1,2}\s*(单选题|综合题|多选题)\s*$", r.strip())]
        region = [r.strip() for r in region if r.strip()]
        opts = region[-3:] if len(region) >= 3 else region
        pre = region[:-3] if len(region) >= 3 else []
        # 题干 = pre 里从"最后一个以 : 或问题线索结尾的行"往回到线索起点。取该行(+若上一行不像完整句也并入)
        stem_lines = []
        if pre:
            si = len(pre) - 1
            while si >= 0 and not _stem_end(pre[si]):
                si -= 1
            if si < 0:
                stem_lines = pre[-1:]           # 没找到线索, 兜底取最后一行
            else:
                st = si
                while st - 1 >= 0 and _stem_end(pre[st - 1]) is False and len(pre[st - 1]) > 30 \
                        and not pre[st - 1].endswith('.'):
                    st -= 1                      # 向上并入题干续行
                stem_lines = pre[st: si + 1]
        # 本题解析 = 答案行之后 到 下一答案区的题干/选项之前
        nxt = ans_idx[qi + 1] if qi + 1 < len(ans_idx) else len(lines)
        expl_region = [x.strip() for x in lines[ai + 1: nxt] if x.strip()]
        expl_region = [x for x in expl_region if not re.match(r"^\s*\d{1,2}\s*(单选题|综合题|多选题)\s*$", x)]
        expl = "\n".join(clean(x) for x in expl_region)
        out.append({
            "topic": topic, "module": module, "knowledge_point": kp.strip(),
            "correct_rate": rate, "difficulty": diff,
            "stem": clean(" ".join(stem_lines)),
            "options": [clean(x) for x in opts],
            "answer": ansletter,
            "explanation": expl,
        })
        prev_ans = ai
    return out


if __name__ == "__main__":
    qs = parse()
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    if n:
        print(json.dumps(qs[:n], ensure_ascii=False, indent=2))
    else:
        by = {}
        unk = 0
        for q in qs:
            by[q["topic"]] = by.get(q["topic"], 0) + 1
            if q["topic"] == "?":
                unk += 1
        print("总题:", len(qs))
        print("topic 分布:", json.dumps(by, ensure_ascii=False))
        print("未映射 topic:", unk)


def to_bank():
    """parse() → bank/pages_bank.json (题库 schema, 单块解析 + 正确率考频)。"""
    qs = parse()
    seen = {}
    questions = []
    skipped = 0
    for i, q in enumerate(qs):
        if q["topic"] == "?" or len(q["options"]) != 3 or not q["stem"]:
            skipped += 1
            continue
        # 去掉选项里可能混入的下一题干尾巴(含换行分隔符)
        opts = [re.split(r"[  ]", o)[0].strip() for o in q["options"]]
        opts = [re.sub(r"^\s*[ABC][\.\)]\s*", "", o) for o in opts]   # 去掉可能的 A. 前缀
        if any(not o for o in opts):
            skipped += 1
            continue
        dk = q["stem"][:60] + "|" + "|".join(sorted(opts))[:60]
        if dk in seen:                    # 去重(v2 提取有少量重复)
            skipped += 1
            continue
        seen[dk] = 1
        qid = f"PG-{q['topic']}-{i}"
        # 计算题判定: 解析或题干含数字运算线索
        blob = q["stem"] + q["explanation"]
        is_calc = bool(re.search(r"\d[\d,]*\.\d|=|\bclosest to\b|×|\$\d|calculated as", blob))
        questions.append({
            "id": qid, "topic": q["topic"], "module": q["module"],
            "los": q["knowledge_point"],
            "type": "calc" if is_calc else "concept",
            "stem": q["stem"],
            "choices": {"A": opts[0], "B": opts[1], "C": opts[2]},
            "answer": q["answer"],
            "explanation": q["explanation"],          # 单块解析(原文)
            "freq": q["correct_rate"],                # 正确率(考频/难度信号)
            "source": "CFA L2 题库 (past, public)",
            "verified": {"method": "verbatim-import-pages"},
        })
    dest = ROOT / "bank" / "pages_bank.json"
    dest.write_text(json.dumps({"questions": questions}, ensure_ascii=False, indent=1), encoding="utf-8")
    by = {}
    for q in questions:
        by[q["topic"]] = by.get(q["topic"], 0) + 1
    print(f"写入 {len(questions)} 题 → {dest} (跳过 {skipped}); 分布:", json.dumps(by, ensure_ascii=False))
