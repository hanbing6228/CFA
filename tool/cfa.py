#!/usr/bin/env python3
"""CFA L2「低消耗通过」学习工具 —— 阶段0 MVP。

用法:
  python3 tool/cfa.py sync            题库(bank/*.json) → 本地数据库
  python3 tool/cfa.py today           每日简报: X道到期复习 + Y道新题 (贴进 TickTick/Notion)
  python3 tool/cfa.py quiz            终端答题 (到期复习优先, 再上新题额度)
  python3 tool/cfa.py html            导出今日答题页为独立 HTML (手机可用, 结果字符串贴回导入)
  python3 tool/cfa.py import '<json>' 导入 HTML 答题结果
  python3 tool/cfa.py stats           LOS 级弱点看板
  python3 tool/cfa.py plan            按考试日期倒排 Sprint 计划 (含放弃清单)

设计出处见 docs/DESIGN.md。数据只存本地 state/ (已 gitignore), 表结构兼容 Supabase 迁移。
"""

from __future__ import annotations

import json
import sqlite3
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tool"))

from fsrs_engine import (  # noqa: E402
    AGAIN, HARD, GOOD, EASY, CardState, ExamConfig, review, retrievability,
)

STATE_DIR = ROOT / "state"
DB_PATH = STATE_DIR / "cfa.db"
TIER_MULT = {"A": 3.0, "B": 1.5, "C": 0.5}


# ---------------------------------------------------------------- infra

def load_config() -> dict:
    return json.loads((ROOT / "config.json").read_text(encoding="utf-8"))


def days_to_exam(cfg: dict) -> int:
    exam = date.fromisoformat(cfg["exam_date"])
    return (exam - date.today()).days


def exam_config(cfg: dict) -> ExamConfig:
    r = cfg["retention"]
    return ExamConfig(
        days_to_exam=max(0, days_to_exam(cfg)),
        base_retention=r["base"], peak_retention=r["peak"],
        ramp_days=r["ramp_days"], compress_days=r["compress_days"],
    )


