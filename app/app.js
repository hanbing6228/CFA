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
  const est = Math.round(total * 1.8);
  const { streak, doneToday } = Store.streakInfo();

  const hero = el('div', 'card hero');
  hero.appendChild(el('div', 'days', `距考试 <b>${dte}</b> 天` +
    (FSRS.inCompressMode(ec) ? ' · <span class="warn">压缩模式:已停新题</span>' : '')));
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
  pills.appendChild(el('span', 'pill', `🎯 保留率 ${FSRS.desiredRetention(ec).toFixed(2)}`));
  if (streak > 0) pills.appendChild(el('span', 'pill', `🔥 连续 ${streak} 天`));
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
  const s = Store.settings();
  if (!s.ghToken) {
    const c = el('div', 'card muted',
      `🤖 AI 督学未连接——去<a href="#settings" style="color:var(--accent)">设置</a>里贴一个 GitHub token,晚上没做题我会来提醒你`);
    main.appendChild(c);
  }
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
  card.appendChild(el('div', 'stem', esc(q.stem)));
  const choicesBox = el('div');
  let answered = false;
  ['A', 'B', 'C'].forEach(k => {
    if (!(k in q.choices)) return;
    const b = el('button', 'choice', `<b>${k}.</b> ${esc(q.choices[k])}`);
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

function toggleWhy(q, btn) {
  const k = btn.dataset.k;
  let why = btn.querySelector('.why');
  if (why) { why.remove(); addHint(btn, q); return; }
  const hint = btn.querySelector('.whyhint');
  if (hint) hint.remove();
  why = el('span', 'why', `${k === q.answer ? '✓' : '✗'} ${esc(q.explanations[k])}`);
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
  // 默认展开: 我选的 + 正确答案; 其余点击可看 (交互性核心)
  [...choicesBox.children].forEach(b => {
    const k = b.dataset.k;
    if (k === picked || k === q.answer) toggleWhy(q, b);
    else addHint(b, q);
  });

  // calc 题: 分步揭示
  if (q.steps && q.steps.length) {
    const stepsBox = el('div', 'steps');
    let shown = 0;
    const btn = el('button', 'stepbtn', `📐 分步看解题过程 (${q.steps.length} 步) ▸`);
    btn.onclick = () => {
      if (shown < q.steps.length) {
        const st = q.steps[shown];
        stepsBox.insertBefore(el('div', 'step', `<b>${esc(st.label)}</b>${esc(st.content)}`), btn);
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

  // 追问 Claude
  const ask = el('div', 'askrow');
  const askBtn = el('button', 'askbtn', '🤔 还是不懂?复制追问发给 Claude');
  askBtn.onclick = () => {
    const prompt = `我在做 CFA L2 练习题,这道题${correct ? '我做对了但想深挖' : `我错选了 ${picked}`}。请针对我的误区讲解,不要重复题目解析:\n\n` +
      `题目: ${q.stem}\n选项: ${Object.entries(q.choices).map(([k, v]) => `${k}. ${v}`).join(' ')}\n` +
      `正确答案: ${q.answer}\n官方解析: ${q.explanations[q.answer]}\n考点: ${q.topic} / ${q.los}`;
    navigator.clipboard.writeText(prompt).then(
      () => toast('已复制,去 Claude 粘贴提问'),
      () => toast('复制失败,长按题目手动复制'));
  };
  ask.appendChild(askBtn);
  card.appendChild(ask);

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
  card.querySelector('.confrow').remove();
  const note = el('div', 'nextivl', grade === FSRS.AGAIN ? '⏰ 明天再见这道题' : `⏰ 下次复习: ${ivl} 天后`);
  card.appendChild(note);
  setTimeout(() => { Quiz.idx += 1; renderQuiz(); }, 650);
}

function renderDone() {
  const main = $('#main');
  main.innerHTML = '';
  const n = Quiz.session ? Quiz.session.length : 0;
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

  const saveBtn = el('button', 'bigbtn', '保存设置');
  saveBtn.onclick = () => {
    Store.setSettings({
      examDate: $('#set-exam').value || s.examDate,
      newPerDay: parseInt($('#set-new').value, 10) || 0,
      timeBudget: parseInt($('#set-budget').value, 10) || 40,
      ghToken: $('#set-token').value.trim(),
      ghRepo: $('#set-repo').value.trim(),
      ghBranch: $('#set-branch').value.trim(),
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

/* ---------- 路由 ---------- */
const ROUTES = { today: renderToday, quiz: renderQuiz, stats: renderStats, settings: renderSettings };
function route() {
  const h = (location.hash || '#today').slice(1);
  const name = ROUTES[h] ? h : 'today';
  if (name !== 'quiz') Quiz.session = null;
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
