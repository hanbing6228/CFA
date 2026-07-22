# CFA L2「低消耗通过」—— 手机版学习工具

目标不是学会，是**用最少消耗通过考试**。以题代读（检索练习）+ FSRS 间隔重复 + 考试日期感知调度 + 权重杠杆 + AI 督学。

## 📱 手机安装（一次性，1 分钟）

1. 手机浏览器打开 **https://examkiller-iota.vercel.app**（Vercel 已连本仓库，git push 自动部署）
2. Safari：分享 → 添加到主屏幕；Chrome：菜单 → 安装应用。之后像原生 App 一样从主屏幕打开，**离线可用**
3. App 设置里改考试日期 → 保存。开始用

若打开被要求登录 Vercel：去 vercel.com 项目 examkiller → Settings → Deployment Protection，把 Vercel Authentication 关掉。

日常就两步：打开 App → 点「开始 · 先做 1 题就算赢」。

## App 四个屏

| 屏 | 干什么 | 对标机制 |
|---|---|---|
| 今日 | 距考天数 + "X 到期复习 / Y 新题"双待办 + 一键开始 | 墨墨双待办，零决策成本 |
| 答题 | 一屏一题；点选项即时反馈；**每个选项点开看为什么对/错**；计算题**分步揭示**（公式→代入→结果→陷阱）；答错自动明天回炉；不懂一键复制追问 Claude | UWorld 逐选项解析的交互化 |
| 弱点 | LOS 级正确率看板，🔴 = 复习≥2次且<60%（调度器自动加频这些题） | UWorld/Achievable LOS 级追踪 |
| 设置 | 考期/额度/AI督学 token/备份导出导入 | — |

## 题库（96 题，全部经对抗性校验）

- FSA / Equity / FI 各 32 题（A 档三科，权重合计 30–45%），覆盖 71 个 LOS
- **权威性三重保证**：① 锚定 2026 官方课纲结构（`bank/los_map.json`，经全网校准：2026 权重与 45 个 LM 与 2025 一致）② 每题标注课纲出处 ③ 生成后由独立 agent 对抗性复核——calc 题不看解析从题干重算、干扰项验证"确实等于常见错误算法的结果"、概念题查歧义，96/96 通过（含 3 处修复）
- 扩题：`prompts/generate_questions.md`（生成）+ `prompts/import_bank.md`（从你自己的真题资料改编导入，1071 道已提取待用）
- 改完题库跑 `python3 tool/cfa.py build` 重新生成 `app/bank.json`，git push 即更新到手机

## 🤖 AI 督学（ADHD 适配）

闭环：**App 答题 → 进度自动回传仓库 `progress/` → AI 每晚检查 → 推送到手机**。

开启：GitHub → Settings → Developer settings → Fine-grained tokens → 新建（只勾本仓库、Contents 读写）→ 贴进 App 设置。之后：

- **每晚 21:00**（北京时间）AI 检查当天进度：做了→表扬+明日预告；没做→"只做 1 题就算赢"提醒；连续两天没做→never-miss-twice 强提醒
- **每周日晚** 弱点周报（🔴 LOS、换挡阈值检查）推送+邮件
- 原则：不羞辱、承诺单位是 1 题、只向前看。断一天不惩罚，绝不连断两天

## 调度器（FSRS-4.5 + 考期感知，相对 Anki 的优势）

1. 间隔封顶 = 距考天数——每张卡考前必再过一遍
2. 目标保留率考前 90 天从 0.80 自动爬坡至 0.88（just-pass 省时）
3. 考前 14 天压缩模式：自动停新题防 burnout
4. JS/Python 双实现，`python3 tool/parity_check.py` 保证逐位一致

## 桌面 CLI（备用入口，与 App 各自独立记录）

`python3 tool/cfa.py today|quiz|stats|plan|sync|build`。计划与放弃清单见 `docs/PLAN.md`（`plan` 命令随时重新生成）。

## 防跑偏纪律

- 搭工具/美化工具超过 2 个周末 → 立即停手
- never miss twice；每次只承诺 1 题起步
- 版权红线：`import/` 里的机构真题永不入库上网（已 gitignore），只作改编依据
