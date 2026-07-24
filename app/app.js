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

/* ---------- 统一线性图标集 (全 App 只用这套 SVG, 严禁 emoji 当图标) ---------- */
const _IC = {
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.7.6 1 1.2 1.1 2.4h5.4c.1-1.2.4-1.8 1.1-2.4A6 6 0 0 0 12 3z"/>',
  root: '<path d="M3 13l3.2 6L11 5h10"/>',
  hash: '<path d="M9 4L7 20M17 4l-2 16M5 9h14M4 15h14"/>',
  warn: '<path d="M12 4L2.6 20h18.8z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  bookmark: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  pin: '<path d="M12 21s6-5.6 6-10a6 6 0 1 0-12 0c0 4.4 6 10 6 10z"/><circle cx="12" cy="11" r="2.1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.4 2"/>',
  flame: '<path d="M12 3c.3 2.5 2 3.6 3.2 5.2A5.4 5.4 0 0 1 16.4 12a4.4 4.4 0 1 1-8.8 0c0-1 .3-1.8.8-2.6.4 1 .9 1.5 1.6 1.8-.4-2.3.6-4.5 2-6.2z"/>',
  checkC: '<circle cx="12" cy="12" r="8.5"/><path d="M8.4 12.3l2.4 2.3 4.6-4.9"/>',
  xC: '<circle cx="12" cy="12" r="8.5"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>',
  check: '<path d="M4.5 12.5l4.5 4.5 10.5-11"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
  network: '<circle cx="5.5" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M7.9 10.8L15.6 7.2M7.9 13.2l7.7 3.6"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".9" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r=".9" fill="currentColor" stroke="none"/>',
  pencil: '<path d="M12 20h8"/><path d="M15.5 4.5l3.5 3.5-9.5 9.5-4 1 1-4z"/><path d="M13.5 6.5l3.5 3.5"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
  book: '<path d="M4 5.5A1.8 1.8 0 0 1 5.8 4H12v15H5.8A1.8 1.8 0 0 0 4 20.2z"/><path d="M20 5.5A1.8 1.8 0 0 0 18.2 4H12v15h6.2A1.8 1.8 0 0 1 20 20.2z"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4-1.6c1 .8 1 2.1-.1 2.9-.7.5-1.5.9-1.5 1.9M12 17.4v.01"/>',
  cap: '<path d="M2.5 8.5L12 4.2l9.5 4.3L12 12.8z"/><path d="M6.5 10.6V15c0 1.3 2.5 2.4 5.5 2.4s5.5-1.1 5.5-2.4v-4.4M21.5 8.7V14"/>',
  library: '<path d="M5 4v16M9 4v16"/><path d="M13.2 4.6l4 15.1"/><path d="M4 20h16"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6.5H4.5V8a2.5 2.5 0 0 0 2.5 2.5M17 6.5h2.5V8A2.5 2.5 0 0 1 17 10.5M10 16h4M9 20h6M11 16v-2M13 16v-2"/>',
  moon: '<path d="M20 14.4A8 8 0 1 1 9.6 4a6.5 6.5 0 0 0 10.4 10.4z"/>',
  cloud: '<path d="M7 18.5a4 4 0 0 1 .4-8 5 5 0 0 1 9.6 1.4A3.5 3.5 0 0 1 17 18.5z"/><path d="M9.6 14.3l1.7 1.7 3-3.3"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/>',
  dot: '<circle cx="12" cy="12" r="5.5" fill="currentColor" stroke="none"/>',
  bot: '<rect x="4.5" y="8" width="15" height="11" rx="3.5"/><path d="M12 4.5V8M9.5 13v1M14.5 13v1M9.5 16.5h5"/><circle cx="12" cy="3.6" r="1.3"/>',
  upload: '<path d="M12 15.5V4M8 8l4-4 4 4M5 20h14"/>',
  download: '<path d="M12 4v11.5M8 11l4 4 4-4M5 20h14"/>',
  refresh: '<path d="M20 7.5A8 8 0 0 0 5.5 6.5L4 8"/><path d="M4 4v4h4"/><path d="M4 16.5A8 8 0 0 0 18.5 17.5L20 16"/><path d="M20 20v-4h-4"/>',
  maximize: '<path d="M8 3.5H4v4M16 3.5h4v4M8 20.5H4v-4M16 20.5h4v-4"/>',
  clipboard: '<rect x="6" y="4.5" width="12" height="16" rx="2.2"/><path d="M9 4.5V3.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.9M9.5 11h5M9.5 15h5"/>',
  zap: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  meh: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 15h7M9 9.6v.5M15 9.6v.5"/>',
  sliders: '<path d="M5 8h14M5 16h14"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
  wrench: '<path d="M15.5 6.2a3.6 3.6 0 0 0-4.8 4.3l-6.3 6.3L7 19.6l6.3-6.3a3.6 3.6 0 0 0 4.3-4.8l-2.4 2.4-2-2z"/>',
  flag: '<path d="M5 21V4M5 5h11l-2 3 2 3H5"/>',
};
/* ic('name'): 返回内联 SVG 字符串; color 走 currentColor, 可传 style 覆盖 */
function ic(name, cls, style) {
  return `<svg class="ic${cls ? ' ' + cls : ''}"${style ? ` style="${style}"` : ''} viewBox="0 0 24 24" fill="none" `
    + `stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${_IC[name] || ''}</svg>`;
}

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
  { re: /什么|为什么|是啥|背景/, cls: 'what', icon: 'bulb' },
  { re: /公式|规则|核心|定义/, cls: 'formula', icon: 'root' },
  { re: /例|算|计算|演示/, cls: 'example', icon: 'hash' },
  { re: /陷阱|坑|易错|注意|区分|别/, cls: 'trap', icon: 'warn' },
  { re: /记|口诀|钩子|类比|技巧/, cls: 'hook', icon: 'bookmark' },
];
function lessonKind(h) {
  for (const k of LESSON_KIND) if (k.re.test(h)) return k;
  return { cls: 'default', icon: 'pin' };
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
  const proj = Store.projectedScore();
  const pClr = proj >= 0.70 ? 'var(--green)' : proj >= 0.60 ? 'var(--amber)' : 'var(--red)';

  // 紧急行政提醒 (报名/预约截止临近)
  const urgentTodo = Store.examTodos().find(t => !t.done && t.days >= 0 && t.days <= 21 && t.key !== 'exam');
  if (urgentTodo) {
    const a = el('div', 'card alert-card');
    a.innerHTML = `${ic('clock')} <b>${esc(urgentTodo.label)}</b> ${urgentTodo.days === 0 ? '就是今天!' : `还有 ${urgentTodo.days} 天`} (${urgentTodo.date})<div class="muted" style="margin-top:2px">${esc(urgentTodo.note)} · 点开办 ▸</div>`;
    a.onclick = () => { location.hash = '#plan'; };
    main.appendChild(a);
  }

  // 顶部极简状态条
  const top = el('div', 'today-top');
  top.innerHTML = `<span>${ic(ph.icon)} ${esc(ph.name)} · 距考 <b>${dte}</b> 天</span>`
    + (streak > 0 ? `<span class="streak">${ic('flame')} ${streak}</span>` : '');
  main.appendChild(top);

  // 主行动卡: 两个数字 + 一个大按钮
  const hero = el('div', 'card hero');
  const duo = el('div', 'duo');
  duo.appendChild(el('div', 'card', `<div class="num">${dues.length}</div><div class="lbl">复习</div>`));
  duo.appendChild(el('div', 'card', `<div class="num">${news.length}</div><div class="lbl">新题</div>`));
  hero.appendChild(duo);
  const btn = el('button', 'bigbtn', doneToday ? `今天已完成 ${ic('checkC')} 再来一组` : (total ? '开始 · 先做 1 题就算赢' : `今天没有任务 ${ic('checkC')}`));
  btn.disabled = !total;
  btn.onclick = () => { location.hash = '#quiz'; };
  hero.appendChild(btn);
  hero.appendChild(el('div', 'today-sub', `约 ${est} 分钟${nLessons ? ` · 含 ${nLessons} 节微课` : ''}`));
  main.appendChild(hero);

  // 智能今日聚焦: 高权重×低正确率的科目
  const ts = Store.topicStats();
  const ranked = Object.values(ts)
    .map(s => ({ ...s, gap: (s.weight || 0) * (1 - (s.acc == null ? 0.4 : s.acc)) }))
    .sort((a, b) => b.gap - a.gap);
  const focus = ranked[0];
  if (focus) {
    const fc = el('div', 'card focus-card');
    const why = focus.acc == null ? '还没测过, 先探底' : (focus.acc < 0.6 ? '高权重弱项, 攻它最划算' : '保持手感');
    fc.innerHTML = `<div class="focus-label">${ic('target')} 今日聚焦</div>
      <div class="focus-topic">${esc(focus.topic)} <span class="muted">${esc(focus.name_cn || '')}</span></div>
      <div class="muted">${why} · 权重~${focus.weight}%${focus.acc != null ? ` · 当前 ${Math.round(focus.acc * 100)}%` : ''}</div>`;
    const fb = el('button', 'focus-btn', `专攻 ${esc(focus.topic)} ▸`);
    fb.onclick = () => {
      Quiz.session = Store.practiceTopic(focus.topic, 10);
      if (!Quiz.session.length) { toast('这科暂无可练的题'); return; }
      Quiz.idx = 0; Quiz.right = 0; location.hash = '#quiz';
    };
    fc.appendChild(fb);
    main.appendChild(fc);
  }

  // 通过率(可点进作战计划)
  const plan = el('div', 'card planbar');
  plan.innerHTML = `<div class="pb-num" style="color:${pClr}">${Math.round(proj * 100)}%</div>
    <div class="pb-txt"><b>预计得分</b> <span class="muted">过线~70%</span><div class="muted">${proj >= 0.70 ? '照这样能过' : '点开看该攻哪科 ▸'}</div></div><div class="pb-arrow">▸</div>`;
  plan.onclick = () => { location.hash = '#plan'; };
  main.appendChild(plan);

  // Mock (仅冲刺阶段到期时提示)
  const sinceMock = Store.daysSinceMock();
  if (ph.key === 'hundred' || ph.key === 'sprint') {
    const cadence = ph.key === 'sprint' ? 7 : 14;
    if (sinceMock >= cadence) {
      const mc = el('div', 'card');
      mc.innerHTML = `${ic('clipboard')} <b>该做 Mock 了</b> <span class="muted">· ${sinceMock === Infinity ? '还没做过' : sinceMock + ' 天没做'}</span>`;
      const mb = el('button', 'bigbtn', '开始 Mock 20 题 ▸');
      mb.style.marginTop = '10px';
      mb.onclick = () => { location.hash = '#mock'; };
      mc.appendChild(mb);
      main.appendChild(mc);
    }
  }
}