def db() -> sqlite3.Connection:
    STATE_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY, topic TEXT, los TEXT, type TEXT,
          stem TEXT, choices TEXT, answer TEXT, explanations TEXT, source TEXT,
          stability REAL DEFAULT 0, difficulty REAL DEFAULT 0,
          reps INTEGER DEFAULT 0, lapses INTEGER DEFAULT 0,
          last_review TEXT, due TEXT
        );
        CREATE TABLE IF NOT EXISTS reviews (
          rid INTEGER PRIMARY KEY AUTOINCREMENT,
          card_id TEXT, ts TEXT, grade INTEGER, correct INTEGER,
          days_to_exam INTEGER
        );
        """
    )
    return conn


# ---------------------------------------------------------------- sync

def cmd_sync() -> None:
    conn = db()
    n_new = n_seen = 0
    for path in sorted((ROOT / "bank").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for q in data.get("questions", []):
            exists = conn.execute("SELECT 1 FROM cards WHERE id=?", (q["id"],)).fetchone()
            if exists:
                conn.execute(
                    "UPDATE cards SET topic=?,los=?,type=?,stem=?,choices=?,answer=?,explanations=?,source=? WHERE id=?",
                    (q["topic"], q["los"], q["type"], q["stem"],
                     json.dumps(q["choices"], ensure_ascii=False), q["answer"],
                     json.dumps(q["explanations"], ensure_ascii=False), q.get("source", ""), q["id"]),
                )
                n_seen += 1
            else:
                conn.execute(
                    "INSERT INTO cards (id,topic,los,type,stem,choices,answer,explanations,source) VALUES (?,?,?,?,?,?,?,?,?)",
                    (q["id"], q["topic"], q["los"], q["type"], q["stem"],
                     json.dumps(q["choices"], ensure_ascii=False), q["answer"],
                     json.dumps(q["explanations"], ensure_ascii=False), q.get("source", "")),
                )
                n_new += 1
    conn.commit()
    print(f"sync 完成: 新增 {n_new} 题, 更新 {n_seen} 题")


# ---------------------------------------------------------------- selection

def due_cards(conn: sqlite3.Connection, cfg: dict) -> list[sqlite3.Row]:
    """到期复习卡, 按 (话题权重 × 过期程度) 降序 —— 权重杠杆作用于复习优先级。"""
    today = date.today().isoformat()
    rows = conn.execute(
        "SELECT * FROM cards WHERE reps > 0 AND due <= ?", (today,)
    ).fetchall()
    topics = cfg["topics"]

    def prio(r: sqlite3.Row) -> float:
        t = topics.get(r["topic"], {"weight": 5, "tier": "C"})
        overdue = (date.today() - date.fromisoformat(r["due"])).days + 1
        return t["weight"] * TIER_MULT[t["tier"]] * overdue

    return sorted(rows, key=prio, reverse=True)


def new_cards(conn: sqlite3.Connection, cfg: dict, quota: int) -> list[sqlite3.Row]:
    """新题按 tier 乘数加权轮转选取; 压缩期(考前14天)额度为0。"""
    if quota <= 0:
        return []
    rows = conn.execute("SELECT * FROM cards WHERE reps = 0").fetchall()
    topics = cfg["topics"]
    rows = sorted(
        rows,
        key=lambda r: -topics.get(r["topic"], {"weight": 5})["weight"]
        * TIER_MULT[topics.get(r["topic"], {"tier": "C"})["tier"]],
    )
    return rows[:quota]


def new_quota(cfg: dict) -> int:
    ec = exam_config(cfg)
    if ec.in_compress_mode:
        return 0  # AnKing 经验: 考前停新卡防 burnout
    return cfg["daily"]["new_per_day"]


# ---------------------------------------------------------------- today

def cmd_today() -> None:
    cfg = load_config()
    conn = db()
    ec = exam_config(cfg)
    dues = due_cards(conn, cfg)[: cfg["daily"]["review_cap"]]
    news = new_cards(conn, cfg, new_quota(cfg))
    dte = days_to_exam(cfg)

    print(f"## CFA 今日待办  ({date.today().isoformat()}, 距考 {dte} 天"
          + (", ⚠️ 压缩模式: 停新题" if ec.in_compress_mode else "") + ")")
    print()
    print(f"- [ ] 复习 {len(dues)} 题 (到期)")
    print(f"- [ ] 新题 {len(news)} 题")
    est = round((len(dues) + len(news)) * 1.8)
    print(f"- 预计耗时 ~{est} 分钟 (预算 {cfg['daily']['time_budget_minutes']} 分钟)")
    if est > cfg["daily"]["time_budget_minutes"]:
        print("- ⚠️ 超预算: 考虑把 retention.base 下调 0.02 或砍 C 档 LOS (见 docs/PLAN.md 阈值)")
    print(f"- 当前目标保留率: {ec.desired_retention:.2f}")
    if dues:
        by_topic: dict[str, int] = {}
        for r in dues:
            by_topic[r["topic"]] = by_topic.get(r["topic"], 0) + 1
        detail = ", ".join(f"{k}×{v}" for k, v in sorted(by_topic.items(), key=lambda x: -x[1]))
        print(f"- 复习分布: {detail}")
    print()
    print("开始: `python3 tool/cfa.py quiz`  或手机用 `python3 tool/cfa.py html`")


# ---------------------------------------------------------------- grading

def apply_grade(conn: sqlite3.Connection, card: sqlite3.Row, grade: int, cfg: dict) -> int:
    ec = exam_config(cfg)
    st = CardState(
        stability=card["stability"], difficulty=card["difficulty"],
        reps=card["reps"], lapses=card["lapses"],
    )
    if card["last_review"]:
        st.elapsed_days = max(
            0.0, (datetime.now() - datetime.fromisoformat(card["last_review"])).total_seconds() / 86400.0
        )
    new_st, ivl = review(st, grade, ec)
    due = (date.today() + timedelta(days=ivl)).isoformat()
    conn.execute(
        "UPDATE cards SET stability=?,difficulty=?,reps=?,lapses=?,last_review=?,due=? WHERE id=?",
        (new_st.stability, new_st.difficulty, new_st.reps, new_st.lapses,
         datetime.now().isoformat(timespec="seconds"), due, card["id"]),
    )
    conn.execute(
        "INSERT INTO reviews (card_id,ts,grade,correct,days_to_exam) VALUES (?,?,?,?,?)",
        (card["id"], datetime.now().isoformat(timespec="seconds"), grade,
         1 if grade > AGAIN else 0, days_to_exam(cfg)),
    )
    conn.commit()
    return ivl


# ---------------------------------------------------------------- quiz

def cmd_quiz() -> None:
    cfg = load_config()
    conn = db()
    session = due_cards(conn, cfg)[: cfg["daily"]["review_cap"]] + new_cards(conn, cfg, new_quota(cfg))
    if not session:
        print("今天没有到期题, 收工 ✅")
        return
    n_right = 0
    for i, card in enumerate(session, 1):
        choices = json.loads(card["choices"])
        print(f"\n[{i}/{len(session)}] {card['topic']} | {card['los']}")
        print(card["stem"])
        for k in sorted(choices):
            print(f"  {k}. {choices[k]}")
        ans = input("你的答案 (A/B/C, q退出): ").strip().upper()
        if ans == "Q":
            break
        expl = json.loads(card["explanations"])
        if ans == card["answer"]:
            n_right += 1
            conf = input("✅ 对。秒杀? [回车=Good, e=Easy, h=勉强]: ").strip().lower()
            grade = EASY if conf == "e" else HARD if conf == "h" else GOOD
            print(f"   {expl[card['answer']]}")
        else:
            grade = AGAIN
            print(f"❌ 错, 正确答案 {card['answer']}。逐选项解析:")
            for k in sorted(expl):
                mark = "✓" if k == card["answer"] else "✗"
                print(f"  {mark} {k}: {expl[k]}")
        ivl = apply_grade(conn, card, grade, cfg)
        print(f"   → 下次复习: {ivl} 天后")
    print(f"\n本次 {n_right} 对 / {i} 题。看板: `python3 tool/cfa.py stats`")


# ---------------------------------------------------------------- html export / import

def cmd_html() -> None:
    cfg = load_config()
    conn = db()
    session = due_cards(conn, cfg)[: cfg["daily"]["review_cap"]] + new_cards(conn, cfg, new_quota(cfg))
    if not session:
        print("今天没有到期题, 无需导出")
        return
    payload = [
        {
            "id": c["id"], "topic": c["topic"], "los": c["los"], "stem": c["stem"],
            "choices": json.loads(c["choices"]), "answer": c["answer"],
            "explanations": json.loads(c["explanations"]),
        }
        for c in session
    ]
    html = _HTML_TEMPLATE.replace("__QUESTIONS__", json.dumps(payload, ensure_ascii=False)) \
                         .replace("__DATE__", date.today().isoformat())
    out = STATE_DIR / f"session-{date.today().isoformat()}.html"
    out.write_text(html, encoding="utf-8")
    print(f"已导出 {len(payload)} 题 → {out}")
    print("答完后把页面底部的结果串贴回: python3 tool/cfa.py import '<结果串>'")


def cmd_import(arg: str) -> None:
    cfg = load_config()
    conn = db()
    results = json.loads(arg)
    n = 0
    for r in results:
        card = conn.execute("SELECT * FROM cards WHERE id=?", (r["id"],)).fetchone()
        if card is None:
            print(f"跳过未知题目 {r['id']}")
            continue
        apply_grade(conn, card, int(r["grade"]), cfg)
        n += 1
    print(f"已导入 {n} 条复习记录")


_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CFA 今日答题 __DATE__</title>
<style>
 body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px;line-height:1.6;background:#fafafa;color:#222}
 @media (prefers-color-scheme: dark){body{background:#1a1a1a;color:#ddd}.card{background:#252525!important}}
 .card{background:#fff;border-radius:10px;padding:16px;margin:14px 0;box-shadow:0 1px 4px rgba(0,0,0,.12)}
 .meta{font-size:.8em;opacity:.6}
 button{display:block;width:100%;text-align:left;margin:6px 0;padding:10px;border:1px solid #ccc;border-radius:8px;background:inherit;color:inherit;font-size:1em;cursor:pointer}
 button.right{border-color:#2a2;background:rgba(40,170,40,.12)}
 button.wrong{border-color:#c33;background:rgba(200,50,50,.12)}
 .expl{font-size:.9em;margin-top:8px;display:none}
 textarea{width:100%;height:80px;margin-top:8px}
 .conf{display:none;margin-top:8px}.conf button{display:inline-block;width:auto;margin-right:8px}
</style></head><body>
<h2>CFA 今日答题 <span class="meta">__DATE__</span></h2>
<div id="qs"></div>
<div class="card" id="done" style="display:none">
 <b>完成 ✅</b> 复制下面结果串, 回到电脑执行 <code>python3 tool/cfa.py import '&lt;结果串&gt;'</code>
 <textarea id="out" readonly onclick="this.select()"></textarea>
</div>
<script>
const QS = __QUESTIONS__;
const results = [];
const qsDiv = document.getElementById('qs');
QS.forEach((q, qi) => {
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = `<div class="meta">[${qi+1}/${QS.length}] ${q.topic} | ${q.los}</div><p>${q.stem}</p>`;
  const expl = document.createElement('div'); expl.className = 'expl';
  const conf = document.createElement('div'); conf.className = 'conf';
  conf.innerHTML = '答对了——多确定? ';
  Object.keys(q.choices).sort().forEach(k => {
    const b = document.createElement('button');
    b.textContent = k + '. ' + q.choices[k];
    b.onclick = () => {
      if (card.dataset.done) return;
      card.dataset.done = '1';
      [...card.querySelectorAll('button')].forEach(x => { if (x.parentNode !== conf) x.disabled = true; });
      let ex = '';
      Object.keys(q.explanations).sort().forEach(ek => {
        ex += `<p><b>${ek === q.answer ? '✓' : '✗'} ${ek}</b>: ${q.explanations[ek]}</p>`;
      });
      expl.innerHTML = ex; expl.style.display = 'block';
      if (k === q.answer) { b.classList.add('right'); conf.style.display = 'block'; }
      else {
        b.classList.add('wrong');
        [...card.querySelectorAll('button')].find(x => x.textContent.startsWith(q.answer + '.')).classList.add('right');
        record(q.id, 1);
      }
    };
    card.appendChild(b);
  });
  [['勉强/蒙对', 2], ['答对', 3], ['秒杀', 4]].forEach(([label, g]) => {
    const cb = document.createElement('button'); cb.textContent = label;
    cb.onclick = () => { conf.style.display = 'none'; record(q.id, g); };
    conf.appendChild(cb);
  });
  card.appendChild(conf); card.appendChild(expl); qsDiv.appendChild(card);
});
function record(id, grade) {
  results.push({id, grade});
  if (results.length === QS.length) {
    document.getElementById('done').style.display = 'block';
    document.getElementById('out').value = JSON.stringify(results);
    document.getElementById('done').scrollIntoView();
  }
}
</script></body></html>
"""


