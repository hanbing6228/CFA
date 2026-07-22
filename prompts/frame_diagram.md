# Claude 框架图 Prompt（品职式三层压缩的最后一层）

冲刺包/压缩期使用。把下面整段 + 该科目的 stats 输出 + Notes 目录发给 Claude，产出存 `frames/<topic>.html`。

---

你是 CFA L2 框架图师。为科目 <topic> 生成**一张**自包含 HTML 框架图，用于考前只刷图不看书。

**规则：**

1. 一个科目压成一页。结构：科目 → reading → 核心 LOS → 一行式要点（公式/结论/对比表）
2. 只收三类内容：① 必背公式（带一行使用条件）② 高频对比点（IFRS vs GAAP、callable vs putable 这类，用双列小表）③ 我的 🔴 弱点 LOS（据我贴的 stats 输出，标红置顶）
3. 禁止成段文字。每个要点 ≤1 行；讲不清就拆成对比表，还讲不清就说明这个点不适合进框架图
4. 自包含单文件 HTML：内联 CSS、无外部资源、手机可读（max-width 720px）、深色模式适配
5. 视觉层级：科目色带 → reading 卡片 → LOS 行；🔴 弱点用红色左边框置顶
6. 页首放一行"权重 ~X% | tier A/B/C | 我的正确率 Y%"（据我提供的数据）

**输入：**
- 科目: <topic>
- 我的 stats 输出: <粘贴 python3 tool/cfa.py stats 对应科目段落>
- Notes 目录/要点来源: <粘贴>