/* 案例背景排版: 一坨长文 → 分段 + 圆点列表 + 关键数字/Exhibit 高亮 (重点突出) */
function highlightCase(t) {
  // Exhibit 引用整体高亮; 关键数字(货币/百分比/小数/年限)高亮; 二选一, 不嵌套
  return t.replace(/(Exhibit\s+\d+|\$[\d,]+(?:\.\d+)?|\d[\d,]*(?:\.\d+)?%|\b\d[\d,]*(?:\.\d+)?\b)/g, '==$1==');
}
/* 案例正文行内渲染: 只做 ==高亮== 与 **加粗**, 不走 $...$ 公式解析
 * (案例背景是散文, 里面的 $ 是货币符号, 不能当公式分隔符) */
function caseInline(raw) {
  let h = esc(raw);
  h = h.replace(/==([^=]+)==/g, '<mark class="hl">$1</mark>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b class="kw">$1</b>');
  return h;
}
function renderCaseBg(container, raw) {
  let s = String(raw).replace(/\s*[●•]\s*/g, '\n● ');       // 圆点 → 独立行
  s = s.replace(/\s+(Exhibit\s+\d+\b)/g, '\n$1');            // Exhibit 引用另起段
  const lines = s.split('\n').map(x => x.trim()).filter(Boolean);
  let ul = null;
  for (const ln of lines) {
    if (ln.startsWith('● ')) {
      if (!ul) { ul = el('ul', 'casebul'); container.appendChild(ul); }
      ul.appendChild(el('li', '', caseInline(highlightCase(ln.slice(2)))));
      continue;
    }
    ul = null;
    // 长段落按 ~2 句切分, 避免一堵墙
    const sents = ln.match(/[^.!?]+[.!?]+["')\]]?(?=\s|$)/g) || [ln];
    let grp = [];
    const flush = () => { if (grp.length) { container.appendChild(el('p', 'casebg', caseInline(highlightCase(grp.join(' '))))); grp = []; } };
    for (const st of sents) { grp.push(st.trim()); if (grp.length >= 2) flush(); }
    flush();
  }
}

/* ---------- Case/vignette 面板 (L2 题型: 背景+Exhibit+一组题) ---------- */
function casePanel(q, expanded) {
  if (!q.case || !Store.bank.cases || !Store.bank.cases[q.case]) return null;
  const c = Store.bank.cases[q.case];
  const d = el('details', 'casebox');
  if (expanded) d.open = true;
  d.appendChild(el('summary', '', `${ic('file')} ${esc(c.title)} <span class="muted">(案例背景与图表)</span>`));
  if (c.background) renderCaseBg(d, c.background);
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
  head.appendChild(el('span', 'tag', `${ic('book')} 微课`));
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
    lc.appendChild(el('h2', '', `${ic(kind.icon)} ${esc(c.h)}`));
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
  card.appendChild(tutorWidget(`${ic('help')} 没看懂?让教练换个说法讲`, () =>
    `我在学 CFA L2 的 ${item.topic} / ${item.los},下面是微课内容,请用更浅的方式+一个新例子给我讲一遍:\n\n` +
    item.cards.map(c => `${c.h}: ${c.b}`).join('\n')));
  main.appendChild(card);
}

/* 内联 AI 教练控件: 有 API key 就直接在页内出答案, 没有则回退到复制 */
function tutorWidget(label, buildPrompt) {
  const wrap = el('div', 'askrow');
  const btn = el('button', 'askbtn', label);
  btn.onclick = async () => {
    const prompt = buildPrompt();
    if (!Store.settings().aiKey) {
      navigator.clipboard.writeText(prompt).then(
        () => toast('未配 AI key,已复制,粘贴给 AI (设置里贴 Gemini key 可页内直接答)'),
        () => toast('复制失败'));
      return;
    }
    btn.style.display = 'none';
    const box = el('div', 'tutor-box');
    box.appendChild(el('div', 'tutor-loading', `${ic('help')} 教练正在讲…`));
    wrap.appendChild(box);
    const res = await Store.askTutor(prompt);
    box.innerHTML = '';
    if (res.ok) {
      box.appendChild(el('div', '', `${ic('cap')} <b>教练</b>`));
      box.appendChild(el('div', 'ans', fmt(res.text)));
    } else if (res.reason === 'no-key') {
      box.appendChild(el('div', 'tutor-loading', '请先在设置里贴 Gemini API key'));
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
  why = el('span', 'why', `${k === q.answer ? ic('check', '', 'color:var(--green)') : ic('x', '', 'color:var(--red)')} ${fmt(q.explanations[k])}`);
  btn.appendChild(why);
}

function addHint(btn, q) {
  if (btn.querySelector('.whyhint')) return;
  btn.appendChild(el('span', 'whyhint', btn.dataset.k === q.answer ? '点我看为什么对 ▸' : '点我看为什么错 ▸'));
}

/* 解析显示 + 中/英切换 chip: 原文一键翻成另一种语言 (走教练/Gemini, 结果缓存)。
 * 设置里的"解析语言"决定默认展示哪种。 */
function hasCJK(s) { return /[一-鿿]/.test(String(s)); }
function mountExpl(mount, raw) {
  const rawIsCn = hasCJK(raw);
  const body = el('div', 'expl-body', fmt(raw));
  mount.appendChild(body);
  const target = rawIsCn ? 'en' : 'cn';
  const altLabel = rawIsCn ? 'English' : '中文';
  const chip = el('button', 'langchip', altLabel);
  let alt = null, showing = 'raw', busy = false;
  const toAlt = async () => {
    if (busy) return;
    if (alt === null) {
      busy = true; chip.textContent = '翻译中…'; chip.disabled = true;
      const r = await Store.translate(raw, target);
      busy = false; chip.disabled = false;
      if (!r.ok) { chip.textContent = altLabel; toast(r.reason === 'no-key' ? '设置里贴 Gemini key 可切换解析语言' : '翻译失败,稍后再试'); return; }
      alt = r.text;
    }
    body.innerHTML = fmt(alt); showing = 'alt'; chip.textContent = rawIsCn ? '中文' : 'English';
  };
  const toRaw = () => { body.innerHTML = fmt(raw); showing = 'raw'; chip.textContent = altLabel; };
  chip.onclick = () => (showing === 'raw' ? toAlt() : toRaw());
  const bar = el('div', 'expl-lang'); bar.appendChild(chip); mount.appendChild(bar);
  const want = Store.settings().explLang;
  if ((want === 'en' && rawIsCn) || (want === 'cn' && !rawIsCn)) toAlt();   // 默认语言≠原文 → 自动翻
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
    ex.innerHTML = `<b>${correct ? ic('checkC', '', 'color:var(--green)') + ' 答对' : ic('xC', '', 'color:var(--red)') + ' 正确答案 ' + q.answer}</b>${freqNote}<div class="ans"></div>`;
    mountExpl(ex.querySelector('.ans'), q.explanation);
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
    const btn = el('button', 'stepbtn', `${ic('root')} 分步看解题过程 (${q.steps.length} 步) ▸`);
    btn.onclick = () => {
      if (shown < q.steps.length) {
        const st = q.steps[shown];
        stepsBox.insertBefore(el('div', 'step', `<b>${esc(st.label)}</b>${fmt(st.content)}`), btn);
        shown += 1;
        btn.innerHTML = shown < q.steps.length ? `下一步 ▸ (${shown}/${q.steps.length})` : `${ic('check')} 步骤完`;
        if (shown >= q.steps.length) btn.disabled = true;
      }
    };
    stepsBox.appendChild(btn);
    card.appendChild(stepsBox);
  }

  if (q.source) card.appendChild(el('div', 'srcline', `${ic('library')} 出处: ${esc(q.source)}`));

  // 我的笔记 (随云备份保存, 下次复习可见)
  const noteBox = el('div', 'notebox');
  const oldNote = Store.getNote(q.id);
  const noteBtn = el('button', 'askbtn', oldNote ? `${ic('pencil')} 我的笔记: ${esc(oldNote.slice(0, 30))}${oldNote.length > 30 ? '…' : ''}` : `${ic('pencil')} 记条笔记 (口诀/误区)`);
  noteBtn.onclick = () => {
    noteBtn.style.display = 'none';
    const ta = el('textarea', '', '');
    ta.value = oldNote; ta.placeholder = '写给下次复习的自己…';
    const saveN = el('button', 'stepbtn', '保存笔记');
    saveN.onclick = () => { Store.setNote(q.id, ta.value); toast('笔记已存'); ta.blur(); saveN.innerHTML = `已保存 ${ic('check')}`; };
    noteBox.appendChild(ta); noteBox.appendChild(saveN);
    ta.focus();
  };
  noteBox.appendChild(noteBtn);
  card.appendChild(noteBox);

  // 内联追问教练 (有 key 页内直接答)
  card.appendChild(tutorWidget(correct ? `${ic('help')} 想更深入?问问教练` : `${ic('help')} 还是不懂?让教练讲讲我的误区`, () =>
    `我在做 CFA L2 练习题,这道题${correct ? '我做对了但想深挖' : `我错选了 ${picked}`}。请针对我的误区讲解,不要重复题目解析:\n\n` +
    `题目: ${q.stem}\n选项: ${Object.entries(q.choices).map(([k, v]) => `${k}. ${v}`).join(' ')}\n` +
    `正确答案: ${q.answer}\n官方解析: ${q.explanations[q.answer]}\n考点: ${q.topic} / ${q.los}`));

  // 评分行
  const conf = el('div', 'confrow');
  if (correct) {
    [[`${ic('meh')} 蒙对的`, FSRS.HARD], [`${ic('check')} 会做`, FSRS.GOOD], [`${ic('zap')} 秒杀`, FSRS.EASY]].forEach(([label, g], i) => {
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
  const note = el('div', 'nextivl', grade === FSRS.AGAIN ? `${ic('clock')} 明天再见这道题` : `${ic('clock')} 下次复习: ${ivl} 天后`);
  card.appendChild(note);
  setTimeout(() => { Quiz.idx += 1; renderQuiz(); }, 650);
}

function renderDone() {
  const main = $('#main');
  main.innerHTML = '';
  const n = Quiz.session ? Quiz.session.filter(x => !x._lesson).length : 0;
  const card = el('div', 'card');
  card.appendChild(el('div', 'doneemoji', n ? ic('trophy') : ic('moon')));
  card.appendChild(el('div', 'scoreline', n ? `${Quiz.right} / ${n} 正确` : '今天没有到期任务'));
  card.appendChild(el('p', 'muted', n ? '收工。调度器已排好每题的下次出现时间。' : '明天见。'));
  const back = el('button', 'bigbtn', '回到今日');
  back.onclick = () => { location.hash = '#today'; };
  card.appendChild(back);
  main.appendChild(card);
  if (n) {
    const summary = { done: n, right: Quiz.right, acc: Math.round((Quiz.right / n) * 100) };
    Store.syncToday(summary).then(res => {
      if (res.ok) toast('进度已同步,AI 教练可见');
      else if (res.reason === 'no-token') void 0;
      else toast('同步失败已暂存,联网后自动补传');
    });
  }
  Quiz.session = null;
}

/* ---------- 作战计划屏 (通过率预测 + 每科可操作) ---------- */
function renderPlan() {
  const main = $('#main');
  main.innerHTML = '';
  main.appendChild(el('h1', '', `${ic('target')} 作战计划`));
  const proj = Store.projectedScore();
  const pClr = proj >= 0.70 ? 'var(--green)' : proj >= 0.60 ? 'var(--amber)' : 'var(--red)';

  const gauge = el('div', 'card');
  gauge.style.textAlign = 'center';
  gauge.innerHTML = `
    <div style="font-size:3rem;font-weight:800;color:${pClr}">${Math.round(proj * 100)}%</div>
    <div class="muted">按各科正确率×权重估算的预计得分 · 过线约需 <b>70%</b></div>
    <div class="progress" style="margin:12px 0 4px;height:8px"><i style="width:${Math.min(100, proj * 100)}%;background:${pClr}"></i></div>
    <div style="position:relative;height:0"><span style="position:absolute;left:70%;top:-14px;font-size:.7rem;color:var(--muted)">↑过线</span></div>
    <p class="muted" style="margin-top:16px">${proj >= 0.70 ? '照当前水平能过。守住 A 档, 别塌方。' : '把大权重科目(A档)拉到 70%+ 最划算——同样努力涨分最多。'}</p>`;
  main.appendChild(gauge);

  main.appendChild(el('p', 'muted', '每科：点 <b>档位</b>切满仓/保底/放弃(影响新题分配) · 点 <b>练</b>直接刷这科。未测科目按 40% 保守估。'));

  const ts = Store.topicStats();
  const rows = Object.values(ts).sort((a, b) => b.weight - a.weight);
  const card = el('div', 'card');
  for (const s of rows) {
    const acc = s.acc == null ? null : Math.round(s.acc * 100);
    const target = s.tier === 'A' ? 70 : s.tier === 'B' ? 60 : 50;
    const onTrack = acc != null && acc >= target;
    const row = el('div', 'planrow');
    const left = el('div', 'planrow-main');
    left.innerHTML = `<div><b>${esc(s.topic)}</b> <span class="muted">${esc(s.name_cn || '')} · 权重~${s.weight}%</span></div>
      <div class="bar" style="margin-top:5px"><i style="width:${acc || 0}%;background:${onTrack ? 'var(--green)' : acc == null ? 'var(--border)' : 'var(--amber)'}"></i></div>
      <div class="muted" style="font-size:.78rem;margin-top:3px">${acc == null ? '未测' : acc + '% 正确'} · 目标 ${target}% ${onTrack ? ic('check', '', 'color:var(--green)') : acc == null ? '' : '↑'}</div>`;
    row.appendChild(left);
    const tierBtn = el('button', `tierbtn tier-${s.tier}`, s.tier);
    tierBtn.title = '点击切换 满仓A/保底B/放弃C';
    tierBtn.onclick = () => {
      const next = { A: 'B', B: 'C', C: 'A' }[s.tier];
      Store.setTier(s.topic, next);
      renderPlan();
    };
    row.appendChild(tierBtn);
    const prac = el('button', 'pracbtn', '练');
    prac.onclick = () => {
      Quiz.session = Store.practiceTopic(s.topic, 10);
      if (!Quiz.session.length) { toast('这科暂无可练的题'); return; }
      Quiz.idx = 0; Quiz.right = 0; location.hash = '#quiz';
    };
    row.appendChild(prac);
    card.appendChild(row);
  }
  main.appendChild(card);

  // 考试行政日程
  main.appendChild(el('h2', '', `${ic('calendar')} 考试关键日程`));
  const cal = el('div', 'card');
  for (const t of Store.examTodos()) {
    const urgent = !t.done && t.days >= 0 && t.days <= 21;
    const overdue = !t.done && t.days < 0 && t.key !== 'exam';
    const row = el('div', `examrow${urgent ? ' urgent' : ''}`);
    const cb = el('button', 'examcheck', t.done ? ic('checkC', '', 'color:var(--green)') : ic('square'));
    cb.onclick = () => { Store.toggleExamDone(t.key); renderPlan(); };
    row.appendChild(cb);
    const mid = el('div', 'examrow-main');
    const when = t.days === 0 ? '就是今天!' : t.days > 0 ? `还有 ${t.days} 天` : `已过 ${-t.days} 天`;
    mid.innerHTML = `<div><b>${esc(t.label)}</b> <span class="muted">${t.date}</span></div>
      <div class="muted" style="font-size:.78rem">${esc(t.note)} · <span style="color:${urgent ? 'var(--red)' : overdue ? 'var(--amber)' : 'var(--muted)'}">${t.done ? '已完成' : when}</span></div>`;
    row.appendChild(mid);
    cal.appendChild(row);
  }
  main.appendChild(cal);
  main.appendChild(el('div', 'card muted',
    `${ic('pin')} 已为你在云端设好提醒: 报名/预约截止前会推送到手机。改考期请去设置。<br>数据来源: CFA Institute 2026 二级日程。`));

  const ph = Store.phase();
  main.appendChild(el('div', 'card muted',
    `当前阶段: ${ic(ph.icon)} <b>${ph.name}</b> — ${ph.desc}。<br>档位含义: <b>满仓A</b> 3x新题额度,目标>70% · <b>保底B</b> 1.5x,~60% · <b>放弃C</b> 0.5x,蒙题保底。放弃是策略, 70%就能过,不必全科拿高分。`));
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
        row.appendChild(el('span', 'pct', pct === null ? '未做' : `${weak ? ic('dot', '', 'color:var(--red)') + ' ' : ''}${pct}% (${l.right}/${l.n})`));
        row.appendChild(el('div', '', esc(los)));
        const bar = el('div', 'bar');
        bar.appendChild(el('i', '', '')).style.width = `${pct ?? 0}%`;
        row.appendChild(bar);
        card.appendChild(row);
      });
    main.appendChild(card);
  }
  if (hasWeak) main.appendChild(el('p', 'muted', `${ic('dot', '', 'color:var(--red)')} = 复习≥2次且正确率<60%。这些 LOS 的题会被调度器自动更频繁地排回来。`));
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
    <h2>${ic('bot')} AI 教练 · 每日提醒</h2>
    <p class="muted">贴一个 GitHub fine-grained token(只授权本仓库的 Contents 读写)。答题后进度自动回传仓库,教练每晚检查并推送提醒到手机。</p>
    <label class="field">GitHub Token</label><input type="password" id="set-token" placeholder="github_pat_..." value="${esc(s.ghToken)}">
    <label class="field">仓库 (owner/repo)</label><input type="text" id="set-repo" value="${esc(s.ghRepo)}">
    <label class="field">分支</label><input type="text" id="set-branch" value="${esc(s.ghBranch)}">`;
  main.appendChild(c2);

  const c2b = el('div', 'card');
  c2b.innerHTML = `
    <h2>${ic('cap')} AI 教练 · 内联讲解</h2>
    <p class="muted">贴一个 Gemini API key,答题/微课里"问教练"就直接在页内出中文讲解,不用复制去别处。留空则回退到复制模式。(也兼容 Anthropic key,按前缀自动识别)</p>
    <label class="field">Gemini API Key</label><input type="password" id="set-aikey" placeholder="AIza..." value="${esc(s.aiKey)}">
    <label class="field">模型</label><input type="text" id="set-aimodel" placeholder="gemini-2.5-flash" value="${esc(s.aiModel)}">`;
  main.appendChild(c2b);

  // 解析语言开关
  const cLang = el('div', 'card');
  cLang.innerHTML = `<h2>${ic('book')} 解析语言</h2>
    <p class="muted">做题解析默认用哪种语言。选 English = 考前纯英文沉浸(中文原文由教练即时翻译并缓存,需 Gemini key)。每条解析也能单条一键切换。</p>`;
  const seg = el('div', 'langseg');
  [['cn', '中文'], ['en', 'English']].forEach(([v, label]) => {
    const bb = el('button', 'segbtn' + (s.explLang === v ? ' on' : ''), label);
    bb.onclick = () => { Store.setSettings({ explLang: v }); renderSettings(); };
    seg.appendChild(bb);
  });
  cLang.appendChild(seg);
  main.appendChild(cLang);

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
      aiModel: $('#set-aimodel').value.trim() || 'gemini-2.5-flash',
    });
    Store.flushPending();
    toast('已保存');
  };
  main.appendChild(saveBtn);

  const c3 = el('div', 'card');
  c3.appendChild(el('h2', '', '数据'));
  const row = el('div', 'btnrow');
  const exp = el('button', '', `${ic('upload')} 导出备份`);
  exp.onclick = () => {
    const area = $('#backup-area');
    area.style.display = 'block';
    area.value = Store.exportData();
    area.select();
    navigator.clipboard.writeText(area.value).then(() => toast('已复制到剪贴板'), () => toast('已显示,手动复制'));
  };
  const imp = el('button', '', `${ic('download')} 导入备份`);
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
  const cloud = el('button', '', `${ic('cloud')} 从云备份恢复`);
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
  const rst = el('button', 'danger', `${ic('refresh')} 重置学习记录`);
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

/* ---------- 框架屏 (品职式三层压缩的最后一层, 弱点自动标红) ---------- */
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
let FRAMES_MANIFEST = null;   // 原版脑图图片清单 {topic:[png...]}
fetch('frames/manifest.json').then(r => r.ok ? r.json() : null).then(m => { FRAMES_MANIFEST = m; }).catch(() => {});

/* 全屏脑图浮层: 点节点进来并定位, 支持缩放/平移, 点节点继续聚焦 */
function openMindmapFS(tree, focusNode) {
  const ov = el('div', 'fs-overlay');
  const bar = el('div', 'fs-bar');
  bar.appendChild(el('span', '', `${ic('network')} 脑图 · 双指缩放 / 拖动 / 点节点聚焦`));
  const close = el('button', 'fs-close', ic('x'));
  close.onclick = () => ov.remove();
  bar.appendChild(close);
  ov.appendChild(bar);
  const box = el('div', 'fs-map');
  ov.appendChild(box);
  document.body.appendChild(ov);
  requestAnimationFrame(() => {
    const ctl = MindMap.render(box, tree, {
      onNodeTap: (node) => openNodeSheet(node, FRAME_TOPIC),   // 全屏内点节点 → 打开详情
    });
    if (focusNode && ctl) {
      // 匹配到同名节点(树被重建过)后聚焦
      let target = null;
      (function find(n) { if (n.name === focusNode.name) target = n; (n.children || []).forEach(find); })(tree);
      if (target) ctl.focus(target);
    }
  });
}

/* 原版脑图: 全屏图片查看器 (双指缩放/拖动, 多页可翻) */
function openImageFS(srcs, title) {
  const list = Array.isArray(srcs) ? srcs : [srcs];
  let pi = 0;
  const ov = el('div', 'fs-overlay');
  const bar = el('div', 'fs-bar');
  const label = el('span', '', `${ic('file')} ${esc(title || '原版脑图')}${list.length > 1 ? ` (${pi + 1}/${list.length})` : ''}`);
  bar.appendChild(label);
  const close = el('button', 'fs-close', ic('x'));
  close.onclick = () => ov.remove();
  bar.appendChild(close);
  ov.appendChild(bar);
  const box = el('div', 'fs-map');
  ov.appendChild(box);

  let scale = 1, tx = 0, ty = 0, natW = 0, natH = 0;
  const img = el('img', 'fsimg', '');
  box.appendChild(img);
  const apply = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; };
  function load(i) {
    img.style.opacity = '0';
    img.onload = () => {
      natW = img.naturalWidth; natH = img.naturalHeight;
      const cw = box.clientWidth, ch = box.clientHeight;
      scale = Math.min(cw / natW, ch / natH) * 0.98;
      tx = (cw - natW * scale) / 2; ty = (ch - natH * scale) / 2;
      apply(); img.style.opacity = '1';
    };
    img.src = list[i];
    label.innerHTML = `${ic('file')} ${esc(title || '原版脑图')}${list.length > 1 ? ` (${i + 1}/${list.length})` : ''}`;
  }
  if (list.length > 1) {
    const nav = el('div', 'fs-imgnav');
    const prev = el('button', '', '◀'); const next = el('button', '', '▶');
    prev.onclick = () => { pi = (pi - 1 + list.length) % list.length; load(pi); };
    next.onclick = () => { pi = (pi + 1) % list.length; load(pi); };
    nav.appendChild(prev); nav.appendChild(next);
    ov.appendChild(nav);
  }

  const pointers = new Map();
  let lx = 0, ly = 0, pinch = 0;
  box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 1) { lx = e.clientX; ly = e.clientY; } });
  box.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];
    if (pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const r = box.getBoundingClientRect();
      if (pinch) { const ns = Math.min(6, Math.max(0.2, scale * d / pinch)); const mx = mid.x - r.left, my = mid.y - r.top; tx = mx - (mx - tx) * (ns / scale); ty = my - (my - ty) * (ns / scale); scale = ns; apply(); }
      pinch = d;
    } else if (pointers.size === 1) { tx += e.clientX - lx; ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; apply(); }
  });
  const up = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', e => { e.preventDefault(); const r = box.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const ns = Math.min(6, Math.max(0.2, scale * (e.deltaY < 0 ? 1.15 : 0.87))); tx = mx - (mx - tx) * (ns / scale); ty = my - (my - ty) * (ns / scale); scale = ns; apply(); }, { passive: false });

  document.body.appendChild(ov);
  requestAnimationFrame(() => load(pi));
}

/* 脑图节点详情底卡: 全文 + 知识点 + 笔记 + 练相关题 */
function openNodeSheet(node, topic) {
  if (node.kind === 'root') return;
  const sheet = el('div', 'sheet');
  const panel = el('div', 'sheet-panel');
  sheet.appendChild(panel);
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };

  panel.appendChild(el('div', 'sheet-handle', ''));
  const badges = `${node.weak ? `<span class="freq hi">${ic('dot')} 弱点</span>` : ''}${node.f ? `<span class="freq f">${ic('root')} 公式</span>` : ''}${node.trap ? `<span class="freq" style="background:var(--red-soft);color:var(--red)">${ic('warn')} 陷阱</span>` : ''}`;
  panel.appendChild(el('div', 'sheet-badges', badges));
  panel.appendChild(el('div', 'sheet-full', richText(node.full)));
  const kp = node.kind === 'module' ? node.module : `${topic} · ${node.module}${node.los ? ' · ' + esc(node.los) : ''}`;
  panel.appendChild(el('div', 'sheet-kp', `${ic('library')} 知识点: ${esc(kp)}`));

  // 相关题数
  const rel = Store.bank.questions.filter(q => q.topic === topic &&
    (node.los ? (q.los === node.los || (q.los || '').includes(node.los.slice(0, 12))) : (q.module === node.module)));
  // 关联微课: 有则可当场展开
  const lesson = node.los && Store.bank.lessons ? Store.bank.lessons[topic + '|' + node.los] : null;
  if (lesson && lesson.length) {
    const lBtn = el('button', 'bigbtn secondary', `${ic('book')} 看这个考点的微课 (${lesson.length} 卡)`);
    lBtn.onclick = () => {
      lBtn.style.display = 'none';
      const box = el('div', 'sheet-lesson');
      for (const cc of lesson) {
        const kind = lessonKind(cc.h);
        const lc = el('div', `lesson-card lk-${kind.cls}`);
        lc.appendChild(el('h2', '', `${ic(kind.icon)} ${esc(cc.h)}`));
        lc.appendChild(el('div', 'lesson-body', richText(cc.b)));
        box.appendChild(lc);
      }
      panel.insertBefore(box, lBtn.nextSibling);
    };
    panel.appendChild(lBtn);
  }

  const practiceBtn = el('button', 'bigbtn', `${ic('pencil')} 练相关题 (${rel.length} 道)`);
  practiceBtn.disabled = !rel.length;
  practiceBtn.onclick = () => {
    const dues = rel.filter(q => { const c = Store.cardState(q.id); return c.reps > 0; });
    const pool = dues.concat(rel.filter(q => Store.cardState(q.id).reps === 0));
    Quiz.session = pool.slice(0, 10); Quiz.idx = 0; Quiz.right = 0;
    sheet.remove(); location.hash = '#quiz';
  };
  panel.appendChild(practiceBtn);

  // 笔记 (按节点持久化, 随云备份)
  const noteId = `map:${topic}:${node.los || node.module || node.full.slice(0, 30)}`;
  const old = Store.getNote(noteId);
  panel.appendChild(el('label', 'field', `${ic('pencil')} 我的笔记 (这个考点的口诀/误区)`));
  const ta = el('textarea', '', '');
  ta.value = old; ta.placeholder = '写给复习时的自己…';
  panel.appendChild(ta);
  const saveBtn = el('button', 'askbtn', old ? '更新笔记' : '保存笔记');
  saveBtn.onclick = () => { Store.setNote(noteId, ta.value); toast('笔记已存'); };
  panel.appendChild(saveBtn);

  // 问教练
  panel.appendChild(tutorWidget(`${ic('help')} 让教练讲讲这个点`, () =>
    `请用最简单的方式+一个例子讲清楚 CFA L2 ${topic} 的这个考点:\n${node.full}\n知识点: ${node.module}${node.los ? ' / ' + node.los : ''}`));

  document.body.appendChild(sheet);
  requestAnimationFrame(() => panel.classList.add('up'));
}

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
  const bMap = el('button', FRAME_VIEW === 'map' ? 'primary' : '', `${ic('network')} 脑图`);
  const bList = el('button', FRAME_VIEW === 'list' ? 'primary' : '', `${ic('list')} 列表`);
  bMap.style.cssText = bList.style.cssText = 'flex:1;padding:8px;border-radius:10px;border:1.5px solid var(--border);background:var(--card);color:var(--text)';
  (FRAME_VIEW === 'map' ? bMap : bList).style.borderColor = 'var(--accent)';
  bMap.onclick = () => { FRAME_VIEW = 'map'; renderFrames(); };
  bList.onclick = () => { FRAME_VIEW = 'list'; renderFrames(); };
  bar.appendChild(bMap); bar.appendChild(bList);
  main.appendChild(bar);

  const weakSet = weakSetOf();
  const meta = Store.bank.topics[FRAME_TOPIC] || {};

  if (FRAME_VIEW === 'map') {
    main.appendChild(el('p', 'muted', `双指缩放 · 拖动平移 · 点节点看详情 · ${ic('dot', '', 'color:var(--red)')} 弱点 · ${ic('root', '', 'color:var(--green)')} 公式 · ${ic('warn', '', 'color:var(--amber)')} 陷阱`));
    const full = Store.bank.framesFull || {};
    let tree;
    if (full[FRAME_TOPIC]) {
      // 完整原版树 (从框架脑图逐节点提取, 任意深度); 节点显示完整文字, 框随字扩大
      const conv = (node) => {
        const out = {
          name: node.name, full: node.name, module: FRAME_TOPIC, los: '',
          f: node.f, trap: node.trap,
          kind: node.children && node.children.length ? 'module' : 'point',
        };
        if (node.children && node.children.length) out.children = node.children.map(conv);
        return out;
      };
      tree = conv(full[FRAME_TOPIC]);
      tree.kind = 'root';
    } else {
      tree = { name: `${FRAME_TOPIC}`, full: `${FRAME_TOPIC} ${meta.name_cn || ''}`, kind: 'root', children: [] };
      for (const [mod, lines] of Object.entries(frames[FRAME_TOPIC])) {
        const mnode = { name: mod, full: mod, kind: 'module', module: mod, children: [] };
        for (const ln of lines) {
          const weak = ln.los && weakSet.has(FRAME_TOPIC + '|' + ln.los);
          mnode.children.push({
            name: ln.t, full: ln.t, los: ln.los || '', module: mod,
            f: ln.f, trap: ln.trap, weak, kind: 'point',
          });
        }
        if (mnode.children.some(c => c.weak)) mnode.weak = true;
        tree.children.push(mnode);
      }
    }
    const fsBtn = el('button', '', `${ic('maximize')} 全屏脑图 (双指缩放·点节点看详情)`);
    fsBtn.style.cssText = 'width:100%;padding:10px;border-radius:10px;border:1.5px solid var(--accent);background:var(--accent);color:#fff;font-weight:600;margin-bottom:8px';
    fsBtn.onclick = () => openMindmapFS(tree, null);
    main.appendChild(fsBtn);
    const box = el('div', 'mapbox');
    main.appendChild(box);
    requestAnimationFrame(() => MindMap.render(box, tree, { onNodeTap: (node) => openNodeSheet(node, FRAME_TOPIC) }));
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
      if (weak) badges += ic('dot', '', 'color:var(--red)') + ' ';
      if (ln.f) badges += ic('root', '', 'color:var(--green)') + ' ';
      if (ln.trap) badges += ic('warn', '', 'color:var(--amber)') + ' ';
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
    card.appendChild(el('h1', '', `${ic('clipboard')} Mock 20 题`));
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
  head.appendChild(el('span', '', `${ic('clock')} ${mins} 分钟`));
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
  card.appendChild(el('div', 'doneemoji', pct >= 70 ? ic('trophy') : pct >= 55 ? ic('flame') : ic('wrench')));
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
    row.appendChild(el('span', 'pct', `${p}% (${v.r}/${v.n})${weakA ? ` ${ic('warn', '', 'color:var(--amber)')}A档告警` : ''}`));
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
    toast(res.ok ? '成绩单已同步' : '成绩单已存本地');
    Mock.qs = null;
    location.hash = '#today';
  };
  main.appendChild(fin);
}

/* ---------- 路由 ---------- */
const ROUTES = { today: renderToday, quiz: renderQuiz, stats: renderStats, settings: renderSettings, frames: renderFrames, mock: renderMock, plan: renderPlan };
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
