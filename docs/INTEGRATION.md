# 接入现有体系：Notion / TickTick / Claude

原则：工具管调度和数据，体系管习惯和问责。接入全部走"文本进出"，不引入新的服务依赖。

## TickTick（每日双待办）

`today` 的输出就是 checklist 格式。两种接法：

1. **手动（阶段0推荐）**：每晚跑 `python3 tool/cfa.py today`，把两行 `- [ ]` 贴进 TickTick 明日清单
2. **自动**：TickTick 支持邮件转任务（Settings → Email to Task）。crontab 每天 21:00 跑 today 并邮件发送：
   ```bash
   0 21 * * * cd ~/CFA && python3 tool/cfa.py today | mail -s "CFA今日待办" <你的TickTick转发地址>
   ```

督学规则（写进 TickTick 习惯打卡）：never miss twice；每次只承诺先做 1 题。

## Notion（周复盘 + 弱点看板）

- `stats` 输出是 Markdown，直接贴进 Notion 周复盘页即可渲染
- 建一个 `CFA 周复盘` 模板页，每周固定三栏：本周完成率（TickTick 数据）、🔴 LOS 清单（stats 输出）、下周动作（换挡阈值检查结果）
- 有 Notion MCP 的话，可以让 Claude 每周日自动跑 stats 并写入该页

## Claude（三个角色）

1. **出题工**：喂 Notes 片段 + `prompts/generate_questions.md` → 产出 `bank/*.json`。必须遵守 prompt 里的 ground truth 强制条款
2. **讲题人**：quiz 里错的题想追问，把题目 JSON 贴给 Claude 问"为什么我的直觉是错的"——比解析更贴个人误区
3. **画图师**：冲刺包阶段用 `prompts/frame_diagram.md` 按科目生成 HTML 框架图，存 `frames/` 目录，压缩期只刷图

## 数据流全景

```
Notes/正规题库 ──(Claude+prompt)──> bank/*.json ──sync──> state/cfa.db
                                                              │
        TickTick 明日清单 <──贴── today ──┤
        手机答题 <── html ── 结果串 ──> import ──┤
        Notion 周复盘 <──贴── stats <──────────┘
```

## 升级路径（习惯站稳后才做，触发条件：连续14天完成率>70%）

- SQLite → Supabase（DDL 直接复制），HTML 页改为直连读写，消灭"贴结果串"步骤
- 接 FSRS optimizer：`reviews` 表 ≥1000 条后导出，拟合个人参数替换 `fsrs_engine.py` 的 W
- 强问责（可选）：Beeminder 式金钱惩罚——TickTick 完成率对赌，或公开进度页给考友
