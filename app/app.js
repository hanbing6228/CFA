/* UI 层: 四屏 hash 路由 (今日/答题/弱点/设置) */
'use strict';

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* fmt: 转义 + 渲染 $...$ 公式。用于题干/解析/步骤/微课/框架等所有含公式的正文。 */
const fmt = s => (window.MathFmt ? MathFmt.renderText(s) : esc(s));

/* richText: 在 fmt 基础上再渲染 **加粗** 与 ==高亮== (微课/生动内容用)。
 * 先按 $...$ 拆分, 公式段走 MathFmt, 文字段做 markup。 */
function richText(raw) {
  const parts = String(raw).split(/(\$\$[^$]*\$\$|\$[^$]*\$)/g);
  return parts.map(p => {
    if (p.startsWith('$') && p.endsWith('$') && p.length > 1) return fmt(p);
    let h = esc(p);
    h = h.replace(/==([^=]+)==/g, '<mark class="hl">$1</mark>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b class="kw">$1</b>');
    return h.replace(/\n/g, '<br>');
  }).join('');
}

const LESSON_KIND = [
  { re: /什么|为什么|是啥|背景/, cls: 'what', icon: '💡' },
  { re: /公式|规则|核心|定义/, cls: 'formula', icon: '📐' },
  { re: /例|算|计算|演示/, cls: 'example', icon: '🔢' },
  { re: /陷阱|坑|易错|注意|区分|别/, cls: 'trap', icon: '⚠️' },
  { re: /记|口诀|钩子|类比|技巧/, cls: 'hook', icon: '🧲' },
];
function lessonKind(h) {
  for (const k of LESSON_KIND) if (k.re.test(h)) return k;
  return { cls: 'default', icon: '📌' };
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- 今日屏 ---------- */
function renderToday() {
  const main = $('#main');
  main.innerHTML = '';
  const dte = Store.daysToExam();
  const ec = Store.examCfg();
  const dues = Store.dueCards().slice(0, Store.settings().reviewCap);
  const news = Store.newCards(Store.newQuota());
  const total = dues.length + news.length;
  const nLessons = Store.buildSession().filter(x => x._lesson).length;
  const est = Math.round(total * 1.8 + nLessons * 1.5);
  const { streak, doneToday } = Store.streakInfo();

  const ph = Store.phase();
  const hero = el('div', 'card hero');
  hero.appendChild(el('div', 'days',
    `${ph.icon} <b>${ph.name}</b> · 距考试 <b>${dte}</b> 天<br><span class="muted">${ph.desc}</span>`));
  hero.appendChild(el('h1', '', doneToday ? '今天已经赢了 ✅' : '今天的仗很小,能赢'));
  const duo = el('div', 'duo');
  duo.appendChild(el('div', 'card', `<div class="num">${dues.length}</div><div class="lbl">到期复习</div>`));
  duo.appendChild(el('div', 'card', `<div class="num">${news.length}</div><div class="lbl">新题</div>`));
  hero.appendChild(duo);

  const btn = el('button', 'bigbtn', total ? '开始 · 先做 1 题就算赢' : '今天没有任务 🎉');
  btn.disabled = !total;
  btn.onclick = () => { location.hash = '#quiz'; };
  hero.appendChild(btn);

  const pills = el('div', 'pillrow');
  pills.appendChild(el('span', 'pill', `⏱ 预计 ${est} 分钟`));
  if (nLessons) pills.appendChild(el('span', 'pill', `📖 含 ${nLessons} 节微课`));
  pills.appendChild(el('span', 'pill', `🎯 保留率 ${FSRS.desiredRetention(ec).toFixed(2)}`));
  if (streak > 0) pills.appendChild(el('span', 'pill', `🔥 连续 ${streak} 天`));
  if (Store.db.xp > 0) pills.appendChild(el('span', 'pill', `⭐ ${Store.db.xp} XP`));
  hero.appendChild(pills);
  if (est > Store.settings().timeBudget) {
    hero.appendChild(el('p', 'warn', `今天超时间预算了——做完复习就够,新题可跳过`));
  }
  main.appendChild(hero);

  if (dues.length) {
    const byTopic = {};
    dues.forEach(q => { byTopic[q.topic] = (byTopic[q.topic] || 0) + 1; });
    const detail = Object.entries(byTopic).sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t}×${n}`).join(' · ');
    main.appendChild(el('div', 'card muted', `复习分布: ${esc(detail)}`));
  }
  // Mock 提示 (冲刺包机制: 百日冲刺每2周, 冲刺包每周)
  const sinceMock = Store.daysSinceMock();
  if (ph.key === 'hundred' || ph.key === 'sprint') {
    const cadence = ph.key === 'sprint' ? 7 : 14;
    const dueMock = sinceMock >= cadence;
    const mc = el('div', 'card');
    mc.appendChild(el('div', '', `📝 <b>Mock 20 题</b> <span class="muted">${sinceMock === Infinity ? '还没做过' : `上次 ${sinceMock} 天前`} · 本阶段每 ${cadence} 天一次</span>`));
    const mb = el('button', 'bigbtn' + (dueMock ? '' : ' secondary'), dueMock ? '该做 Mock 了 ▸' : '提前做一次 Mock');
    mb.style.marginTop = '10px';
    mb.onclick = () => { location.hash = '#mock'; };
    mc.appendChild(mb);
    main.appendChild(mc);
  }

  // 作战计划卡 (权重策略可见化: 放弃清单不再纠结)
  const plan = el('div', 'card');
  const tiers = { A: [], B: [], C: [] };
  Object.entries(Store.bank.topics).forEach(([k, v]) => tiers[v.tier].push(k));
  plan.innerHTML = `<h2>📋 作战计划</h2>
    <div class="losrow">🔴 <b>满仓 A</b> (3x额度, 目标>70%): ${tiers.A.join(' / ')}</div>
    <div class="losrow">🔵 <b>保底 B</b> (1.5x, 目标~60%): ${tiers.B.join(' / ')}</div>
    <div class="losrow">⚪ <b>战略放弃 C</b> (0.5x, 蒙题保底): ${tiers.C.join(' / ')}</div>
    <div class="muted" style="margin-top:8px">阶段: 基础(>100天)→百日冲刺(43-100)→冲刺包(15-42)→压缩(≤14)。当前: ${ph.icon} ${ph.name}。放弃是策略, 不再纠结。</div>`;
  main.appendChild(plan);

  const s = Store.settings();
  if (!s.ghToken) {
    const c = el('div', 'card muted',
      `🤖 AI 督学未连接——去<a href="#settings" style="color:var(--accent)">设置</a>里贴一个 GitHub token,晚上没做题我会来提醒你`);
    main.appendChild(c);
  }
}

/* ---------- Case/vignette 面板 (L2 题型: 背景+Exhibit+一组题) ---------- */
function casePanel(q, expanded) {
  if (!q.case || !Store.bank.cases || !Store.bank.cases[q.case]) return null;
  const c = Store.bank.cases[q.case];
  const d = el('details', 'casebox');
  if (expanded) d.open = true;
  d.appendChild(el('summary', '', `📄 ${esc(c.title)} <span class="muted">(案例背景与图表)</span>`));
  if (c.background) d.appendChild(el('p', 'casebg', fmt(c.background)));
  for (const src of c.images || []) {     // PDF 抽出的 Exhibit 图表/公式图
    const im = el('img', 'eximg');
    im.loading = 'lazy'; im.src = src; im.alt = 'Exhibit';
    d.appendChild(im);
  }
  for (const ex of c.exhibits || []) {
    d.appendChild(el('div', 'extitle', esc(ex.title)));
    const wrap = el('div', 'exwrap');
    const tb = el('table', 'extable');
    (ex.table || []).forEach((row, ri) => {
      const tr = el('tr');
      row.forEach(cell => tr.appendChild(el(ri === 0 ? 'th' : 'td', '', fmt(cell))));
      tb.appendChild(tr);
    });
    wrap.appendChild(tb);
    d.appendChild(wrap);
  }
  return d;
}

/* ---------- 答题屏 ---------- */
const Quiz = { session: null, idx: 0, right: 0, revealed: 0 };

function renderQuiz() {
  const main = $('#main');
  if (!Quiz.session) {
    Quiz.session = Store.buildSession();
    Quiz.idx = 0; Quiz.right = 0;
  }
  if (!Quiz.session.length || Quiz.idx >= Quiz.session.length) return renderDone();
  main.innerHTML = '';
  const q = Quiz.session[Quiz.idx];
  if (q._lesson) return renderLesson(q, main);
  const total = Quiz.session.length;
  const isNew = Store.cardState(q.id).reps === 0;

  const head = el('div', 'qhead');
  head.appendChild(el('span', '', `${Quiz.idx + 1}/${total}`));
  head.appendChild(el('span', 'tag', esc(q.topic)));
  head.appendChild(el('span', 'tag', isNew ? '新题' : '复习'));
  head.appendChild(el('span', '', esc(q.los)));
  main.appendChild(head);
  const prog = el('div', 'progress');
  prog.appendChild(el('i', '', '')).style.width = `${(Quiz.idx / total) * 100}%`;
  main.appendChild(prog);

  const card = el('div', 'card');
  const prevQ = Quiz.idx > 0 ? Quiz.session[Quiz.idx - 1] : null;
  const cp = casePanel(q, !prevQ || prevQ.case !== q.case);   // 同 case 第二题起默认折叠
  if (cp) card.appendChild(cp);
  card.appendChild(el('div', 'stem', fmt(q.stem)));
  const choicesBox = el('div');
  let answered = false;
  ['A', 'B', 'C'].forEach(k => {
    if (!(k in q.choices)) return;
    const b = el('button', 'choice', `<b>${k}.</b> ${fmt(q.choices[k])}`);
    b.dataset.k = k;
    b.onclick = () => {
      if (!answered) { answered = true; onAnswer(q, k, card, choicesBox); }
      else toggleWhy(q, b);   // 已作答: 点其他选项看它的解析 (交互式逐选项)
    };
    choicesBox.appendChild(b);
  });
  card.appendChild(choicesBox);
  main.appendChild(card);
}

/* 微课卡: 逐张揭示 → 学完立刻做该 LOS 的题 (边学边测) */
function renderLesson(item, main) {
  const total = Quiz.session.length;
  const head = el('div', 'qhead');
  head.appendChild(el('span', '', `${Quiz.idx + 1}/${total}`));
  head.appendChild(el('span', 'tag', '📖 微课'));
  head.appendChild(el('span', 'tag', esc(item.topic)));
  head.appendChild(el('span', '', esc(item.los)));
  main.appendChild(head);
  const prog = el('div', 'progress');
  prog.appendChild(el('i', '', '')).style.width = `${(Quiz.idx / total) * 100}%`;
  main.appendChild(prog);

  const card = el('div', 'card');
  const cardsBox = el('div');
  card.appendChild(cardsBox);
  let shown = 0;
  const next = el('button', 'bigbtn', '');
  const showOne = () => {
    const c = item.cards[shown];
    const kind = lessonKind(c.h);
    const lc = el('div', `lesson-card lk-${kind.cls}`);
    lc.appendChild(el('h2', '', `${kind.icon} ${esc(c.h)}`));
    lc.appendChild(el('div', 'lesson-body', richText(c.b)));
    cardsBox.appendChild(lc);
    shown += 1;
    next.textContent = shown < item.cards.length ? `下一张 ▸ (${shown}/${item.cards.length})` : '懂了,开始做题 ▸';
    lc.scrollIntoView({ block: 'nearest' });
  };
  next.onclick = () => {
    if (shown < item.cards.length) { showOne(); return; }
    Store.markLearned(item);
    Store.addXp(5);
    Quiz.idx += 1;
    renderQuiz();
  };
  showOne();
  card.appendChild(next);
  card.appendChild(tutorWidget('🤔 没看懂?让 Claude 换个说法讲', () =>
    `我在学 CFA L2 的 ${item.topic} / ${item.los},下面是微课内容,请用更浅的方式+一个新例子给我讲一遍:\n\n` +
    item.cards.map(c => `${c.h}: ${c.b}`).join('\n')));
  main.appendChild(card);
}

/* 内联 AI 家教控件: 有 API key 就直接在页内出答案, 没有则回退到复制 */
function tutorWidget(label, buildPrompt) {
  const wrap = el('div', 'askrow');
  const btn = el('button', 'askbtn', label);
  btn.onclick = async () => {
    const prompt = buildPrompt();
    if (!Store.settings().aiKey) {
      navigator.clipboard.writeText(prompt).then(
        () => toast('未配 AI key,已复制,去 Claude 粘贴 (设置里贴 key 可页内直接答)'),
        () => toast('复制失败'));
      return;
    }
    btn.style.display = 'none';
    const box = el('div', 'tutor-box');
    box.appendChild(el('div', 'tutor-loading', '🤔 Claude 正在讲…'));
    wrap.appendChild(box);
    const res = await Store.askTutor(prompt);
    box.innerHTML = '';
    if (res.ok) {
      box.appendChild(el('div', '', '🎓 <b>家教</b>'));
      box.appendChild(el('div', 'ans', fmt(res.text)));
    } else if (res.reason === 'no-key') {
      box.appendChild(el('div', 'tutor-loading', '请先在设置里贴 Anthropic API key'));
    } else {
      box.appendChild(el('div', 'tutor-loading', `出错了 (${res.reason})。已把问题复制到剪贴板`));
      navigator.clipboard.writeText(prompt).catch(() => {});
    }
  };
  wrap.appendChild(btn);
  return wrap;
}

function toggleWhy(q, btn) {
  const k = btn.dataset.k;
  let why = btn.querySelector('.why');
  if (why) { why.remove(); addHint(btn, q); return; }
  const hint = btn.querySelector('.whyhint');
  if (hint) hint.remove();
  why = el('span', 'why', `${k === q.answer ? '✓' : '✗'} ${fmt(q.explanations[k])}`);
  btn.appendChild(why);
}

function addHint(btn, q) {
  if (btn.querySelector('.whyhint')) return;
  btn.appendChild(el('span', 'whyhint', btn.dataset.k === q.answer ? '点我看为什么对 ▸' : '点我看为什么错 ▸'));
}

function onAnswer(q, picked, card, choicesBox) {
  const correct = picked === q.answer;
  if (correct) Quiz.right += 1;
  [...choicesBox.children].forEach(b => {
    const k = b.dataset.k;
    if (k === q.answer) b.classList.add('right');
    else if (k === picked) b.classList.add('wrong');
    else b.classList.add('dim');
  });
  // 单块解析题(.pages 真题): 选项下方直接给一整段原文解析
  if (!q.explanations && q.explanation) {
    const ex = el('div', 'single-expl');
    const freqNote = q.freq ? ` · <span class="muted">本题历史正确率 ${q.freq}%</span>` : '';
    ex.innerHTML = `<b>${correct ? '✅ 答对' : '❌ 正确答案 ' + q.answer}</b>${freqNote}<div class="ans">${fmt(q.explanation)}</div>`;
    card.appendChild(ex);
  } else {
  // 默认展开: 我选的 + 正确答案; 其余点击可看 (交互性核心)
  [...choicesBox.children].forEach(b => {
    const k = b.dataset.k;
    if (k === picked || k === q.answer) toggleWhy(q, b);
    else addHint(b, q);
  });
  }

  // calc 题: 分步揭示
  if (q.steps && q.steps.length) {
    const stepsBox = el('div', 'steps');
    let shown = 0;
    const btn = el('button', 'stepbtn', `📐 分步看解题过程 (${q.steps.length} 步) ▸`);
    btn.onclick = () => {
      if (shown < q.steps.length) {
        const st = q.steps[shown];
        stepsBox.insertBefore(el('div', 'step', `<b>${esc(st.label)}</b>${fmt(st.content)}`), btn);
        shown += 1;
        btn.textContent = shown < q.steps.length ? `下一步 ▸ (${shown}/${q.steps.length})` : '✅ 步骤完';
        if (shown >= q.steps.length) btn.disabled = true;
      }
    };
    stepsBox.appendChild(btn);
    card.appendChild(stepsBox);
  }

  if (q.source) card.appendChild(el('div', 'srcline', `📚 出处: ${esc(q.source)}`));

  // 我的笔记 (随云备份保存, 下次复习可见)
  const noteBox = el('div', 'notebox');
  const oldNote = Store.getNote(q.id);
  const noteBtn = el('button', 'askbtn', oldNote ? `📝 我的笔记: ${esc(oldNote.slice(0, 30))}${oldNote.length > 30 ? '…' : ''}` : '📝 记条笔记 (口诀/误区)');
  noteBtn.onclick = () => {
    noteBtn.style.display = 'none';
    const ta = el('textarea', '', '');
    ta.value = oldNote; ta.placeholder = '写给下次复习的自己…';
    const saveN = el('button', 'stepbtn', '保存笔记');
    saveN.onclick = () => { Store.setNote(q.id, ta.value); toast('笔记已存'); ta.blur(); saveN.textContent = '已保存 ✓'; };
    noteBox.appendChild(ta); noteBox.appendChild(saveN);
    ta.focus();
  };
  noteBox.appendChild(noteBtn);
  card.appendChild(noteBox);

  // 内联追问 Claude (有 key 页内直接答)
  card.appendChild(tutorWidget(correct ? '🤔 想更深入?问问 Claude' : '🤔 还是不懂?让 Claude 讲讲我的误区', () =>
    `我在做 CFA L2 练习题,这道题${correct ? '我做对了但想深挖' : `我错选了 ${picked}`}。请针对我的误区讲解,不要重复题目解析:\n\n` +
    `题目: ${q.stem}\n选项: ${Object.entries(q.choices).map(([k, v]) => `${k}. ${v}`).join(' ')}\n` +
    `正确答案: ${q.answer}\n官方解析: ${q.explanations[q.answer]}\n考点: ${q.topic} / ${q.los}`));

  // 评分行
  const conf = el('div', 'confrow');
  if (correct) {
    [['😮‍💨 蒙对的', FSRS.HARD], ['✅ 会做', FSRS.GOOD], ['⚡ 秒杀', FSRS.EASY]].forEach(([label, g], i) => {
      const b = el('button', i === 1 ? 'primary' : '', label);
      b.onclick = () => gradeAndNext(q, g, card);
      conf.appendChild(b);
    });
  } else {
    const b = el('button', 'primary', '明天回炉 · 下一题 ▸');
    b.onclick = () => gradeAndNext(q, FSRS.AGAIN, card);
    conf.appendChild(b);
  }
  card.appendChild(conf);
}

function gradeAndNext(q, grade, card) {
  const ivl = Store.applyGrade(q, grade);
  Store.addXp({ 1: 3, 2: 6, 3: 10, 4: 12 }[grade] || 0);   // 错了也给分: 出现就是赢
  card.querySelector('.confrow').remove();
  const note = el('div', 'nextivl', grade === FSRS.AGAIN ? '⏰ 明天再见这道题' : `⏰ 下次复习: ${ivl} 天后`);
  card.appendChild(note);
  setTimeout(() => { Quiz.idx += 1; renderQuiz(); }, 650);
}

function renderDone() {
  const main = $('#main');
  main.innerHTML = '';
  const n = Quiz.session ? Quiz.session.filter(x => !x._lesson).length : 0;
  const card = el('div', 'card');
  card.appendChild(el('div', 'doneemoji', n ? '🏆' : '🌙'));
  card.appendChild(el('div', 'scoreline', n ? `${Quiz.right} / ${n} 正确` : '今天没有到期任务'));
  card.appendChild(el('p', 'muted', n ? '收工。调度器已排好每题的下次出现时间。' : '明天见。'));
  const back = el('button', 'bigbtn', '回到今日');
  back.onclick = () => { location.hash = '#today'; };
  card.appendChild(back);
  main.appendChild(card);
  if (n) {
    const summary = { done: n, right: Quiz.right, acc: Math.round((Quiz.right / n) * 100) };
    Store.syncToday(summary).then(res => {
      if (res.ok) toast('☁️ 进度已同步,AI 督学可见');
      else if (res.reason === 'no-token') void 0;
      else toast('同步失败已暂存,联网后自动补传');
    });
  }
  Quiz.session = null;
}

/* ---------- 弱点屏 ---------- */
function renderStats() {
  const main = $('#main');
  main.innerHTML = '';
  main.appendChild(el('h1', '', 'LOS 弱点看板'));
  const data = Store.statsData();
  const topics = Object.entries(data).sort((a, b) => b[1].meta.weight - a[1].meta.weight);
  let hasWeak = false;
  for (const [t, td] of topics) {
    const losEntries = Object.entries(td.los);
    const done = losEntries.reduce((s, [, l]) => s + l.n, 0);
    if (!losEntries.length) continue;
    const head = el('div', 'topichead');
    head.appendChild(el('h2', '', esc(t)));
    head.appendChild(el('span', `tier ${td.meta.tier}`, `Tier ${td.meta.tier}`));
    head.appendChild(el('span', 'muted', `权重~${td.meta.weight}%${done ? '' : ' · 未开始'}`));
    main.appendChild(head);
    const card = el('div', 'card');
    losEntries
      .sort((a, b) => (a[1].n ? a[1].right / a[1].n : 2) - (b[1].n ? b[1].right / b[1].n : 2))
      .forEach(([los, l]) => {
        const pct = l.n ? Math.round((l.right / l.n) * 100) : null;
        const weak = l.n >= 2 && pct < 60;
        if (weak) hasWeak = true;
        const row = el('div', `losrow${weak ? ' weak' : ''}`);
        row.appendChild(el('span', 'pct', pct === null ? '未做' : `${weak ? '🔴 ' : ''}${pct}% (${l.right}/${l.n})`));
        row.appendChild(el('div', '', esc(los)));
        const bar = el('div', 'bar');
        bar.appendChild(el('i', '', '')).style.width = `${pct ?? 0}%`;
        row.appendChild(bar);
        card.appendChild(row);
      });
    main.appendChild(card);
  }
  if (hasWeak) main.appendChild(el('p', 'muted', '🔴 = 复习≥2次且正确率<60%。这些 LOS 的题会被调度器自动更频繁地排回来。'));
}

/* ---------- 设置屏 ---------- */
function renderSettings() {
  const main = $('#main');
  main.innerHTML = '';
  const s = Store.settings();
  main.appendChild(el('h1', '', '设置'));

  const c1 = el('div', 'card');
  c1.innerHTML = `
    <label class="field">考试日期</label><input type="date" id="set-exam" value="${s.examDate}">
    <label class="field">每日新题量 (压缩期自动归零)</label><input type="number" id="set-new" min="0" max="20" value="${s.newPerDay}">
    <label class="field">每日时间预算 (分钟)</label><input type="number" id="set-budget" min="10" max="240" value="${s.timeBudget}">`;
  main.appendChild(c1);

  const c2 = el('div', 'card');
  c2.innerHTML = `
    <h2>🤖 AI 督学</h2>
    <p class="muted">贴一个 GitHub fine-grained token(只授权本仓库的 Contents 读写)。答题后进度自动回传仓库,AI 每晚检查并推送提醒到手机。</p>
    <label class="field">GitHub Token</label><input type="password" id="set-token" placeholder="github_pat_..." value="${esc(s.ghToken)}">
    <label class="field">仓库 (owner/repo)</label><input type="text" id="set-repo" value="${esc(s.ghRepo)}">
    <label class="field">分支</label><input type="text" id="set-branch" value="${esc(s.ghBranch)}">`;
  main.appendChild(c2);

  const c2b = el('div', 'card');
  c2b.innerHTML = `
    <h2>🎓 内联 AI 家教</h2>
    <p class="muted">贴一个 Anthropic API key,答题/微课里"问 Claude"就直接在页内出答案,不用复制去别处。留空则回退到复制模式。</p>
    <label class="field">Anthropic API Key</label><input type="password" id="set-aikey" placeholder="sk-ant-..." value="${esc(s.aiKey)}">
    <label class="field">模型</label><input type="text" id="set-aimodel" value="${esc(s.aiModel)}">`;
  main.appendChild(c2b);

  const saveBtn = el('button', 'bigbtn', '保存设置');
  saveBtn.onclick = () => {
    Store.setSettings({
      examDate: $('#set-exam').value || s.examDate,
      newPerDay: parseInt($('#set-new').value, 10) || 0,
      timeBudget: parseInt($('#set-budget').value, 10) || 40,
      ghToken: $('#set-token').value.trim(),
      ghRepo: $('#set-repo').value.trim(),
      ghBranch: $('#set-branch').value.trim(),
      aiKey: $('#set-aikey').value.trim(),
      aiModel: $('#set-aimodel').value.trim() || 'claude-sonnet-5',
    });
    Store.flushPending();
    toast('已保存');
  };
  main.appendChild(saveBtn);

  const c3 = el('div', 'card');
  c3.appendChild(el('h2', '', '数据'));
  const row = el('div', 'btnrow');
  const exp = el('button', '', '📤 导出备份');
  exp.onclick = () => {
    const area = $('#backup-area');
    area.style.display = 'block';
    area.value = Store.exportData();
    area.select();
    navigator.clipboard.writeText(area.value).then(() => toast('已复制到剪贴板'), () => toast('已显示,手动复制'));
  };
  const imp = el('button', '', '📥 导入备份');
  imp.onclick = () => {
    const area = $('#backup-area');
    if (area.style.display !== 'block' || !area.value.trim()) {
      area.style.display = 'block'; area.value = '';
      area.placeholder = '把备份 JSON 粘贴到这里,再点一次导入';
      area.focus(); return;
    }
    try { Store.importData(area.value); toast('导入成功'); route(); }
    catch (e) { toast('导入失败: ' + e.message); }
  };
  const cloud = el('button', '', '☁️ 从云备份恢复');
  cloud.onclick = async () => {
    const st = Store.settings();
    if (!st.ghToken) { toast('先配置 GitHub token'); return; }
    try {
      const res = await fetch(`https://api.github.com/repos/${st.ghRepo}/contents/progress/state-backup.json?ref=${st.ghBranch}`,
        { headers: { Authorization: `Bearer ${st.ghToken}`, Accept: 'application/vnd.github.raw+json' } });
      if (!res.ok) throw new Error('云端无备份或无权限');
      const text = await res.text();
      if (!confirm('用云备份覆盖本机学习记录?(token 等本机设置保留)')) return;
      const keep = { ghToken: st.ghToken, ghRepo: st.ghRepo, ghBranch: st.ghBranch };
      Store.importData(text);
      Store.setSettings(keep);
      toast('恢复完成'); route();
    } catch (e) { toast('恢复失败: ' + e.message); }
  };
  row.appendChild(cloud);
  const rst = el('button', 'danger', '♻️ 重置学习记录');
  rst.onclick = () => { if (confirm('确定清空所有学习记录?题库与设置保留。')) { Store.resetData(); toast('已重置'); } };
  row.appendChild(exp); row.appendChild(imp); row.appendChild(rst);
  c3.appendChild(row);
  const area = el('textarea', '', '');
  area.id = 'backup-area'; area.style.display = 'none';
  c3.appendChild(area);
  main.appendChild(c3);

  main.appendChild(el('p', 'muted',
    `题库 v${Store.bank.version} · ${Store.bank.questions.length} 题 · 引擎 FSRS-4.5 + 考期感知`));
}

