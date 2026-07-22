/* 数据层: localStorage 调度状态 + 选题逻辑 (与 tool/cfa.py 一致) + GitHub 进度回传 */
'use strict';

const Store = (() => {
  const KEY = 'cfa_l2_v1';
  const TIER_MULT = { A: 3.0, B: 1.5, C: 0.5 };

  let bank = null;          // app/bank.json 内容
  let db = null;            // {cards:{id:{s,d,reps,lapses,last,due}}, reviews:[], settings:{}, pendingSync:[]}

  function todayStr(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  }

  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { db = null; }
    if (!db) db = { cards: {}, reviews: [], settings: {}, pendingSync: [] };
    if (!db.pendingSync) db.pendingSync = [];
    return db;
  }

  function save() { localStorage.setItem(KEY, JSON.stringify(db)); }

  function settings() {
    const def = bank ? bank.defaults : {};
    return Object.assign({
      examDate: def.exam_date || '2026-11-20',
      newPerDay: (def.daily && def.daily.new_per_day) || 3,
      timeBudget: (def.daily && def.daily.time_budget_minutes) || 40,
      reviewCap: (def.daily && def.daily.review_cap) || 40,
      ghToken: '', ghRepo: 'hanbing6228/CFA', ghBranch: 'claude/cfa-level2-low-effort-tool-tjdjyg',
    }, db.settings);
  }

  function setSettings(patch) { Object.assign(db.settings, patch); save(); }

  function daysToExam() {
    const s = settings();
    return Math.ceil((new Date(s.examDate + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000);
  }

  function examCfg() {
    const r = bank.defaults.retention || {};
    return {
      daysToExam: Math.max(0, daysToExam()),
      base: r.base || 0.80, peak: r.peak || 0.88,
      rampDays: r.ramp_days || 90, compressDays: r.compress_days || 14,
    };
  }

  function cardState(id) {
    return db.cards[id] || { stability: 0, difficulty: 0, reps: 0, lapses: 0, last: null, due: null };
  }

  function topicMeta(t) { return bank.topics[t] || { tier: 'C', weight: 5 }; }

  function dueCards() {
    const today = todayStr();
    const rows = bank.questions.filter(q => {
      const c = cardState(q.id);
      return c.reps > 0 && c.due && c.due <= today;
    });
    return rows.sort((a, b) => prio(b) - prio(a));
    function prio(q) {
      const m = topicMeta(q.topic);
      const c = cardState(q.id);
      const overdue = Math.max(1, Math.round((new Date(today) - new Date(c.due)) / 86400000) + 1);
      return m.weight * TIER_MULT[m.tier] * overdue;
    }
  }

  function newQuota() {
    if (FSRS.inCompressMode(examCfg())) return 0;   // 考前14天停新题
    return settings().newPerDay;
  }

  function newCards(quota) {
    if (quota <= 0) return [];
    const rows = bank.questions.filter(q => cardState(q.id).reps === 0);
    rows.sort((a, b) => {
      const ma = topicMeta(a.topic), mb = topicMeta(b.topic);
      return mb.weight * TIER_MULT[mb.tier] - ma.weight * TIER_MULT[ma.tier];
    });
    return rows.slice(0, quota);
  }

  function buildSession() {
    const s = settings();
    return dueCards().slice(0, s.reviewCap).concat(newCards(newQuota()));
  }

  /* grade: 1..4 → 更新 FSRS 状态并记日志 */
  function applyGrade(q, grade) {
    const c = cardState(q.id);
    const elapsed = c.last ? Math.max(0, (Date.now() - new Date(c.last).getTime()) / 86400000) : 0;
    const r = FSRS.review(
      { stability: c.stability, difficulty: c.difficulty, reps: c.reps, lapses: c.lapses, elapsedDays: elapsed },
      grade, examCfg()
    );
    db.cards[q.id] = {
      stability: r.state.stability, difficulty: r.state.difficulty,
      reps: r.state.reps, lapses: r.state.lapses,
      last: new Date().toISOString(), due: todayStr(r.intervalDays),
    };
    db.reviews.push({ id: q.id, ts: new Date().toISOString(), grade, correct: grade > 1 ? 1 : 0, topic: q.topic, los: q.los });
    save();
    return r.intervalDays;
  }

  /* LOS 级看板数据 */
  function statsData() {
    const byTopic = {};
    for (const q of bank.questions) {
      const t = byTopic[q.topic] || (byTopic[q.topic] = { meta: topicMeta(q.topic), los: {} });
      const l = t.los[q.los] || (t.los[q.los] = { n: 0, right: 0, qids: [] });
      l.qids.push(q.id);
    }
    for (const rv of db.reviews) {
      const t = byTopic[rv.topic];
      if (!t || !t.los[rv.los]) continue;
      t.los[rv.los].n += 1;
      t.los[rv.los].right += rv.correct;
    }
    return byTopic;
  }

  function streakInfo() {
    const days = new Set(db.reviews.map(r => r.ts.slice(0, 10)));
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = todayStr(-i);
      if (days.has(d)) streak++;
      else if (i === 0) continue;   // 今天还没做不算断
      else break;
    }
    return { streak, doneToday: days.has(todayStr()) };
  }

  /* ---- GitHub 进度回传 (AI督学数据源) ---- */
  async function ghPut(path, content, msg) {
    const s = settings();
    if (!s.ghToken) return { ok: false, reason: 'no-token' };
    const url = `https://api.github.com/repos/${s.ghRepo}/contents/${path}`;
    const headers = { Authorization: `Bearer ${s.ghToken}`, Accept: 'application/vnd.github+json' };
    let sha;
    const probe = await fetch(`${url}?ref=${s.ghBranch}`, { headers });
    if (probe.ok) sha = (await probe.json()).sha;
    const body = { message: msg, branch: s.ghBranch, content: btoa(unescape(encodeURIComponent(content))) };
    if (sha) body.sha = sha;
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
    return { ok: res.ok, reason: res.ok ? '' : `HTTP ${res.status}` };
  }

  async function syncToday(sessionSummary) {
    const date = todayStr();
    const payload = {
      date, ...sessionSummary,
      reviews: db.reviews.filter(r => r.ts.slice(0, 10) === date),
      streak: streakInfo().streak,
    };
    const item = { path: `progress/${date}.json`, content: JSON.stringify(payload, null, 2), msg: `progress: ${date}` };
    const res = await ghPut(item.path, item.content, item.msg).catch(() => ({ ok: false, reason: 'network' }));
    if (!res.ok && res.reason !== 'no-token') {
      db.pendingSync = db.pendingSync.filter(p => p.path !== item.path).concat([item]);
      save();
    }
    return res;
  }

  async function flushPending() {
    const rest = [];
    for (const item of db.pendingSync) {
      const res = await ghPut(item.path, item.content, item.msg).catch(() => ({ ok: false }));
      if (!res.ok) rest.push(item);
    }
    db.pendingSync = rest;
    save();
  }

  function exportData() { return JSON.stringify(db); }
  function importData(text) {
    const d = JSON.parse(text);
    if (!d.cards || !d.reviews) throw new Error('格式不对');
    db = Object.assign({ pendingSync: [] }, d);
    save();
  }
  function resetData() { db = { cards: {}, reviews: [], settings: db.settings, pendingSync: [] }; save(); }

  async function init() {
    load();
    const res = await fetch('bank.json', { cache: 'no-cache' }).catch(() => null);
    if (res && res.ok) {
      bank = await res.json();
      localStorage.setItem(KEY + '_bank', JSON.stringify(bank));
    } else {
      bank = JSON.parse(localStorage.getItem(KEY + '_bank') || 'null');
      if (!bank) throw new Error('题库加载失败且无缓存');
    }
    return bank;
  }

  return {
    init, settings, setSettings, daysToExam, examCfg,
    buildSession, dueCards, newCards, newQuota, applyGrade,
    statsData, streakInfo, cardState,
    syncToday, flushPending, exportData, importData, resetData,
    get bank() { return bank; }, get db() { return db; }, todayStr,
  };
})();
