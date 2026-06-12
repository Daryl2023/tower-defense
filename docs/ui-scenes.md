# UI 场景化与主界面（R19）

> 对应 DESIGN.md 路线图 R19。状态图例：⬜ 待办 / 🚧 进行中 / ✅ 完成 / ❌ 失败
> 全局进度表仍集中在 `DESIGN.md`，本文档维护本模块详细设计。

## 1. 背景与目标

现状是**伪场景**：`#app` 内 HUD（`#hud`）+ 战场（`#stage`：canvas + 招贤馆）常驻，
主菜单 / 关卡选择 / 图鉴 / 养成 / 选将全部是盖在战场上的 `.overlay` 弹窗，靠
`game.overlayMode` + `.hidden` 切换。没有真正的「主界面」——菜单只是盖在空战场上的弹窗。

目标（用户决策）：
- **重度视觉**：主界面单独画一幅三国关隘程序化背景图（延续 sprites.js 路线，零依赖）。
- **全部独立场景**：养成、图鉴等从弹窗升级为独立全屏场景。
- **逐阶段验收**：分三期，每期跑通并实测后再进下一期。

## 2. 架构：场景状态机

新增 `game.scene` 状态与 `switchScene(name)`。每个场景是一个全屏 `<div class="scene">`，
互斥显隐（原生 DOM，不引路由/构建）。

| 场景 `scene` | 容器 id | 内容 | 来源 |
|---|---|---|---|
| `home` | `#sceneHome` | 重度背景 + 标题 + 主按钮 + 存档概览条 | **全新** |
| `levelSelect` | `#sceneLevels` | 分章关卡列表 | 从 `#overlay` 菜单态迁出 |
| `deck` | `#sceneDeck` | 选将网格（8 选 ≤6） | 从 `#deck` 弹窗迁入场景 |
| `battle` | `#sceneBattle` | HUD + canvas + 招贤馆 | 现有 `#hud` + `#stage` 打包 |
| `barracks` | `#sceneBarracks` | 武将养成（碎片升级/招募） | 从 `#train` 弹窗升级 |
| `codex` | `#sceneCodex` | 图鉴（武将/羁绊 + 详情子页） | 从 `#codex`/`#heroDetail` 弹窗升级 |

**战中弹窗保留**：开战提示 / 通关结算 / 失败重试仍用 `#overlay`（归入 battle 场景内），
它们是战场上下文反馈，不该升级为场景。

### 2.1 switchScene 契约
```
switchScene(name, opts)
  1. 隐藏全部 .scene
  2. 显示目标 #scene<Name>
  3. 记录 game.scene = name；维护返回目标（见 2.2）
  4. onEnter 钩子：渲染该场景内容 + 管理副作用
       - battle 外的场景：game.running=false
       - 进入 battle（confirmDeck）：game.running=true + Sfx.startMusic
       - 离开 battle：Sfx.stopMusic
```

### 2.2 返回导航
轻量「返回目标」约定（非完整栈）：
- `home → levelSelect → deck → battle`（前进链）
- `home → barracks`、`home → codex`（从主界面进，返回 home）
- `codex` 内 `heroDetail` 为子视图：在 codex 场景内显隐切换（不切场景），返回回到 codex 列表
- `levelSelect → barracks/codex`？不开放，养成/图鉴统一从 home 进，简化返回
- 战中「菜单」按钮：退出战斗 → `home`（停乐、清战斗态）

## 3. 重度主界面背景（程序化）

在 `sprites.js` 新增主界面绘制（与现有 ProceduralSprites 同路线，离屏可缓存）：
- `drawHomeScene(ctx, w, h, time)`：一帧三国关隘图
  - 远景：青绿山峦层叠（多层多边形 + 渐变），上方暮色/晨光天空渐变 + 雾气带
  - 中景：**关隘城楼**剪影（虎牢关意象，城墙 + 谯楼 + 雉堞）
  - 前景：左右**军旗**（飘扬「帥」字大旗）+ 火把光点
  - 轻动画（`time` 驱动，低开销）：旗帜摆动、火把明暗、雾气横向飘移
- 静态层（山/城楼）可一次性绘到离屏 canvas 缓存，仅动态层逐帧重绘，控开销。

主界面 DOM 叠在背景 canvas 之上：标题「三国塔防」、主按钮区、存档概览条。

## 4. 存档概览条（home）

读 `meta` / `game.maxUnlocked` 计算并展示（用户选定项）：
- **通关进度**：当前可挑战关所属章节 + 关序，如「第三章 · 南征北战　第 7/16 关」
- **武将解锁数**：`unlockedIds().length` / `Object.keys(HEROES).length`（X/22）
- **「继续」快捷入口**：一键 `enterLevel(game.maxUnlocked)` 直接进下一可挑战关的选将流程

（不展示碎片总量——用户明确排除。）

## 5. 分期与文件改动

| 期 | 任务 | 主要文件 | 验收点 |
|---|---|---|---|
| 一 | 场景骨架 | index.html / game.js / style.css | switchScene 通；关卡选择/选将/战场迁为场景；功能零丢失、零报错 |
| 二 | 主界面 | sprites.js / index.html / game.js / style.css | 程序化背景渲染；标题/按钮/概览条；继续入口可达 |
| 三 | 养成/图鉴场景化 | index.html / game.js / style.css | train/codex 从弹窗变场景；heroDetail 子视图；返回导航统一 |

### 风险与缓解
- **DOM 引用迁移面大**：`el` 表与监听集中在 game.js 顶部，逐场景迁移、`node --check` + MCP 回归每期跑一遍。
- **战中弹窗与场景边界**：明确 `#overlay` 只服务 battle 内的 intro/result/retry，菜单态从 overlay 彻底移除。
- **背景开销**：静态层离屏缓存，动态层最小化；主界面非战斗，不与游戏循环争帧。

## 6. 验收标准
- 双击 `index.html` 落地到 **home 主界面**（非战场弹窗）。
- 开始 → 关卡选择（分章可滚）→ 选将 → 战场，全链路场景切换无残留、无 console 报错。
- 养成、图鉴为独立全屏场景，返回逻辑一致。
- 主界面背景为三国关隘程序化图，含轻动画；概览条数据正确（进度/解锁数/继续）。
