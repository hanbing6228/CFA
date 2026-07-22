# CFA L2「低消耗通过」学习工具

目标不是学会，是**用最少消耗通过考试**。现状约束：读不进去、记不住、每天带宽 30–60 分钟。
整个工具围绕一条被证据最强支持的路径设计：**以题代读（检索练习）+ FSRS 间隔重复 + 考试日期感知调度 + 权重杠杆**。

## 5 分钟上手

```bash
# 1. 改考试日期 (config.json → exam_date, 当前是占位值 2026-11-20)
# 2. 初始化题库
python3 tool/cfa.py sync
# 3. 每天只做一件事: 看今日待办, 然后答题
python3 tool/cfa.py today   # 每日双待办: X道复习 + Y道新题 (墨墨模式, 零决策成本)
python3 tool/cfa.py quiz    # 终端答题, 错了看逐选项解析 (UWorld 模式)
```

手机流：`python3 tool/cfa.py html` 导出独立答题页 → 手机上做 → 结果串贴回 `python3 tool/cfa.py import '<串>'`。

## 全部命令

| 命令 | 干什么 | 对标机制 |
|---|---|---|
| `sync` | bank/*.json 题库 → 本地库 | — |
| `today` | 每日简报：复习量+新题量双待办、耗时预估、超预算警告 | 墨墨双待办 |
| `quiz` | 到期复习优先→新题额度；每选项讲透 | UWorld 解析模型 |
| `html` | 导出独立 HTML 答题页（手机离线可用） | 碎片时间微剂量 |
| `import` | 导入 HTML 答题结果 | — |
| `stats` | LOS 级弱点看板，🔴 标记需回炉的 LOS | UWorld/Achievable LOS 级追踪 |
| `plan` | 按考期倒排 Sprint 计划 + 放弃清单 + 换挡阈值 | 品职阶段化流水线 |

## 调度器的三个关键行为（相对 Anki 的核心优势）

1. **max interval = 距考天数**——每张卡考前保证至少再过一遍
2. **目标保留率自动爬坡**——考前 90 天从 0.80（just-pass 省时）爬到 0.88
3. **考前 14 天压缩模式**——自动停新题（防 burnout），区间再压缩

## 内容供给（工具只管调度，题从哪来）

- 种子题在 `bank/seed.json`（6 题示例，展示 schema 与逐选项解析标准）
- 扩题：把 Notes/正规题库内容喂给 Claude + `prompts/generate_questions.md`，产出 JSON 放进 `bank/`，`sync` 即入库
- ⚠️ **LLM 直接自造 L2 vignette 有实证准确性风险**（GPT-4 零样本 L2 仅 55.7–69.9%），所以 prompt 强制"必须给 ground truth 出处"；建议买 AnalystPrep（~$549 终身）做校验层
- 框架图：`prompts/frame_diagram.md`，压缩期只刷图（品职模式）

## 文档

- `docs/DESIGN.md` —— 需求调研 → 机制 → 模块的完整映射（为什么这么设计）
- `docs/INTEGRATION.md` —— 接入 Notion / TickTick / Claude 的具体做法
- `docs/PLAN.md` —— 倒排计划快照（用 `plan` 命令随时重新生成）

## 防跑偏纪律（写给未来的自己）

- **搭工具/美化工具超过 2 个周末 → 立即停手**。建工具本身变成拖延是技术型用户的头号失败模式
- never miss twice：断一天正常，绝不连断两天
- 每次只承诺做 1 题起步（micro-dose start），做完想停就停
