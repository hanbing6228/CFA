"""FSRS-4.5 调度引擎（零依赖内嵌实现）+ 考试日期感知层。

FSRS 建模三个量：
  D (Difficulty)      卡片难度，1..10
  S (Stability)       记忆稳定度，= 保留率降到 90% 所需天数
  R (Retrievability)  当前可提取概率

考试日期感知层（标准 FSRS 没有，这是自建工具的核心优势）：
  1. max_interval = 距考天数 —— 保证每张卡考前至少过一遍（Anki 社区做法）
  2. desired retention 随考期逼近从 0.80 爬升到 0.88（RemNote Exam Scheduler 思路）
  3. 考前 14 天进入压缩模式：区间再压缩、停新卡（AnKing burnout buffer）
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

# FSRS-4.5 默认参数（open-spaced-repetition/py-fsrs）
W = [
    0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
    1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
]

DECAY = -0.5
FACTOR = 19.0 / 81.0  # 使 R(S, S) = 0.90

# 评分：1=Again(错) 2=Hard(蒙对/很勉强) 3=Good(答对) 4=Easy(秒杀)
AGAIN, HARD, GOOD, EASY = 1, 2, 3, 4


def retrievability(elapsed_days: float, stability: float) -> float:
    """R(t, S) —— t 天后还能提取的概率。"""
    if stability <= 0:
        return 0.0
    return (1.0 + FACTOR * elapsed_days / stability) ** DECAY


def interval_for_retention(stability: float, desired_retention: float) -> float:
    """给定目标保留率，反解复习间隔（天）。"""
    return (stability / FACTOR) * (desired_retention ** (1.0 / DECAY) - 1.0)


def _init_difficulty(grade: int) -> float:
    d = W[4] - math.exp(W[5] * (grade - 1)) + 1.0
    return min(max(d, 1.0), 10.0)


def _init_stability(grade: int) -> float:
    return max(W[grade - 1], 0.1)


def _next_difficulty(d: float, grade: int) -> float:
    dn = d - W[6] * (grade - 3)
    # mean reversion 防止难度锁死（FSRS 对 SM-2 "ease hell" 的修复）
    dn = W[7] * _init_difficulty(EASY) + (1.0 - W[7]) * dn
    return min(max(dn, 1.0), 10.0)


def _stability_after_recall(d: float, s: float, r: float, grade: int) -> float:
    hard_penalty = W[15] if grade == HARD else 1.0
    easy_bonus = W[16] if grade == EASY else 1.0
    inc = (
        math.exp(W[8])
        * (11.0 - d)
        * s ** (-W[9])
        * (math.exp(W[10] * (1.0 - r)) - 1.0)
        * hard_penalty
        * easy_bonus
    )
    return s * (1.0 + inc)


def _stability_after_forget(d: float, s: float, r: float) -> float:
    sf = (
        W[11]
        * d ** (-W[12])
        * ((s + 1.0) ** W[13] - 1.0)
        * math.exp(W[14] * (1.0 - r))
    )
    return min(max(sf, 0.1), s)  # 忘了以后稳定度不可能比忘前还高


@dataclass
class CardState:
    stability: float = 0.0
    difficulty: float = 0.0
    reps: int = 0
    lapses: int = 0
    elapsed_days: float = 0.0  # 距上次复习的天数


@dataclass
class ExamConfig:
    days_to_exam: int
    base_retention: float = 0.80   # just-pass 起点（省时）
    peak_retention: float = 0.88   # 考前目标（RemNote: <0.78 反而更费时，别再低）
    ramp_days: int = 90            # 从考前 90 天开始爬坡
    compress_days: int = 14        # 考前 14 天压缩模式

    @property
    def desired_retention(self) -> float:
        if self.days_to_exam >= self.ramp_days:
            return self.base_retention
        frac = 1.0 - self.days_to_exam / self.ramp_days
        return self.base_retention + (self.peak_retention - self.base_retention) * frac

    @property
    def in_compress_mode(self) -> bool:
        return self.days_to_exam <= self.compress_days


def review(state: CardState, grade: int, exam: ExamConfig) -> tuple[CardState, int]:
    """执行一次复习，返回 (新状态, 下次间隔天数)。"""
    assert grade in (AGAIN, HARD, GOOD, EASY), f"bad grade {grade}"

    if state.reps == 0:
        d = _init_difficulty(grade)
        s = _init_stability(grade)
        lapses = 1 if grade == AGAIN else 0
    else:
        r = retrievability(state.elapsed_days, state.stability)
        d = _next_difficulty(state.difficulty, grade)
        if grade == AGAIN:
            s = _stability_after_forget(state.difficulty, state.stability, r)
            lapses = state.lapses + 1
        else:
            s = _stability_after_recall(state.difficulty, state.stability, r, grade)
            lapses = state.lapses

    ivl = interval_for_retention(s, exam.desired_retention)
    ivl_days = max(1, round(ivl))

    # ---- 考试日期感知层 ----
    if exam.days_to_exam > 0:
        ivl_days = min(ivl_days, max(1, exam.days_to_exam))  # 考前必过一遍
        if exam.in_compress_mode:
            ivl_days = min(ivl_days, max(1, exam.days_to_exam // 3))
    if grade == AGAIN:
        ivl_days = 1  # 错题次日必回炉

    new_state = CardState(stability=s, difficulty=d, reps=state.reps + 1, lapses=lapses)
    return new_state, ivl_days


def sanity_check() -> None:
    """基本不变量自检（供测试脚本调用）。"""
    exam = ExamConfig(days_to_exam=120)
    st = CardState()
    st, ivl1 = review(st, GOOD, exam)
    assert st.stability > 0 and 1 <= st.difficulty <= 10
    st.elapsed_days = ivl1
    st2, ivl2 = review(st, GOOD, exam)
    assert st2.stability > st.stability, "连续答对稳定度应增长"
    assert ivl2 >= ivl1, "连续答对间隔应拉长"
    st2.elapsed_days = ivl2
    st3, ivl3 = review(st2, AGAIN, exam)
    assert st3.stability < st2.stability, "答错稳定度应下降"
    assert ivl3 == 1 and st3.lapses == 1

    # 考期封顶
    near = ExamConfig(days_to_exam=5)
    big = CardState(stability=200.0, difficulty=3.0, reps=5, elapsed_days=30.0)
    _, ivl = review(big, EASY, near)
    assert ivl <= 5, "间隔不得越过考试日"
    # retention 爬坡
    assert ExamConfig(days_to_exam=120).desired_retention == 0.80
    assert abs(ExamConfig(days_to_exam=0).desired_retention - 0.88) < 1e-9
    assert 0.80 < ExamConfig(days_to_exam=45).desired_retention < 0.88


if __name__ == "__main__":
    sanity_check()
    print("fsrs_engine sanity check: OK")