/* ---------- 框架屏 (品职式三层压缩的最后一层, 🔴 弱点自动标红) ---------- */
/* 2026 L2 curriculum 顺序 (和你的框架图 PDF、Mock 卷一致) */
const CURRICULUM_ORDER = ['Ethics', 'QM', 'Econ', 'FSA', 'Corp', 'Equity', 'FI', 'Derivatives', 'Alts', 'PM'];
/* 考频: 权重 10-15% = 高频, 5-10% = 中频 (weight 存的是区间中值) */
function freqBadge(meta) {
  const w = meta.weight || 0;
  if (w >= 12) return { cls: 'hi', label: '高频' };
  if (w >= 9) return { cls: 'mid', label: '中高频' };
  return { cls: 'mid', label: '中频' };
}
let FRAME_TOPIC = null;   // 当前脑图科目
let FRAME_VIEW = 'map';   // map | list

function weakSetOf() {
  const stats = Store.statsData();
  const w = new Set();
  for (const [t, td] of Object.entries(stats))
    for (const [los, l] of Object.entries(td.los))
      if (l.n >= 2 && l.right / l.n < 0.6) w.add(t + '|' + los);
  return w;
}

function renderFrames() {
  const main = $('#main');
  main.innerHTML = '';
  main.appendChild(el('h1', '', '框架脑图'));
  const frames = Store.bank.frames || {};
  const topics = Object.keys(frames).sort((a, b) => CURRICULUM_ORDER.indexOf(a) - CURRICULUM_ORDER.indexOf(b));
  if (!FRAME_TOPIC || !frames[FRAME_TOPIC]) FRAME_TOPIC = topics[0];

  // 科目 chips (大纲顺序 + 高频徽章)
  const chips = el('div', 'chiprow');
  for (const t of topics) {
    const meta = Store.bank.topics[t] || {};
    const fb = freqBadge(meta);
    const chip = el('button', 'topicchip' + (t === FRAME_TOPIC ? ' on' : ''),
      `${esc(t)} <span class="freq ${fb.cls}">${fb.label}</span>`);
    chip.onclick = () => { FRAME_TOPIC = t; renderFrames(); };
    chips.appendChild(chip);
  }
  main.appendChild(chips);

  const bar = el('div', 'btnrow');
  const bMap = el('button', FRAME_VIEW === 'map' ? 'primary' : '', '🧠 脑图');
  const bList = el('button', FRAME_VIEW === 'list' ? 'primary' : '', '📋 列表');
  bMap.style.cssText = bList.style.cssText = 'flex:1;padding:8px;border-radius:10px;border:1.5px solid var(--border);background:var(--card);color:var(--text)';
  (FRAME_VIEW === 'map' ? bMap : bList).style.borderColor = 'var(--accent)';
  bMap.onclick = () => { FRAME_VIEW = 'map'; renderFrames(); };
  bList.onclick = () => { FRAME_VIEW = 'list'; renderFrames(); };
  bar.appendChild(bMap); bar.appendChild(bList);
  main.appendChild(bar);

  const weakSet = weakSetOf();
  const meta = Store.bank.topics[FRAME_TOPIC] || {};

  if (FRAME_VIEW === 'map') {
    main.appendChild(el('p', 'muted', `双指缩放 · 拖动平移 · 🔴 弱点 · 𝑓 公式 · ⚠️ 陷阱`));
    // 构造脑图树: 科目 → module → 考点
    const tree = { name: `${FRAME_TOPIC} ${meta.name_cn || ''}`, children: [] };
    for (const [mod, lines] of Object.entries(frames[FRAME_TOPIC])) {
      const mnode = { name: mod, children: [] };
      for (const ln of lines) {
        const weak = ln.los && weakSet.has(FRAME_TOPIC + '|' + ln.los);
        mnode.children.push({
          name: (ln.f ? '𝑓 ' : '') + (ln.trap ? '⚠ ' : '') + ln.t.replace(/\$/g, ''),
          weak,
        });
      }
      if (mnode.children.some(c => c.weak)) mnode.weak = true;
      tree.children.push(mnode);
    }
    const box = el('div', 'mapbox');
    main.appendChild(box);
    requestAnimationFrame(() => MindMap.render(box, tree));
    return;
  }

  // 列表视图
  const head = el('div', 'topichead');
  head.appendChild(el('h2', '', `${esc(FRAME_TOPIC)} ${esc(meta.name_cn || '')}`));
  head.appendChild(el('span', 'muted', `权重~${meta.weight || '?'}%`));
  main.appendChild(head);
  for (const [mod, lines] of Object.entries(frames[FRAME_TOPIC])) {
    const card = el('div', 'card');
    card.appendChild(el('h2', '', esc(mod)));
    const sorted = lines.slice().sort((a, b) =>
      (weakSet.has(FRAME_TOPIC + '|' + (b.los || '')) ? 1 : 0) - (weakSet.has(FRAME_TOPIC + '|' + (a.los || '')) ? 1 : 0));
    for (const ln of sorted) {
      const weak = ln.los && weakSet.has(FRAME_TOPIC + '|' + ln.los);
      const row = el('div', `losrow${weak ? ' weak' : ''}`);
      let badges = '';
      if (weak) badges += '🔴 ';
      if (ln.f) badges += '<span class="freq f">𝑓</span>';
      if (ln.trap) badges += '⚠️ ';
      row.appendChild(el('div', '', badges + fmt(ln.t)));
      card.appendChild(row);
    }
    main.appendChild(card);
  }
}

