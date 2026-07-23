# 题库内容来源与策略

用户判定：所用 CFA L2 真题为**公开大纲题、已过期**，直接原文导入（非改编）。

- `cases_*.json` —— 从 2026 L2 Mock (past/public) 逐字提取的 vignette 真题，原文题干/选项/Exhibit/解析照录，`source: "2026 L2 Mock (past, public)"`，`verified.method: "verbatim-import"`。
- `FSA.json / Equity.json / FI.json / seed.json` —— 早期生成+对抗校验的原创题（保留，作补充）。
- 原始 PDF/提取文本在 `import/`（gitignore，不入库）；解析后的题目 JSON 入库并公开托管（用户授权）。
- 扩库：`pages_extract` 里另有 ~1071 道 .pages 真题待逐字导入（下一批）。
