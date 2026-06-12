# 战中结算过场动画（R21）

> 对应 DESIGN.md 路线图 R21。状态图例：⬜ / 🚧 / ✅ / ❌。全局进度表在 `DESIGN.md`。

## 1. 目标
通关 `win()` / 失败 `lose()` 当前直接弹出静态 `#overlay` 结算卡。R21 在弹卡**之前**插入一段 ~1.6s 的程序化过场动画，强化打赢/打输的情绪，然后再揭示结算卡（带入场动画）。零依赖、可点击跳过。

## 2. 表现设计
- **胜利（win）**：暗角渐入 → 居中金色光芒放射并旋转扩张 → 金色粒子上升 → 毛笔感「大捷 / 天下大势已定」标题缩放入场。暖金主调。
- **失败（lose）**：画面泛红压暗 → 斜向裂纹逐条绘出 → 底部烟尘上涌 → 「失守」标题带轻微抖动下坠。暗红主调。

## 3. 架构
- **绘制**：`sprites.js` 新增 `drawCutscene(ctx, w, h, type, p)`，`type ∈ {win, lose}`，`p` 为 0→1 归一化进度。纯程序化，绘制在战斗 canvas 上层（战斗场景的 `draw()` 末尾叠加）。
- **时序/状态**：`game.js`
  - `game.cutscene = { type, t, dur, payload, done }`，由 `startCutscene(type, payload)` 创建。
  - `loop(now)` 每帧推进 `cutscene.t += dt`（不受 `game.paused`/`game.over` 早退影响）；`t >= dur` 时调用 `finishCutscene()`：显示 `#overlay`（沿用既有 win/lose 文案/按钮逻辑，存于 payload），并加 `.cut-reveal` 入场动画类。
  - `draw()` 末尾：`if (game.cutscene && !game.cutscene.done) Art.drawCutscene(ctx,...,p)`。
  - **跳过**：cutscene 激活时，canvas 点击 / 任意结算相关键直接 `finishCutscene()`。
- **改动点**：`win()`/`lose()` 把「填充 overlay 文案 + 显示」拆成 `payload`，改为 `startCutscene('win'|'lose', payload)`；新增 `applyResultOverlay(payload)` 负责真正写入并显示 `#overlay`。

## 4. 文件改动
| 文件 | 改动 |
|---|---|
| sprites.js | `drawCutscene` + 导出 |
| game.js | cutscene 状态/时序/跳过；win/lose 重构为 payload + startCutscene/finishCutscene |
| style.css | `.cut-reveal` 结算卡入场动画 |

## 5. 验收标准
- 通关后先播金色胜利过场再出结算卡；失败后先播红色城破过场再出重试卡。
- 过场可点击跳过，直接出卡。
- 结算卡文案/按钮/碎片奖励逻辑与 R17/R19 完全一致（不回归）。
- 零 console 报错；`node --check` 通过。
