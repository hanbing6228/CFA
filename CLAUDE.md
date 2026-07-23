# CFA L2 ExamKiller — 项目规则

移动优先的零依赖 PWA (app/)，帮用户用最小精力通过 CFA L2。无构建步骤，Vercel 直接托管 app/ 目录。

## 图标规则（硬性，永远遵守）

**永远不要用 emoji 当图标。** 🧠📋📌⚠️🔴✅🎯📝📚📖🤔🎓☁️♻️🏆 等一律禁止出现在 UI 里作为图标/装饰符号。

- 全 App 只用 `app/app.js` 里的统一线性 SVG 图标集 `_IC` + 辅助函数 `ic(name, cls, style)`。
- 需要新图标时，往 `_IC` 里加一条同风格的 24×24、`stroke="currentColor"`、线性描边路径，再用 `ic('name')` 调用；不要临时塞 emoji。
- 图标颜色跟随文字色（currentColor）；需要染色时传 `ic('warn','','color:var(--amber)')` 这种 style。
- 底部导航图标写在 `app/index.html` 的 `<nav>` 内联 SVG；App/PWA 图标在 `app/icons/`（icon.svg + icon-192/512.png，靛蓝→紫渐变 + 上升连点标识）。
- 风格基调：统一、高级、线性、克制。改动图标后同步 `app/sw.js` 的缓存版本号。

## 其他约定

- 脑图 (`app/mindmap.js`)：节点框随文字自动扩大（canvas 精确测宽，全文换行不截断）；按二级分支 color-code，子孙继承色相；深浅色主题双适配。
- 内容正确 + 完整是第一要务，其次 color code，其次统一高级图标风格。
- 主题色 accent = 靛蓝 `#4f46e5`（深色 `#818cf8`），与 App 图标一致。
