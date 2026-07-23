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
    if (!db) db = { cards: {}, reviews: [], settings: {}, pendingSync: [], notes: {}, mocks: [], xp: 0 };
    if (!db.pendingSync) db.pendingSync = [];
    if (!db.notes) db.notes = {};
    if (!db.mocks) db.mocks = [];
    if (!db.xp) db.xp = 0;
    if (!db.learned) db.learned = {};
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
      aiKey: '', aiModel: 'claude-sonnet-5',
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

  /* 阶段引擎: 距考天数 → 当前 Sprint 阶段 (机构流水线的阶段化) */
  function phase() {
    const d = daysToExam();
    if (d > 100) return { key: 'base', name: '基础 Sprint', desc: '只做题不读书,每天 3 新题+复习', icon: '🏗' };
    if (d > 42) return { key: 'hundred', name: '百日冲刺', desc: '错题回炉加权,每 2 周一次 Mock', icon: '🔥' };
    if (d > 14) return { key: 'sprint', name: '冲刺包', desc: '每周 Mock + 框架图,只保已会的', icon: '⚡' };
    return { key: 'compress', name: '压缩期', desc: '停新题,只清复习 + 刷框架图', icon: '🎯' };
  }

  function addXp(n) { db.xp += n; save(); return db.xp; }

  function cardState(id) {
    return db.cards[id] || { stability: 0, difficulty: 0, reps: 0, lapses: 0, last: null, due: null };
  }

  function topicMeta(t) {
    const base = bank.topics[t] || { tier: 'C', weight: 5 };
    const ov = (settings().tierOverride || {})[t];
    return ov ? Object.assign({}, base, { tier: ov }) : base;
  }
  function setTier(topic, tier) {
    db.settings.tierOverride = db.settings.tierOverride || {};
    db.settings.tierOverride[topic] = tier;
    save();
  }

  /* 每科统计 + 通过率预测 (作战计划仪表盘) */
  function topicStats() {
    const out = {};
    for (const t in bank.topics) {
      const m = topicMeta(t);
      out[t] = { topic: t, n: 0, right: 0, tier: m.tier, weight: m.weight, name_cn: m.name_cn,
                 total: bank.questions.filter(q => q.topic === t).length };
    }
    for (const r of db.reviews) if (out[r.topic]) { out[r.topic].n++; out[r.topic].right += r.correct; }
    for (const t in out) out[t].acc = out[t].n ? out[t].right / out[t].n : null;
    return out;
  }
  function projectedScore() {
    const ts = topicStats();
    let num = 0, den = 0;
    for (const t in ts) {
      const w = ts[t].weight || 0;
      const acc = ts[t].acc == null ? 0.40 : ts[t].acc;   // 未测科目按 40% 保守估
      num += w * acc; den += w;
    }
    return den ? num / den : 0;
  }
  function practiceTopic(topic, n) {
    const today = todayStr();
    const dues = bank.questions.filter(q => {
      const c = cardState(q.id); return c.reps > 0 && c.due && c.due <= today && q.topic === topic;
    });
    const fresh = bank.questions.filter(q => q.topic === topic && cardState(q.id).reps === 0);
    for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
    return injectLessons(groupByCase(dues.concat(fresh).slice(0, n)));
  }

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
      // 错题回炉加权: 百日冲刺起 lapse 越多优先级越高 (强化 Sprint 机制)
      const lapseBoost = 1 + Math.min(c.lapses, 3) * (phase().key === 'base' ? 0.2 : 0.5);
      return m.weight * TIER_MULT[m.tier] * overdue * lapseBoost;
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

  /* 同一 case 的题连续出现 (vignette 完整性), 位置取组内最先出现的那题 */
  function groupByCase(list) {
    const out = [], seen = new Set();
    for (const q of list) {
      if (seen.has(q.id)) continue;
      out.push(q); seen.add(q.id);
      if (q.case) {
        for (const q2 of list) {
          if (!seen.has(q2.id) && q2.case === q.case) { out.push(q2); seen.add(q2.id); }
        }
      }
    }
    return out;
  }

  /* 微课: 首次遇到某 LOS 的新题时, 先教后测 (Bloomberg 微课模式) */
  function lessonKey(q) { return q.topic + '|' + q.los; }
  function getLesson(q) { return (bank.lessons || {})[lessonKey(q)] || null; }
  function markLearned(q) { db.learned[lessonKey(q)] = todayStr(); save(); }

  function injectLessons(list) {
    const out = [], injected = new Set();
    for (const q of list) {
      const k = lessonKey(q);
      if (cardState(q.id).reps === 0 && !db.learned[k] && !injected.has(k)) {
        const cards = getLesson(q);
        if (cards) { out.push({ _lesson: true, topic: q.topic, los: q.los, cards }); injected.add(k); }
      }
      out.push(q);
    }
    return out;
  }

  function buildSession() {
    const s = settings();
    return injectLessons(groupByCase(dueCards().slice(0, s.reviewCap).concat(newCards(newQuota()))));
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
    const items = [
      { path: `progress/${date}.json`, content: JSON.stringify(payload, null, 2), msg: `progress: ${date}` },
      // 全量状态云备份 (换手机/丢数据的保险), 永不包含 token
      { path: 'progress/state-backup.json', content: backupData(), msg: `state backup: ${date}` },
    ];
    let first = null;
    for (const item of items) {
      const res = await ghPut(item.path, item.content, item.msg).catch(() => ({ ok: false, reason: 'network' }));
      if (!first) first = res;
      if (!res.ok && res.reason !== 'no-token') {
        db.pendingSync = db.pendingSync.filter(p => p.path !== item.path).concat([item]);
        save();
      }
    }
    return first;
  }

  function backupData() {
    const copy = JSON.parse(JSON.stringify(db));
    delete copy.pendingSync;
    if (copy.settings) delete copy.settings.ghToken;
    return JSON.stringify(copy);
  }

  function setNote(id, text) {
    if (text && text.trim()) db.notes[id] = { text: text.trim(), ts: new Date().toISOString() };
    else delete db.notes[id];
    save();
  }
  function getNote(id) { return db.notes[id] ? db.notes[id].text : ''; }

  async function flushPending() {
    const rest = [];
    for (const item of db.pendingSync) {
      const res = await ghPut(item.path, item.content, item.msg).catch(() => ({ ok: false }));
      if (!res.ok) rest.push(item);
    }
    db.pendingSync = rest;
    save();
  }

  /* ---- Mock 模式 (冲刺包机制: 20题连做→成绩单→错因分类) ---- */
  function buildMock(n = 20) {
    // 按 topic 权重加权抽样后交错洗牌 (interleaving: Rohrer & Taylor 2007)
    const pool = bank.questions.slice();
    const weighted = [];
    for (const q of pool) {
      const m = topicMeta(q.topic);
      weighted.push({ q, w: m.weight * TIER_MULT[m.tier] * (0.7 + Math.random()) });
    }
    weighted.sort((a, b) => b.w - a.w);
    const byTopic = {};
    for (const { q } of weighted) (byTopic[q.topic] = byTopic[q.topic] || []).push(q);
    const topics = Object.keys(byTopic);
    const out = [];
    let i = 0;
    while (out.length < Math.min(n, pool.length)) {   // 轮转取题保证跨科目交错
      const t = topics[i % topics.length];
      if (byTopic[t].length) out.push(byTopic[t].shift());
      i += 1;
      if (topics.every(t2 => !byTopic[t2].length)) break;
    }
    return groupByCase(out);
  }

  async function saveMock(mock) {
    // mock: {date, n, right, minutes, answers:[{id,topic,los,picked,correct,cause?}]}
    db.mocks.push(mock);
    // mock 结果同样喂给调度器: 对=Good, 错=Again
    for (const a of mock.answers) {
      const q = bank.questions.find(x => x.id === a.id);
      if (q) applyGrade(q, a.correct ? 3 : 1);
    }
    save();
    const item = {
      path: `progress/mock-${mock.date}.json`,
      content: JSON.stringify(mock, null, 2), msg: `mock: ${mock.date}`,
    };
    const res = await ghPut(item.path, item.content, item.msg).catch(() => ({ ok: false, reason: 'network' }));
    if (!res.ok && res.reason !== 'no-token') { db.pendingSync.push(item); save(); }
    return res;
  }

  function daysSinceMock() {
    if (!db.mocks.length) return Infinity;
    const last = db.mocks[db.mocks.length - 1].date;
    return Math.round((new Date(todayStr()) - new Date(last)) / 86400000);
  }

  /* 内联 AI 家教: 直接调 Anthropic API (浏览器直连), 无需复制去别处 */
  async function askTutor(prompt) {
    const key = settings().aiKey;
    if (!key) return { ok: false, reason: 'no-key' };
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings().aiModel || 'claude-sonnet-5',
          max_tokens: 700,
          system: '你是 CFA L2 私人家教。用最简单的中文讲清楚，配一个新例子，别重复原题解析。专业术语保留英文。回答控制在 200 字内。',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, text: (data.content || []).map(b => b.text || '').join('') };
    } catch (e) {
      return { ok: false, reason: 'network' };
    }
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
    statsData, streakInfo, cardState, setNote, getNote,
    phase, addXp, buildMock, saveMock, daysSinceMock, markLearned, getLesson, askTutor,
    setTier, topicStats, projectedScore, practiceTopic, topicMeta,
    syncToday, flushPending, exportData, importData, resetData,
    get bank() { return bank; }, get db() { return db; }, todayStr,
  };
})();
