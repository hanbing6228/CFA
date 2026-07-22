# 设计文档：需求调研 → 机制 → 模块

本文把两轮调研（海外产品+学习科学、中国机构打法）落成本仓库的具体实现，并记录每个决策的依据。

## 四个核心问题 → 机制 → 代码位置

| 问题 | 采用的机制 | 依据 | 实现位置 |
|---|---|---|---|
| 读不进去 | 以题代读：3题→逐选项解析→下一个，跳过 curriculum | Roediger & Karpicke 2006（测试组读3.4次记61% vs 重读组读14.2次仅40%）；Dunlosky 2013 高效用榜单 | `quiz`/`html` 流程；`bank/` schema 强制每选项解析（UWorld 模型） |
| 记不住 | FSRS-4.5 逐题调度，LOS 为掌握度粒度 | FSRS benchmark：99.6% collection 上优于 SM-2，同保留率少 20–30% 复习 | `tool/fsrs_engine.py`；`stats` 的 LOS 看板（Achievable 逐 LOS 记忆建模） |
| 动力低 | 每日双待办零决策 + never miss twice + micro-dose start；不用 streak 硬约束 | 墨墨双待办；Duolingo streak 有厂商偏倚且对低动力用户产生 streak 焦虑 | `today` 命令；纪律写进 README/PLAN |
| 时间极少 | 新题额度 3/天封顶 + review_cap + 超预算自动警告 | AnKing 教训（>50新卡/天→400+复习/天→burnout）；30–60分钟预算 | `config.json` daily 段；`today` 的超预算提示 |

## 中国机构五件套 → 本仓库对应物

| 机构打法 | 本仓库 |
|---|---|
| 三层压缩（教材→Notes→框架图） | `prompts/frame_diagram.md`，压缩期只刷图 |
| 权重杠杆、公开放弃 | `config.json` tier A/B/C + 新题额度乘数（A=3x/B=1.5x/C=0.5x），`plan` 输出放弃清单 |
| 阶段化流水线+死线倒逼 | `plan` 命令：基础Sprint→百日冲刺→冲刺包→压缩期，全部由考期倒排 |
| 冲刺期百题+押题+模考 | 冲刺包阶段：mini-mock + 错因分类驱动额度（UWorld 错因四分类：概念/计算/陷阱/时间） |
| 督学 | 唯一无法完全自动化的环节。工具侧：`today` 接 TickTick/每日简报；人侧：建议找真人考友互相打卡 |

## 关键设计决策

### 1. 为什么 FSRS 内嵌实现而不是 pip 装 py-fsrs
零依赖 = 任何有 Python 3 的机器直接跑，不给"环境坏了"这个拖延借口。FSRS-4.5 公式和默认参数是公开稳定的（open-spaced-repetition），`fsrs_engine.py` 自带不变量自检。将来想用个人参数优化器（需 ≥1000 条复习记录），`reviews` 表的数据可直接导出喂给官方 optimizer。

### 2. 为什么 SQLite 而不是调研里说的 Supabase
阶段0 原则：1个周末能跑起来 > 架构完美。表结构（cards/reviews）就是普通 SQL，迁到 Supabase 是复制 DDL 的事。本地库还消灭了"没网不学"的借口。`state/` 已 gitignore——想跨设备就把 db 文件丢进网盘，或到时候再迁 Supabase。

### 3. 为什么掌握度粒度选 LOS 而不是 topic 或单题
topic 太粗（无法 strategic weighting 到点），单题太细（数据稀疏）。UWorld 和 Achievable 都收敛在 LOS 级。`stats` 按 LOS 聚合正确率，🔴 阈值 = 复习≥2次且<60%。

### 4. 为什么 desired retention 从 0.80 起步
目标是 just-pass。FSRS 下调 retention 直接减少复习频次；RemNote 经验是低于 ~0.70 反而更费时（重学成本超过省下的复习），所以下限护栏设在 0.78（换挡阈值里"下调0.02"最多执行一次）。考前 90 天线性爬坡到 0.88 保证考场状态。

### 5. 为什么评分是 答错=Again / 蒙对=Hard / 答对=Good / 秒杀=Easy
把 FSRS 四档映射到做题场景最自然的判断，答对后只需一次可选按键，摩擦最小。"蒙对"必须降档（Hard）——否则调度器会把靠运气的题当成已掌握，这是做题类 SRS 最常见的数据污染源。

### 6. 为什么 HTML 导出用"结果串贴回"而不是直接联网同步
独立 HTML = 手机浏览器打开即用，无服务器、无部署、无账号。结果串（JSON）复制回终端一条命令导入。这是"碎片时间答题"成本最低的实现；等习惯站稳（连续14天完成率>70%）再考虑升级成 Supabase + 网页版。

## 已知局限（诚实清单）

- 种子题只有 6 道，是 schema 示范不是题库。内容供给依赖 Claude 生成 + 正规题库校验（见 prompts/ 的 ground truth 强制要求）
- 单题形态 ≠ L2 vignette 形态。冲刺包阶段必须补真实 vignette mock（AnalystPrep/官方 LES），本工具管记忆不管应试形态训练
- FSRS 默认参数是全人群拟合，个人化要等 ≥1000 条复习记录
- 督学的强约束（真人盯、金钱惩罚）不在代码里，见 INTEGRATION.md 的 Beeminder 式替代方案
