# 真题导入 Prompt（import/pages_extract_raw.txt → bank/*.json）

`import/` 目录存放从你自己的资料（Pages 题库等）提取的原始文本，**已 gitignore，永不入库/上网页**——机构题库受版权保护，公开仓库分发 = 侵权。安全用法：把真题作为"考点与难度的 ground truth"，让 Claude **改编**成表述、数字、情境都不同的自有题目再入库。

把下面整段 + `import/pages_extract_raw.txt` 中某一科的片段发给 Claude：

---

你是 CFA L2 出题专家。我给你的是我自己资料库中某科的真题文本片段（含题干、选项、答案、正确率、知识点标注）。请把它们**改编**为原创练习题，输出 bank/*.json 格式（schema 见 bank/seed.json 的 _schema）。

硬性规则：
0. **保留 case 结构**：原题是 vignette（背景 + Exhibit 表格 + 一组关联题）。输出同样用 case 格式（schema 见 bank/case_demo.json）：`cases` 数组放改编后的背景与 exhibits（table 二维数组，首行表头），`questions` 里每题挂 `"case": "<case id>"`。同一 case 的题在 App 里连续出现、背景可折叠。
1. **改编，不是复制**：考点保留，但题干情境重写（公司名/人名/行业全换）、计算题与 Exhibit 数字全部更换（重算所有选项数值与表格自洽性）、概念题表述重组。成品与原题不得有可辨认的文字重合。
2. 原题的"正确率"标注是难度信号：正确率 <60% 的考点优先改编（这些是全体考生的弱点，命题概率高）。
3. `los` 字段必须落在 bank/los_map.json 的骨架内（同 LOS 逐字一致）；原文"知识点"标注帮你定位到哪个 module。
4. 逐选项解析 + calc 题 steps 四步，标准与 bank/seed.json 一致。
5. `source` 写 "CFA L2 Curriculum, <module>, <知识点>"——出处锚定课纲而非原题库。
6. 改编后逐题验算，置信度不足的删掉。
7. id 前缀用科目缩写，不与现有 bank/*.json 冲突。

输出完整 `{"questions":[...]}`，我用 `python3 tool/cfa.py build` 校验入库。

---

## 提取更多科目

原始提取脚本在会话 scratchpad 中运行过，核心逻辑：解开 .pages（zip）→ Index/*.iwa 按 `0x00+3字节长度` 分块 snappy 解压 → 正则抽取 UTF-8 文本。若要重新提取或提取新文件，让 Claude 参照本段说明重写脚本即可。当前提取覆盖约 1071 道题（QM/FI/FSA/Equity/Ethics/PM/Derivatives 等）。
