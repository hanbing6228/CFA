/* 交互式脑图 (零依赖 SVG) —— 双指缩放/拖动平移, 手机可用。
 * 节点框随文字自动扩大 (完整显示, 不截断), 按分支 color-code。
 * 数据: {name, full?, children:[...], f?, trap?, weak?, kind?} 层级树。 */
'use strict';

const MindMap = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const COLGAP = 52, PADX = 12, PADY = 8, LINE = 17, GAPY = 10;

  // 用 canvas 精确测量文字宽度 → 框一定装得下, 不溢出
  const _mc = document.createElement('canvas').getContext('2d');
  function font(depth) {
    const size = depth === 0 ? 14 : depth === 1 ? 13 : 12;
    const weight = depth <= 1 ? 600 : 400;
    return `${weight} ${size}px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif`;
  }
  function measure(text, f) { _mc.font = f; return _mc.measureText(text).width; }

  // 按像素宽度换行: CJK 逐字可断, 英文按词断; 不做 3 行截断, 全文显示
  function wrap(text, f, maxW) {
    const s = String(text);
    // 切成 token: 连续 ASCII(单词) 或 单个非 ASCII 字符
    const tokens = s.match(/[\x00-\xff]+|[^\x00-\xff]/g) || [s];
    const lines = []; let cur = '';
    for (let tk of tokens) {
      const parts = /[\x00-\xff]/.test(tk) ? tk.split(/(\s+)/) : [tk];
      for (const p of parts) {
        if (!p) continue;
        const test = cur + p;
        if (cur && measure(test, f) > maxW) { lines.push(cur); cur = p.replace(/^\s+/, ''); }
        else cur = test;
      }
    }
    if (cur.trim()) lines.push(cur);
    return lines.length ? lines : [s];
  }

  function layout(node, depth) {
    node.depth = depth;
    const f = font(depth);
    // 深层节点用窄一点的换行宽度, 让树不至于太宽
    const maxW = depth === 0 ? 200 : depth === 1 ? 220 : depth === 2 ? 240 : 260;
    node.lines = wrap(node.name, f, maxW);
    let w = 0;
    for (const l of node.lines) w = Math.max(w, measure(l, f));
    node.w = Math.ceil(w) + PADX * 2;
    node.h = node.lines.length * LINE + PADY * 2;
    if (node.children && node.children.length) node.children.forEach(c => layout(c, depth + 1));
    return node;
  }

  function assignY(node, cursor) {
    if (!node.children || !node.children.length) {
      node.y = cursor.y + node.h / 2;
      cursor.y += node.h + GAPY;
      return node.y;
    }
    const ys = node.children.map(c => assignY(c, cursor));
    node.y = (ys[0] + ys[ys.length - 1]) / 2;
    return node.y;
  }

  function collectByDepth(root) {
    const byd = [];
    (function walk(n) { (byd[n.depth] = byd[n.depth] || []).push(n); (n.children || []).forEach(walk); })(root);
    return byd;
  }

  // ---- 配色 (每个二级分支独立色相, 子孙继承; 一级=实心彩色主枝; 深浅双主题) ----
  const HUES = [222, 158, 32, 275, 340, 130, 48, 194, 8, 258, 96, 300, 172, 18, 240];
  function isDark() {
    const bg = getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
    const m = bg.match(/\d+/g);
    if (!m) return false;
    const [r, g, b] = m.map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
  }
  function palette(node, dark) {
    // 特殊态优先
    if (node.weak) return dark
      ? { fill: '#3a1418', stroke: '#f87171', text: '#fca5a5' }
      : { fill: '#fef2f2', stroke: '#dc2626', text: '#b91c1c' };
    const hue = node.hue == null ? 222 : node.hue;
    // 根: 深靛蓝实心
    if (node.depth === 0) return { fill: `hsl(248,68%,54%)`, stroke: `hsl(248,68%,44%)`, text: '#fff' };
    // 一级主枝: 实心彩色, 白字 (强对比, 一眼分块)
    if (node.depth === 1) return { fill: `hsl(${hue},58%,${dark ? 46 : 52}%)`, stroke: `hsl(${hue},58%,${dark ? 40 : 44}%)`, text: '#fff' };
    // 陷阱 / 公式 覆盖色
    if (node.trap) return dark
      ? { fill: `hsl(38,48%,17%)`, stroke: `hsl(38,82%,55%)`, text: `hsl(40,88%,74%)` }
      : { fill: `hsl(45,92%,90%)`, stroke: `hsl(35,88%,50%)`, text: `hsl(30,78%,36%)` };
    if (node.f) return dark
      ? { fill: `hsl(150,38%,16%)`, stroke: `hsl(150,58%,46%)`, text: `hsl(150,58%,74%)` }
      : { fill: `hsl(150,64%,90%)`, stroke: `hsl(150,54%,42%)`, text: `hsl(155,58%,28%)` };
    // 二级及以下: 该二级分支的色相, 越深越浅
    const d = Math.min(node.depth, 5);
    if (dark) {
      const L = [0, 0, 26, 22, 19, 17][d];
      return { fill: `hsl(${hue},38%,${L}%)`, stroke: `hsl(${hue},48%,46%)`, text: `hsl(${hue},42%,85%)` };
    }
    const L = [0, 0, 85, 89, 92, 94][d];
    return { fill: `hsl(${hue},72%,${L}%)`, stroke: `hsl(${hue},56%,56%)`, text: `hsl(${hue},52%,26%)` };
  }

  function render(container, tree, opts) {
    opts = opts || {};
    container.innerHTML = '';
    const dark = isDark();
    layout(tree, 0);
    // 配色: 一级主枝各自一色; 每个二级分支再独立轮换色相 → 整图色彩丰富且分组清晰
    let hueI = 0;
    tree.hue = 248;
    (tree.children || []).forEach((c1, i1) => {
      const h1 = HUES[i1 % HUES.length];
      c1.hue = h1;
      const kids = c1.children || [];
      if (!kids.length) return;
      kids.forEach((c2) => {
        const h2 = kids.length > 1 ? HUES[hueI++ % HUES.length] : h1;
        (function paint(n) { n.hue = h2; (n.children || []).forEach(paint); })(c2);
      });
    });
    assignY(tree, { y: PADY });
    const byd = collectByDepth(tree);
    const colX = [PADX];
    for (let d = 0; d < byd.length; d++) {
      let w = 0;
      for (const n of byd[d]) w = Math.max(w, n.w);
      byd[d].forEach(n => { n.x = colX[d]; });
      colX[d + 1] = colX[d] + w + COLGAP;
    }
    let maxY = 0, maxX = 0;
    (function b(n) { maxY = Math.max(maxY, n.y + n.h / 2); maxX = Math.max(maxX, n.x + n.w); (n.children || []).forEach(b); })(tree);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', maxX + PADX);
    svg.setAttribute('height', maxY + PADY);
    const g = document.createElementNS(NS, 'g');
    svg.appendChild(g);
    const edgeCol = dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)';

    // 连线 (贝塞尔)
    (function edges(n) {
      for (const c of n.children || []) {
        const x1 = n.x + n.w, y1 = n.y, x2 = c.x, y2 = c.y, mid = (x1 + x2) / 2;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', c.weak ? '#dc2626' : (c.hue != null ? `hsl(${c.hue},45%,${dark ? 50 : 62}%)` : edgeCol));
        path.setAttribute('stroke-width', n.depth === 0 ? 2.2 : 1.3);
        path.setAttribute('opacity', n.depth === 0 ? 0.9 : 0.55);
        g.appendChild(path);
        edges(c);
      }
    })(tree);

    // 节点
    const allNodes = [];
    (function nodes(n) {
      allNodes.push(n);
      const pal = palette(n, dark);
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', n.x); rect.setAttribute('y', n.y - n.h / 2);
      rect.setAttribute('width', n.w); rect.setAttribute('height', n.h);
      rect.setAttribute('rx', 9);
      rect.setAttribute('fill', pal.fill);
      rect.setAttribute('stroke', pal.stroke);
      rect.setAttribute('stroke-width', n.weak ? 2.2 : (n.depth <= 1 ? 1.6 : 1.2));
      rect.style.cursor = 'pointer';
      g.appendChild(rect);
      // 角标: 𝑓 公式 / ⚠ 陷阱 / 🔴 弱点
      const tag = n.weak ? '🔴' : n.trap ? '⚠️' : n.f ? '𝑓' : '';
      n.lines.forEach((ln, i) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', n.x + PADX);
        t.setAttribute('y', n.y - n.h / 2 + PADY + LINE * i + LINE * 0.72);
        t.setAttribute('font-size', n.depth === 0 ? 14 : n.depth === 1 ? 13 : 12);
        t.setAttribute('font-weight', n.depth <= 1 ? 600 : 400);
        t.setAttribute('fill', pal.text);
        t.setAttribute('font-family', 'system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif');
        t.textContent = (i === 0 && tag ? tag + ' ' : '') + ln;
        g.appendChild(t);
      });
      (n.children || []).forEach(nodes);
    })(tree);

    container.appendChild(svg);
    return enablePanZoom(container, svg, g, maxX + PADX, maxY + PADY, allNodes, opts);
  }

  function enablePanZoom(container, svg, g, contentW, contentH, allNodes, opts) {
    const cw = container.clientWidth || 340;
    const ch = container.clientHeight || 460;
    let scale = Math.min(1, (cw - 8) / contentW);
    let tx = 8, ty = 8;
    const apply = () => g.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
    svg.setAttribute('width', cw);
    svg.setAttribute('height', ch);
    apply();

    function focus(node, targetScale) {
      const ns = targetScale || Math.min(1.3, Math.max(0.6, 300 / node.w));
      const nx = node.x + node.w / 2, ny = node.y;
      scale = ns;
      tx = cw / 2 - nx * scale;
      ty = ch / 2 - ny * scale;
      apply();
    }

    let lx = 0, ly = 0, moved = 0, downX = 0, downY = 0;
    const pointers = new Map();
    let pinchDist = 0;

    function hitTest(clientX, clientY) {
      const r = svg.getBoundingClientRect();
      const cx = (clientX - r.left - tx) / scale;
      const cy = (clientY - r.top - ty) / scale;
      for (const n of allNodes) {
        if (cx >= n.x && cx <= n.x + n.w && cy >= n.y - n.h / 2 && cy <= n.y + n.h / 2) return n;
      }
      return null;
    }

    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { lx = e.clientX; ly = e.clientY; downX = e.clientX; downY = e.clientY; moved = 0; }
    });
    svg.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...pointers.values()];
      if (pts.length === 2) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const r = svg.getBoundingClientRect();
        if (pinchDist) {
          const nscale = Math.min(3, Math.max(0.2, scale * d / pinchDist));
          const mx = mid.x - r.left, my = mid.y - r.top;
          tx = mx - (mx - tx) * (nscale / scale); ty = my - (my - ty) * (nscale / scale);
          scale = nscale; apply();
        }
        pinchDist = d;
      } else if (pointers.size === 1) {
        moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
        tx += e.clientX - lx; ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; apply();
      }
    });
    const up = e => {
      if (pointers.size === 1 && moved < 8 && opts.onNodeTap) {
        const n = hitTest(e.clientX, e.clientY);
        if (n) opts.onNodeTap(n, focus);
      }
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', () => { pointers.clear(); pinchDist = 0; });
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const nscale = Math.min(3, Math.max(0.2, scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      tx = mx - (mx - tx) * (nscale / scale); ty = my - (my - ty) * (nscale / scale);
      scale = nscale; apply();
    }, { passive: false });

    return { focus };
  }

  return { render };
})();

if (typeof window !== 'undefined') window.MindMap = MindMap;
