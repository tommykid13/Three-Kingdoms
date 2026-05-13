# 肥喵多尼的AI三国杀

浏览器版单人三国杀身份局原型：玩家控制 1 人，其余 7 人由 AI 控制。项目已部署到 Cloudflare Pages，适合在不同电脑上直接打开游玩。

线上地址：

https://feimiaoduoni-ai-sanguosha.pages.dev

## 当前版本

`v1.1.0`

### 1.1 更新

- 新增外部 AI 设置面板。
- 支持 Google Gemini、DeepSeek、GLM 三类 API 作为 AI 出牌阶段的决策来源。
- API Key 不写入仓库，默认只在当前浏览器会话中使用；勾选“在本机浏览器保存 API Key”后才会保存到本机 `localStorage`。
- 未启用外部 AI、未填写 API Key、API 调用失败或模型返回非法动作时，游戏会自动回退到本地规则 AI。
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

进入游戏后点击右上角 `AI 设置`。

可选供应商：

- Google Gemini，默认模型：`gemini-2.5-flash`
- DeepSeek，默认模型：`deepseek-v4-flash`
- GLM / Z.AI，默认模型：`glm-4.7-flash`
- 本地规则 AI

外部 AI 当前接入范围为 AI 角色的出牌阶段决策。判定、响应、濒死、技能结算等仍由本地规则引擎负责，以保证规则合法性和游戏不会因模型输出异常而中断。

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

这是浏览器静态项目。外部 AI 的 API Key 由玩家自己在浏览器里输入，不会提交到 Git 仓库。若供应商接口不允许浏览器跨域直连，页面会显示调用失败并回退到本地 AI。
