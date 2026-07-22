#!/usr/bin/env python3
"""JS/Python FSRS 引擎对照测试: 同一评分序列, 两边 stability/difficulty/interval 必须一致。"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tool"))
from fsrs_engine import CardState, ExamConfig, review  # noqa: E402

SEQUENCES = [
    {"grades": [3, 3, 3, 3], "exam": {"daysToExam": 120}},
    {"grades": [3, 1, 3, 3, 4], "exam": {"daysToExam": 120}},
    {"grades": [2, 3, 2, 1, 3], "exam": {"daysToExam": 60}},
    {"grades": [4, 4, 4], "exam": {"daysToExam": 10}},   # 压缩模式
    {"grades": [1, 3, 3], "exam": {"daysToExam": 5}},    # 压缩模式
    {"grades": [3, 3], "exam": {"daysToExam": 45}},      # retention 爬坡区
]

NODE_SCRIPT = r"""
const FSRS = require(process.argv[1] + '/app/fsrs.js');
const seqs = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const out = seqs.map(({grades, exam}) => {
  const ex = {daysToExam: exam.daysToExam, base: 0.80, peak: 0.88, rampDays: 90, compressDays: 14};
  let st = {stability: 0, difficulty: 0, reps: 0, lapses: 0, elapsedDays: 0};
  const steps = [];
  for (const g of grades) {
    const r = FSRS.review(st, g, ex);
    steps.push({s: r.state.stability, d: r.state.difficulty, ivl: r.intervalDays, lapses: r.state.lapses});
    st = r.state;
    st.elapsedDays = r.intervalDays;   // 模拟按期复习
  }
  return steps;
});
console.log(JSON.stringify(out));
"""


def python_run() -> list:
    out = []
    for seq in SEQUENCES:
        ec = ExamConfig(days_to_exam=seq["exam"]["daysToExam"])
        st = CardState()
        steps = []
        for g in seq["grades"]:
            st, ivl = review(st, g, ec)
            steps.append({"s": st.stability, "d": st.difficulty, "ivl": ivl, "lapses": st.lapses})
            st.elapsed_days = ivl
        out.append(steps)
    return out


def main() -> None:
    node_out = json.loads(subprocess.run(
        ["node", "-e", NODE_SCRIPT, str(ROOT)],
        input=json.dumps(SEQUENCES), capture_output=True, text=True, check=True,
    ).stdout)
    py_out = python_run()
    for i, (ns, ps) in enumerate(zip(node_out, py_out)):
        for j, (n, p) in enumerate(zip(ns, ps)):
            assert n["ivl"] == p["ivl"] and n["lapses"] == p["lapses"], f"seq{i} step{j}: {n} vs {p}"
            assert abs(n["s"] - p["s"]) < 1e-9, f"seq{i} step{j} stability: {n['s']} vs {p['s']}"
            assert abs(n["d"] - p["d"]) < 1e-9, f"seq{i} step{j} difficulty: {n['d']} vs {p['d']}"
    print(f"parity check OK: {len(SEQUENCES)} sequences, JS === Python")


if __name__ == "__main__":
    main()