# ---------------------------------------------------------------- stats

def cmd_stats() -> None:
    cfg = load_config()
    conn = db()
    rows = conn.execute(
        """
        SELECT c.topic, c.los,
               COUNT(r.rid) AS n, SUM(r.correct) AS right_n,
               MAX(c.stability) AS s, MAX(c.due) AS due
        FROM cards c LEFT JOIN reviews r ON r.card_id = c.id
        GROUP BY c.topic, c.los ORDER BY c.topic, c.los
        """
    ).fetchall()
    topics = cfg["topics"]
    print(f"## LOS 弱点看板  ({date.today().isoformat()})\n")
    by_topic: dict[str, list] = {}
    for r in rows:
        by_topic.setdefault(r["topic"], []).append(r)
    for t in sorted(by_topic, key=lambda t: -topics.get(t, {"weight": 0})["weight"]):
        meta = topics.get(t, {"tier": "?", "weight": 0, "name_cn": ""})
        total = sum(r["n"] or 0 for r in by_topic[t])
        right = sum(r["right_n"] or 0 for r in by_topic[t])
        acc = f"{100 * right / total:.0f}%" if total else "—"
        print(f"### {t} {meta.get('name_cn','')} [tier {meta['tier']}, 权重~{meta['weight']}%]  正确率 {acc} ({right}/{total})")
        for r in sorted(by_topic[t], key=lambda r: (r["right_n"] or 0) / (r["n"] or 1)):
            n = r["n"] or 0
            a = f"{100 * (r['right_n'] or 0) / n:.0f}%" if n else "未开始"
            flag = " 🔴" if n >= 2 and (r["right_n"] or 0) / n < 0.6 else ""
            print(f"- {r['los']}: {a} ({r['right_n'] or 0}/{n}){flag}")
        print()
    print("🔴 = 复习≥2次且正确率<60% 的 LOS → 让 Claude 用 prompts/generate_questions.md 加题回炉")