/* ---------- Mock 模式 (冲刺包: 20题连做 → 成绩单 → 错因分类) ---------- */
const Mock = { qs: null, idx: 0, answers: [], t0: 0 };

function renderMock() {
  const main = $('#main');
  main.innerHTML = '';
  if (!Mock.qs) {
    const card = el('div', 'card hero');
    card.appendChild(el('h1', '', '📝 Mock 20 题'));
    card.appendChild(el('p', 'muted', '跨科目交错出题、不即时判分——模拟考场。答完出成绩单+错因分析,结果同样喂给调度器。建议 36 分钟内完成。'));
    const go = el('button', 'bigbtn', '开始 Mock');
    go.onclick = () => {
      Mock.qs = Store.buildMock(20); Mock.idx = 0; Mock.answers = []; Mock.t0 = Date.now();
      renderMock();
    };
    card.appendChild(go);
    main.appendChild(card);
    return;
  }
  if (Mock.idx >= Mock.qs.length) return renderMockReport();
  const q = Mock.qs[Mock.idx];
  const mins = ((Date.now() - Mock.t0) / 60000).toFixed(0);
  const head = el('div', 'qhead');
  head.appendChild(el('span', '', `${Mock.idx + 1}/${Mock.qs.length}`));
  head.appendChild(el('span', 'tag', esc(q.topic)));
  head.appendChild(el('span', '', `⏱ ${mins} 分钟`));
  main.appendChild(head);
  const prog = el('div', 'progress');
  prog.appendChild(el('i', '', '')).style.width = `${(Mock.idx / Mock.qs.length) * 100}%`;
  main.appendChild(prog);
  const card = el('div', 'card');
  const prevMq = Mock.idx > 0 ? Mock.qs[Mock.idx - 1] : null;
  const mcp = casePanel(q, !prevMq || prevMq.case !== q.case);
  if (mcp) card.appendChild(mcp);
  card.appendChild(el('div', 'stem', fmt(q.stem)));
  ['A', 'B', 'C'].forEach(k => {
    if (!(k in q.choices)) return;
    const b = el('button', 'choice', `<b>${k}.</b> ${fmt(q.choices[k])}`);
    b.onclick = () => {
      Mock.answers.push({ id: q.id, topic: q.topic, los: q.los, picked: k, correct: k === q.answer ? 1 : 0 });
      Mock.idx += 1;
      renderMock();
    };
    card.appendChild(b);
  });
  main.appendChild(card);
}

