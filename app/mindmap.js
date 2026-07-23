/* 交互式脑图 (零依赖 SVG) —— 双指缩放/拖动平移, 手机可用。
 * 数据: {name, children:[{name, mark, weak, children:[...]}]} 层级树。 */
'use strict';

const MindMap = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const ROW = 30, COLGAP = 46, PADX = 14, PADY = 7, LINE = 15;

  function wrap(text, max) {
    const words = String(text).split(/(\s+)/);
    const lines = []; let cur = '';
    for (const w of words) {
      if ((cur + w).length > max && cur) { lines.push(cur.trim()); cur = w; }
      else cur += w;
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines.slice(0, 3);
  }

  // 计算布局: 横向树, 叶子逐行排, 父节点取子节点纵向中点
  function layout(node, depth, maxChars) {
    node.depth = depth;
    node.lines = wrap(node.name, maxChars[Math.min(depth, maxChars.length - 1)]);
    node.h = node.lines.length * LINE + PADY * 2;
    if (node.children && node.children.length) {
      node.children.forEach(c => layout(c, depth + 1, maxChars));
    }
    return node;
  }

  function assignY(node, cursor) {
    if (!node.children || !node.children.length) {
      node.y = cursor.y + node.h / 2;
      cursor.y += Math.max(node.h, ROW) + 8;
      return node.y;
    }
    const ys = node.children.map(c => assignY(c, cursor));
    node.y = (ys[0] + ys[ys.length - 1]) / 2;
    return node.y;
  }

  function colWidth(nodes, maxChars, depth) {
    let w = 0;
    for (const n of nodes) w = Math.max(w, estWidth(n));
    return w;
  }
  function estWidth(node) {
    let m = 0;
    for (const l of node.lines) m = Math.max(m, l.length);
    return m * 7.6 + PADX * 2;
  }

  function collectByDepth(root) {
    const byd = [];
    (function walk(n) {
      (byd[n.depth] = byd[n.depth] || []).push(n);
      (n.children || []).forEach(walk);
    })(root);
    return byd;
  }

  function render(container, tree) {
    container.innerHTML = '';
    const maxChars = [14, 18, 24];
    layout(tree, 0, maxChars);
    assignY(tree, { y: PADY });
    const byd = collectByDepth(tree);
    // 每层 x = 前面各层最大宽度累加
    const colX = [PADX];
    for (let d = 0; d < byd.length; d++) {
      const w = colWidth(byd[d]);
      byd[d].forEach(n => { n.x = colX[d]; n.w = Math.max(estWidth(n), 80); });
      colX[d + 1] = colX[d] + w + COLGAP;
    }
    let maxY = 0, maxX = 0;
    (function b(n) { maxY = Math.max(maxY, n.y + n.h); maxX = Math.max(maxX, n.x + (n.w || 100)); (n.children || []).forEach(b); })(tree);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', maxX + PADX);
    svg.setAttribute('height', maxY + PADY);
    svg.style.cssText = 'font-family:system-ui,sans-serif;';
    const g = document.createElementNS(NS, 'g');
    svg.appendChild(g);

    const accent = getComputedStyle(document.body).getPropertyValue('--accent') || '#2563eb';
    const border = getComputedStyle(document.body).getPropertyValue('--border') || '#ccc';
    const cardBg = getComputedStyle(document.body).getPropertyValue('--card') || '#fff';
    const textCol = getComputedStyle(document.body).getPropertyValue('--text') || '#111';
    const red = getComputedStyle(document.body).getPropertyValue('--red') || '#dc2626';

    // 连线
    (function edges(n) {
      for (const c of n.children || []) {
        const x1 = n.x + n.w, y1 = n.y, x2 = c.x, y2 = c.y;
        const mid = (x1 + x2) / 2;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', c.weak ? red : border);
        path.setAttribute('stroke-width', n.depth === 0 ? 2 : 1.2);
        g.appendChild(path);
        edges(c);
      }
    })(tree);

    // 节点
    (function nodes(n) {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', n.x); rect.setAttribute('y', n.y - n.h / 2);
      rect.setAttribute('width', n.w); rect.setAttribute('height', n.h);
      rect.setAttribute('rx', 8);
      const isRoot = n.depth === 0, isMod = n.depth === 1;
      rect.setAttribute('fill', isRoot ? accent : cardBg);
      rect.setAttribute('stroke', n.weak ? red : (isMod ? accent : border));
      rect.setAttribute('stroke-width', n.weak ? 2 : 1.2);
      g.appendChild(rect);
      n.lines.forEach((ln, i) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', n.x + PADX);
        t.setAttribute('y', n.y - n.h / 2 + PADY + LINE * (i + 0.75));
        t.setAttribute('font-size', isRoot ? 13 : isMod ? 12 : 11);
        t.setAttribute('font-weight', isRoot || isMod ? 600 : 400);
        t.setAttribute('fill', isRoot ? '#fff' : (n.weak ? red : textCol));
        t.textContent = (i === 0 ? (n.mark || '') : '') + ln;
        g.appendChild(t);
      });
      (n.children || []).forEach(nodes);
    })(tree);

    container.appendChild(svg);
    enablePanZoom(container, svg, g, maxX + PADX, maxY + PADY);
  }

  function enablePanZoom(container, svg, g, contentW, contentH) {
    const cw = container.clientWidth || 340;
    let scale = Math.min(1, (cw - 8) / contentW);
    let tx = 8, ty = 8;
    const apply = () => g.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
    svg.setAttribute('width', cw);
    svg.setAttribute('height', Math.min(contentH * scale + 16, container.clientHeight || 460));
    apply();

    let dragging = false, lx = 0, ly = 0;
    const pointers = new Map();
    let pinchDist = 0, pinchMid = null;

    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { dragging = true; lx = e.clientX; ly = e.clientY; }
    });
    svg.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...pointers.values()];
      if (pts.length === 2) {                    // 双指缩放
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const r = svg.getBoundingClientRect();
        if (pinchDist) {
          const ns = Math.min(3, Math.max(0.2, scale * d / pinchDist));
          const mx = mid.x - r.left, my = mid.y - r.top;
          tx = mx - (mx - tx) * (ns / scale);
          ty = my - (my - ty) * (ns / scale);
          scale = ns; apply();
        }
        pinchDist = d; pinchMid = mid;
      } else if (dragging) {                     // 拖动平移
        tx += e.clientX - lx; ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; apply();
      }
    });
    const up = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0; if (!pointers.size) dragging = false; };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const ns = Math.min(3, Math.max(0.2, scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      tx = mx - (mx - tx) * (ns / scale); ty = my - (my - ty) * (ns / scale);
      scale = ns; apply();
    }, { passive: false });
  }

  return { render };
})();

if (typeof window !== 'undefined') window.MindMap = MindMap;