# ---------------------------------------------------------------- plan

def cmd_plan() -> None:
    cfg = load_config()
    exam = date.fromisoformat(cfg["exam_date"])
    today = date.today()
    dte = (exam - today).days
    topics = cfg["topics"]

    def dt(days_before: int) -> str:
        return (exam - timedelta(days=days_before)).isoformat()

    tiers: dict[str, list[str]] = {"A": [], "B": [], "C": []}
    for k, v in topics.items():
        tiers[v["tier"]].append(f"{k}({v.get('name_cn', '')})")

    print(f"# CFA L2 倒排 Sprint 计划")
    print(f"考试日: **{exam.isoformat()}** | 今天: {today.isoformat()} | 距考 **{dte} 天**")
    print(f"> 考试日是 config.json 的占位值时, 先改成真实日期再重新生成\n")
    print("## 权重策略 (开局锁定, 不再纠结)")
    print(f"- **满仓 A** (新题额度3x, 目标正确率>70%): {', '.join(tiers['A'])}")
    print(f"- **保底 B** (额度1.5x, 目标~60%): {', '.join(tiers['B'])}")
    print(f"- **战略放弃 C** (额度0.5x, 只做高频LOS): {', '.join(tiers['C'])}")
    print("- 依据: 高分学员复盘——大权重科目拿A, 最小权重拿C照样通过; 70%可过就合理挥霍另外30%\n")
    print("## 阶段")
    phases = [
        (dte, 101, "基础 Sprint", "只做题+错了看逐选项解析, 不读 curriculum。每天 3 新题 + 到期复习。习惯优先: never miss twice, 每次先做1题起步。"),
        (100, 43, "百日冲刺", "错题回炉为主, A档科目加量。每2周一次 mini-mock (20题), 按错因分类(概念/计算/陷阱/时间)驱动下周额度。"),
        (42, 15, "冲刺包", "高频考点题集 + 每周 mock + 框架图。retention 自动爬坡至0.88。B/C档只保'已会的', 不再开新LOS。"),
        (14, 0, "压缩期", "工具自动停新题。只做到期复习+🔴LOS+框架图过一遍。每张卡考前至少再见一次(调度器保证)。"),
    ]
    for start, end, name, desc in phases:
        if dte < end:
            continue
        s = min(start, dte)
        print(f"### {name}  {dt(s)} → {dt(end)}  (考前 {s}~{end} 天)")
        print(f"{desc}\n")
    print("## 换挡阈值 (触发即执行, 不讨论)")
    print("- 高权重科目连续两次 mini-mock <55% → 该科加额度 + 补正规题库原题")
    print("- 每日复习量超时间预算 → retention.base 下调 0.02 或砍 C 档 LOS")
    print("- 连续14天完成率 <70% → 新题额度减半, 先救习惯再救进度")
    print("- 搭工具/美化工具超过2个周末 → 立即停手, 工具已经够用了")


