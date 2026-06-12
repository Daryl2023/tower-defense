# 通关三选一增益 / 战役增益（R22）

> 对应 DESIGN.md 路线图 R22。状态图例：⬜ / 🚧 / ✅ / ❌。全局进度表在 `DESIGN.md`。

## 1. 目标与定位
为单局重置的塔防加入 Roguelite 纵深：在**一次连续征战（run）**中，每通一关（非最终关）从 **3 个增益里选 1 个**，增益**累加并带入后续关卡**；中途返回主界面则增益清空，下次征战重新积累。「越往后推、阵线越强」的滚雪球体验。

## 2. Run 生命周期
- **开新 run**：从关卡选择 / 主界面「继续」进入某关 → `game.runBuffs` 重置为初始。
- **延续 run**：结算「进军下一关」→ 保留 `runBuffs` 带入下一关。
- **结束 run**：返回主界面 / 最终通关 / 失败 → `runBuffs` 在下次进关时重置。

## 3. 增益池（BOONS，data.js）
每条增益 `{ id, name, desc, effect }`，`effect` 合并进 `runBuffs` 累加器。

| id | 名称 | 效果（effect） |
|---|---|---|
| dmg | 锋锐 | dmgMul +0.12（全员伤害） |
| rate | 疾战 | rateMul +0.12（攻速） |
| range | 远略 | rangeMul +0.12（射程） |
| gold | 屯粮 | goldStart +70（进关起始军粮） |
| greed | 取敌之资 | killGoldMul +0.20（击杀军粮） |
| wall | 固城 | hpBonus +6（城池上限） |
| thrift | 简募 | refreshCut +6（招贤起始刷新费下调，下限 10） |
| crit | 锐卒 | critChance +0.08（全员额外暴击，×1.8） |

`runBuffs` 初始：`{ dmgMul:1, rateMul:1, rangeMul:1, goldStart:0, killGoldMul:0, hpBonus:0, refreshCut:0, critChance:0 }`。每关三选一从池中**不重复**随机抽 3。

## 4. 接入点（game.js）
- `towerStats`：`damage *= runBuffs.dmgMul`；`range *= runBuffs.rangeMul`；`fireRate /= runBuffs.rateMul`。
- `startLevel`：`gold += runBuffs.goldStart`；`hp += runBuffs.hpBonus`；`refreshCost = max(10, base - runBuffs.refreshCut)`。
- `onEnemyKilled`：`reward = round(reward * (1 + runBuffs.killGoldMul))`。
- `resolveHit`：在被动暴击之外，叠加 `runBuffs.critChance`（命中时额外 roll，暴击 ×1.8）。
- 重置/延续：`enterLevel` 重置；`levelClear` 选完增益后 `startLevel(i+1)` 不重置。

## 5. UI
- 结算卡（`#overlay`）在 **levelClear** 模式下追加 `#boonRow`：3 张增益卡（名+效果），点击即应用并进军下一关。
- 最终通关 / 失败：不展示增益。
- 顶部 HUD 增益计数（可选）：`战役增益 ×N` 小标记，便于玩家感知累计。

## 6. 验收标准
- 连续征战每关三选一，增益累加并实测影响（伤害/攻速/射程/经济/城防/暴击/刷新费）。
- 返回主界面后再进关，增益清零。
- 最终关与失败不弹增益。
- `node --check` 通过；零 console 报错。
