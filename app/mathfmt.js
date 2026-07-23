/* 轻量 LaTeX 子集渲染器 (零依赖, 离线) —— 把 $...$ 内的公式渲染成真符号。
 * 支持: \frac{}{} 分数, _{}/^{} 上下标, \sqrt{}, \left(\right), \text{},
 *       希腊字母, \times \cdot \div \pm \approx \le \ge \ne \sum \Delta \partial 等。
 * 不追求覆盖全 LaTeX, 只覆盖 CFA L2 公式所需子集。 */
'use strict';

const MathFmt = (() => {
  const SYM = {
    '\\times': '×', '\\cdot': '·', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
    '\\approx': '≈', '\\le': '≤', '\\leq': '≤', '\\ge': '≥', '\\geq': '≥',
    '\\ne': '≠', '\\neq': '≠', '\\equiv': '≡', '\\propto': '∝', '\\infty': '∞',
    '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\partial': '∂', '\\nabla': '∇',
    '\\Delta': 'Δ', '\\delta': 'δ', '\\sigma': 'σ', '\\Sigma': 'Σ', '\\mu': 'μ',
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\Gamma': 'Γ', '\\rho': 'ρ',
    '\\lambda': 'λ', '\\theta': 'θ', '\\omega': 'ω', '\\Omega': 'Ω', '\\pi': 'π',
    '\\phi': 'φ', '\\varphi': 'φ', '\\epsilon': 'ε', '\\varepsilon': 'ε',
    '\\tau': 'τ', '\\eta': 'η', '\\kappa': 'κ', '\\nu': 'ν', '\\chi': 'χ',
    '\\cdots': '⋯', '\\ldots': '…', '\\to': '→', '\\rightarrow': '→',
    '\\Rightarrow': '⇒', '\\leftarrow': '←', '\\hat': '', '\\bar': '', '\\%': '%',
    '\\,': ' ', '\\;': ' ', '\\ ': ' ', '\\left': '', '\\right': '',
  };

  function esc(s) {
    return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  // 读一个参数组: {…}(配平嵌套) 或单字符
  function readGroup(s, i) {
    if (s[i] === '{') {
      let depth = 1, j = i + 1;
      while (j < s.length && depth > 0) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') depth--;
        if (depth === 0) break;
        j++;
      }
      return { body: s.slice(i + 1, j), next: j + 1 };
    }
    if (s[i] === '\\') {                       // 命令作为单元
      const m = /^\\[a-zA-Z]+/.exec(s.slice(i));
      if (m) return { body: s.slice(i, i + m[0].length), next: i + m[0].length };
    }
    return { body: s[i] || '', next: i + 1 };
  }

  function render(tex) {
    let out = '';
    let i = 0;
    const s = tex;
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') {
        // \frac{}{}
        if (s.startsWith('\\frac', i)) {
          const a = readGroup(s, i + 5);
          const b = readGroup(s, a.next);
          out += `<span class="mf-frac"><span class="mf-num">${render(a.body)}</span>`
            + `<span class="mf-den">${render(b.body)}</span></span>`;
          i = b.next; continue;
        }
        if (s.startsWith('\\sqrt', i)) {
          const a = readGroup(s, i + 5);
          out += `<span class="mf-sqrt">√<span class="mf-sqrt-b">${render(a.body)}</span></span>`;
          i = a.next; continue;
        }
        if (s.startsWith('\\text', i)) {
          const a = readGroup(s, i + 5);
          out += `<span class="mf-text">${esc(a.body)}</span>`;
          i = a.next; continue;
        }
        if (s.startsWith('\\hat', i) || s.startsWith('\\bar', i)) {
          const cmd = s.slice(i, i + 4);
          const a = readGroup(s, i + 4);
          const mark = cmd === '\\hat' ? '&#770;' : '&#772;';   // combining hat / macron
          out += `<span class="mf-acc">${render(a.body)}${mark}</span>`;
          i = a.next; continue;
        }
        const m = /^\\[a-zA-Z]+|^\\[%,; ]/.exec(s.slice(i));
        if (m && SYM.hasOwnProperty(m[0])) { out += SYM[m[0]]; i += m[0].length; continue; }
        if (m) { out += esc(m[0].slice(1)); i += m[0].length; continue; }
        out += esc(s[i + 1] || ''); i += 2; continue;
      }
      if (c === '_' || c === '^') {
        const a = readGroup(s, i + 1);
        const tag = c === '_' ? 'sub' : 'sup';
        out += `<${tag} class="mf-${tag}">${render(a.body)}</${tag}>`;
        i = a.next; continue;
      }
      if (c === '{' || c === '}') { i++; continue; }   // 裸括号忽略
      out += esc(c); i++;
    }
    return out;
  }

  // 把文本里的 $...$ / $$...$$ 替换成渲染结果, 其余部分保持(需已转义)
  function renderText(raw) {
    const parts = String(raw).split(/(\$\$[^$]*\$\$|\$[^$]*\$)/g);
    return parts.map(p => {
      if (p.startsWith('$$') && p.endsWith('$$')) return `<span class="mf">${render(p.slice(2, -2))}</span>`;
      if (p.startsWith('$') && p.endsWith('$') && p.length > 1) return `<span class="mf">${render(p.slice(1, -1))}</span>`;
      return esc(p);
    }).join('');
  }

  return { render, renderText };
})();

if (typeof window !== 'undefined') window.MathFmt = MathFmt;
if (typeof module !== 'undefined') module.exports = MathFmt;