# ---------------------------------------------------------------- build (app/bank.json)

def cmd_build() -> None:
    """合并 bank/*.json → app/bank.json, 附 schema 校验。"""
    cfg = load_config()
    los_map = json.loads((ROOT / "bank" / "los_map.json").read_text(encoding="utf-8"))
    questions, ids = [], set()
    cases: dict[str, dict] = {}
    errors = []
    frames: dict = {}
    for fpath in sorted((ROOT / "bank").glob("frames*.json")):
        fdata = json.loads(fpath.read_text(encoding="utf-8"))
        fdata.pop("_schema", None)
        for topic, mods in fdata.items():
            frames.setdefault(topic, {}).update(mods)
    lessons: dict[str, list] = {}
    ldir = ROOT / "bank" / "lessons"
    if ldir.exists():
        for lpath in sorted(ldir.glob("*.json")):
            ldata = json.loads(lpath.read_text(encoding="utf-8"))
            for les in ldata.get("lessons", []):
                lessons[f"{ldata['topic']}|{les['los']}"] = les["cards"]
    for path in sorted((ROOT / "bank").glob("*.json")):
        if path.name in ("los_map.json", "frames.json"):
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for c in data.get("cases", []):
            if c["id"] in cases:
                errors.append(f"{path.name}: 重复 case {c['id']}")
            cases[c["id"]] = c
        for q in data.get("questions", []):
            qid = q.get("id", "?")
            if qid in ids:
                errors.append(f"{path.name}: 重复 id {qid}")
                continue
            ids.add(qid)
            if q.get("topic") not in cfg["topics"]:
                errors.append(f"{qid}: 未知 topic {q.get('topic')}")
            if q.get("topic") not in los_map:
                errors.append(f"{qid}: topic 不在 los_map 骨架中")
            ch = q.get("choices", {})
            if sorted(ch.keys()) != ["A", "B", "C"]:
                errors.append(f"{qid}: choices 必须恰好 A/B/C")
            if q.get("answer") not in ch:
                errors.append(f"{qid}: answer 不在 choices 中")
            single_expl = isinstance(q.get("explanation"), str) and q["explanation"]
            if not single_expl:   # 逐选项解析题: 键须与 choices 一致
                if sorted(q.get("explanations", {}).keys()) != sorted(ch.keys()):
                    errors.append(f"{qid}: explanations 键与 choices 不一致")
                if q.get("type") == "calc" and not q.get("steps"):
                    errors.append(f"{qid}: calc 题缺 steps")
            if not q.get("source"):
                errors.append(f"{qid}: 缺 source 出处")
            questions.append(q)
    for q in questions:
        if q.get("case") and q["case"] not in cases:
            errors.append(f"{q['id']}: case {q['case']} 不存在")
    if errors:
        print("build 失败:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    if lessons:
        q_los = {f"{q['topic']}|{q['los']}" for q in questions}
        uncovered = sorted(k for k in q_los if k not in lessons)
        if uncovered:
            print(f"提示: {len(uncovered)} 个 LOS 无微课 (新题将直接出题):")
            for k in uncovered[:10]:
                print("  -", k)
    out = {
        "version": date.today().isoformat(),
        "defaults": {
            "exam_date": cfg["exam_date"],
            "daily": cfg["daily"],
            "retention": cfg["retention"],
        },
        "topics": cfg["topics"],
        "frames": frames,
        "lessons": lessons,
        "cases": cases,
        "questions": questions,
    }
    dest = ROOT / "app" / "bank.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    by_topic: dict[str, int] = {}
    for q in questions:
        by_topic[q["topic"]] = by_topic.get(q["topic"], 0) + 1
    print(f"build OK → {dest}  ({len(questions)} 题: "
          + ", ".join(f"{k}×{v}" for k, v in sorted(by_topic.items())) + ")")


# ---------------------------------------------------------------- main

def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "today"
    if cmd == "sync":
        cmd_sync()
    elif cmd == "today":
        cmd_today()
    elif cmd == "quiz":
        cmd_quiz()
    elif cmd == "html":
        cmd_html()
    elif cmd == "import":
        cmd_import(sys.argv[2] if len(sys.argv) > 2 else sys.stdin.read())
    elif cmd == "stats":
        cmd_stats()
    elif cmd == "plan":
        cmd_plan()
    elif cmd == "build":
        cmd_build()
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