function renderMockReport() {
  const main = $('#main');
  main.innerHTML = '';
  const right = Mock.answers.filter(a => a.correct).length;
  const n = Mock.answers.length;
  const minutes = Math.round((Date.now() - Mock.t0) / 60000);
  const pct = Math.round((right / n) * 100);
  const card = el('div', 'card hero');
  card.appendChild(el('div', 'doneemoji', pct >= 70 ? '🏆' : pct >= 55 ? '💪' : '🔧'));
  card.appendChild(el('div', 'scoreline', `${right}/${n} (${pct}%) · 用时 ${minutes} 分钟`));
  card.appendChild(el('p', 'muted', pct >= 70 ? '按 MPS 口径这是稳过区间' : pct >= 55 ? '在及格线附近,把错因修掉就过' : '别慌,成绩单告诉你修哪里'));
  main.appendChild(card);

  // 分科成绩
  const byTopic = {};
  for (const a of Mock.answers) {
    const t = byTopic[a.topic] || (byTopic[a.topic] = { n: 0, r: 0 });
    t.n += 1; t.r += a.correct;
  }
  const tc = el('div', 'card');
  tc.appendChild(el('h2', '', '分科成绩'));
  for (const [t, v] of Object.entries(byTopic).sort((a, b) => a[1].r / a[1].n - b[1].r / b[1].n)) {
    const p = Math.round((v.r / v.n) * 100);
    const meta = Store.bank.topics[t] || {};
    const weakA = meta.tier === 'A' && p < 55;
    const row = el('div', `losrow${weakA ? ' weak' : ''}`);
    row.appendChild(el('span', 'pct', `${p}% (${v.r}/${v.n})${weakA ? ' ⚠️A档告警' : ''}`));
    row.appendChild(el('div', '', `${esc(t)} [${meta.tier || '?'}]`));
    const bar = el('div', 'bar');
    bar.appendChild(el('i', '', '')).style.width = `${p}%`;
    row.appendChild(bar);
    tc.appendChild(row);
  }
  main.appendChild(tc);

  // 错因分类 (UWorld 四分类)
  const wrongs = Mock.answers.filter(a => !a.correct);
  if (wrongs.length) {
    const wc = el('div', 'card');
    wc.appendChild(el('h2', '', `错题归因 (${wrongs.length} 道)`));
    wc.appendChild(el('p', 'muted', '点一个原因——下周的复习额度按这个分配'));
    for (const a of wrongs) {
      const q = Store.bank.questions.find(x => x.id === a.id);
      const row = el('div', 'losrow');
      row.appendChild(el('div', '', `${esc(a.topic)} · ${esc((q ? q.los : a.los).slice(0, 40))}`));
      const causes = el('div', 'confrow');
      ['概念', '计算', '陷阱', '时间'].forEach(cz => {
        const b = el('button', '', cz);
        b.onclick = () => {
          a.cause = cz;
          [...causes.children].forEach(x => x.classList.remove('primary'));
          b.classList.add('primary');
        };
        causes.appendChild(b);
      });
      row.appendChild(causes);
      wc.appendChild(row);
    }
    main.appendChild(wc);
  }

  const fin = el('button', 'bigbtn', '保存成绩单');
  fin.onclick = async () => {
    fin.disabled = true;
    Store.addXp(50);
    const res = await Store.saveMock({
      date: Store.todayStr(), n, right, minutes, answers: Mock.answers,
    });
    toast(res.ok ? '☁️ 成绩单已同步' : '成绩单已存本地');
    Mock.qs = null;
    location.hash = '#today';
  };
  main.appendChild(fin);
}

/* ---------- 路由 ---------- */
const ROUTES = { today: renderToday, quiz: renderQuiz, stats: renderStats, settings: renderSettings, frames: renderFrames, mock: renderMock };
function route() {
  const h = (location.hash || '#today').slice(1);
  const name = ROUTES[h] ? h : 'today';
  if (name !== 'quiz') Quiz.session = null;
  if (name !== 'mock') Mock.qs = null;
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active', a.dataset.r === name));
  ROUTES[name]();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
window.addEventListener('online', () => Store.flushPending());

Store.init().then(() => {
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}).catch(e => {
  $('#main').innerHTML = `<div class="card">题库加载失败: ${esc(e.message)}<br>请联网后刷新一次。</div>`;
});
