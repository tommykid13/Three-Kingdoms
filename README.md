# 线上AI 三国杀

浏览器版单人三国杀身份局原型：玩家控制 1 人，其余 7 人由 AI 控制。项目已部署到 Cloudflare Pages，适合在不同电脑上直接打开游玩。

线上地址：

https://feimiaoduoni-ai-sanguosha.pages.dev

## 当前版本

`v2.6.0`

### 2.6 定版

- 修复刘禅【放权】时机：发动放权后不能再出牌，开始出牌后本回合不能再发动放权。
- 【放权】改为只在出牌阶段开始时询问，不再作为普通出牌阶段技能按钮绕过时机。
- 项目标题改为 `线上AI 三国杀`，网页右下角增加 `肥喵多尼制作` 署名。

### 2.5 定版

- 42 张武将图完成清爽化重绘后的边距统一处理，修正吕布、孙尚香、小乔等卡框在画布内显得偏小的问题。
- 新增武将图边距规范化脚本：`npm run art:generals:normalize-margins`，只统一卡牌有效区域和左右黑边，不额外贴名牌、不改卡面文字。
- 保留 2.1 已确认的明亮、干净、通透卡牌画风，并完成 Cloudflare Pages 发布校验。

### 2.1 美术更新

- 已确认 2.1 武将重绘方向：参考 `wujiang/曹操.png` 和 `docs/art-references/approved-general-style-v2.1.png`，走清爽、明亮、干净、通透的高级卡牌画风。
- 已将 42 张可用武将图按 2.1 方向批量替换到游戏资源，并保留批次预览和总览校验图。
- 新增武将图清爽化批处理管线：`npm run art:generals:preview` 生成预览，`npm run art:generals:apply` 可生成临时清洁版展示素材。
- 以 `Comic/` 原始武将图为源，输出到 `public/assets/generals/`，保留原始构图、人物、场景和卡牌结构。
- 当前默认 `clean` 档只作为过渡方案；最终目标是重绘，不是简单调亮、调对比或磨皮。
- 新增重绘提示词管线：`npm run art:generals:redraw-prompts`，以 `wujiang/曹操.png` 为清爽高级卡牌风格参考，为 42 名武将生成独立重绘提示词。
- 每名武将都有单独人物 DNA 约束，覆盖年龄、脸型、体型、发型胡须、服饰、姿态和场景符号，避免重绘时出现撞脸。
- 新增武将图导入脚本：`npm run art:generals:apply-sheet`，用于裁切批量样张并替换游戏武将图。武将名保留生成图原生卡面，不再额外贴名牌。

### 2.0 定版

- 完成标准身份局核心闭环：锦囊、装备、距离、濒死、死亡奖惩、胜负判断和主要武将技能均已接入。
- 补齐大量玩家手动交互：主动技能点选、目标选择、响应窗口、改判、弃牌代价、技能转换牌和阶段跳过。
- 完善装备效果与响应链：八卦阵、贯石斧、青龙偃月刀、寒冰剑、雌雄双股剑、藤甲、白银狮子等关键装备按规则结算。
- 修复 2.0 封版前阻塞问题：强袭可弃武器发动，神速二只能在出牌阶段开始前选择发动，不能出完牌后补发动。
- 保留本地规则 AI 作为默认 fallback，外部 AI 仍通过 Cloudflare Function 安全转发。

### 1.1 更新

- 新增外部 AI 设置面板。
- 支持 Google Gemini、DeepSeek、GLM 三类 API 作为 AI 出牌阶段的决策来源。
- API Key 不写入仓库，也不会进入前端浏览器；统一放在 Cloudflare Pages 的环境变量 / Secret 中。
- 未启用外部 AI、服务端 Secret 未配置、API 调用失败或模型返回非法动作时，游戏会自动回退到本地规则 AI。
- 外部 AI 只能从游戏引擎生成的合法动作列表里选择，最终仍由本地规则引擎执行。

### 1.0 基础

- 8 人身份局：1 主公、2 忠臣、4 反贼、1 内奸。
- 玩家随机身份，开局从 42 名可用武将中随机 5 选 1。
- 标准包 + 军争篇 160 张牌。
- 支持基础牌、装备、距离、攻击范围、延时锦囊、普通锦囊、无懈响应、濒死求桃、死亡奖惩和胜负判断。
- 已接入 42 名武将的技能框架与主要交互。
- 支持出牌动画、目标连线、伤害飘字、武将图放大、判定区图标、装备/判定展示。

## 本地开发

```bash
npm install
npm run dev
```

默认本地地址：

```text
http://127.0.0.1:7001
```

生产构建：

```bash
npm run build
```

部署到 Cloudflare Pages：

```bash
npm run deploy:cloudflare
```

## 外部 AI 配置

进入游戏后点击右上角 `AI 设置`。前端只选择供应商、模型和超时时间，不输入 API Key。

可选供应商：

- Google Gemini，默认模型：`gemini-2.5-flash`
- DeepSeek，默认模型：`deepseek-v4-flash`
- GLM / Z.AI，默认模型：`glm-4.7-flash`
- 本地规则 AI

外部 AI 当前接入范围为 AI 角色的出牌阶段决策。判定、响应、濒死、技能结算等仍由本地规则引擎负责，以保证规则合法性和游戏不会因模型输出异常而中断。

### Cloudflare Secret

在 Cloudflare Pages 项目里配置下面任意需要的环境变量：

```text
GOOGLE_API_KEY 或 GEMINI_API_KEY
DEEPSEEK_API_KEY
GLM_API_KEY 或 ZAI_API_KEY
```

也可以使用 Wrangler 设置：

```bash
npx wrangler pages secret put GOOGLE_API_KEY --project-name feimiaoduoni-ai-sanguosha
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name feimiaoduoni-ai-sanguosha
npx wrangler pages secret put GLM_API_KEY --project-name feimiaoduoni-ai-sanguosha
```

## 数据与素材

- 武将池：42 名可用武将。
- 武将图片：`public/assets/generals/`
- 卡牌图片：`public/assets/cards/`
- 生成数据：`public/data/`
- 数据生成脚本：`scripts/generate-data.mjs`

## 技术栈

- Vite
- React
- TypeScript
- Cloudflare Pages
- Wrangler

## 注意

外部 AI 通过 Cloudflare Pages Function `/api/ai-decision` 转发，浏览器不会接触 API Key。没有配置 Secret 或供应商接口失败时，页面会显示调用失败并回退到本地 AI。
