/* FSRS-4.5 调度引擎 —— tool/fsrs_engine.py 的 1:1 移植。
 * 改动必须两边同步, 对照测试: node tool/test_fsrs_parity.mjs */
'use strict';

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
const DECAY = -0.5;
const FACTOR = 19.0 / 81.0;

const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

function retrievability(elapsedDays, stability) {
  if (stability <= 0) return 0;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

function intervalForRetention(stability, desiredRetention) {
  return (stability / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
}

function initDifficulty(grade) {
  const d = W[4] - Math.exp(W[5] * (grade - 1)) + 1;
  return Math.min(Math.max(d, 1), 10);
}

function initStability(grade) {
  return Math.max(W[grade - 1], 0.1);
}

function nextDifficulty(d, grade) {
  let dn = d - W[6] * (grade - 3);
  dn = W[7] * initDifficulty(EASY) + (1 - W[7]) * dn;
  return Math.min(Math.max(dn, 1), 10);
}

function stabilityAfterRecall(d, s, r, grade) {
  const hardPenalty = grade === HARD ? W[15] : 1;
  const easyBonus = grade === EASY ? W[16] : 1;
  const inc = Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9])
    * (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus;
  return s * (1 + inc);
}

function stabilityAfterForget(d, s, r) {
  const sf = W[11] * Math.pow(d, -W[12])
    * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(Math.max(sf, 0.1), s);
}

/* exam: {daysToExam, base, peak, rampDays, compressDays} */
function desiredRetention(exam) {
  if (exam.daysToExam >= exam.rampDays) return exam.base;
  const frac = 1 - exam.daysToExam / exam.rampDays;
  return exam.base + (exam.peak - exam.base) * frac;
}

function inCompressMode(exam) {
  return exam.daysToExam <= exam.compressDays;
}

/* state: {stability, difficulty, reps, lapses, elapsedDays} → {state, intervalDays} */
function fsrsReview(state, grade, exam) {
  let d, s, lapses;
  if (state.reps === 0) {
    d = initDifficulty(grade);
    s = initStability(grade);
    lapses = grade === AGAIN ? 1 : 0;
  } else {
    const r = retrievability(state.elapsedDays, state.stability);
    d = nextDifficulty(state.difficulty, grade);
    if (grade === AGAIN) {
      s = stabilityAfterForget(state.difficulty, state.stability, r);
      lapses = state.lapses + 1;
    } else {
      s = stabilityAfterRecall(state.difficulty, state.stability, r, grade);
      lapses = state.lapses;
    }
  }
  let ivlDays = Math.max(1, Math.round(intervalForRetention(s, desiredRetention(exam))));
  if (exam.daysToExam > 0) {
    ivlDays = Math.min(ivlDays, Math.max(1, exam.daysToExam));
    if (inCompressMode(exam)) {
      ivlDays = Math.min(ivlDays, Math.max(1, Math.floor(exam.daysToExam / 3)));
    }
  }
  if (grade === AGAIN) ivlDays = 1;
  return {
    state: { stability: s, difficulty: d, reps: state.reps + 1, lapses, elapsedDays: 0 },
    intervalDays: ivlDays,
  };
}

const FSRS = {
  AGAIN, HARD, GOOD, EASY,
  review: fsrsReview, retrievability, desiredRetention, inCompressMode,
};

if (typeof module !== 'undefined') module.exports = FSRS;
if (typeof window !== 'undefined') window.FSRS = FSRS;
