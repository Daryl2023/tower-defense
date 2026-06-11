# 内容扩充 V2：武将 / 关卡 / 图鉴详细页（R13 / R14 / R15）

> 对应需求：用户要求「再扩充 10 个蜀国武将」「再设计 10 个关卡」「图鉴加详细页」。
> 全程配置驱动（`data.js`→`GameData`）：加武将=HEROES+sprites 画法；加羁绊=BONDS；加关卡=LEVELS。新被动机制走现有 `passive` 派发框架，仅在派发器做最小扩展。

---

## R13 武将扩充：10 个蜀国武将

### 需求
武将池 8 → 18。新增武将复用既有属性体系（arch/rarity/dmgMul/rangeMul/rateMul/splash）与养成体系（升级/碎片/Lv3 被动）。被动尽量复用现有派发类型，必要时小幅扩展派发器。

### 武将表（全部 蜀）

| id | 武将 | 兵种 | 星 | 差异化倍率 | 被动（Lv3 解锁） | 派发类型 | 机制 |
|----|------|------|----|-----------|-----------------|---------|------|
| jiangwei | 姜维 | 谋 | ★★★ | dmg1.15, splash46 | 继志北伐：范围内友军攻速+18% | aura(新增 rateMul 维度) | 复用 aura |
| weiyan | 魏延 | 枪 | ★★ | dmg1.25 | 奇袭：命中永久削减目标护甲5 | onHit(新 armorBreak) | 新增 |
| fazheng | 法正 | 谋 | ★★★ | dmg1.15, splash44 | 鬼才：击杀额外得军粮6 | onKill(新 goldBonus) | 新增 |
| madai | 马岱 | 弓 | ★★ | dmg1.05, rate0.9 | 追斩：目标血量<18% 直接斩杀 | onHit(新 execute) | 新增 |
| guanping | 关平 | 弓 | ★ | — | 协同：范围内友军伤害+10% | aura(复用 dmgMul) | 复用 |
| guanxing | 关兴 | 枪 | ★★ | dmg1.15 | 将门虎子：18% 暴击(×1.9) | onHit(复用 crit) | 复用 |
| zhangbao | 张苞 | 枪 | ★★ | dmg1.15 | 虎啸：20% 眩晕0.8s | onHit(复用 stun) | 复用 |
| wangping | 王平 | 枪 | ★★ | dmg1.05, range1.1 | 无当飞军：范围内友军射程+15% | aura(新增 rangeMul 维度) | 复用 aura |
| liaohua | 廖化 | 枪 | ★ | — | 蜀汉老将：每波伤害+5%(最高+60%) | modifier(新 growthPerWave) | 新增 |
| huangyueying | 黄月英 | 谋 | ★★ | dmg0.8, splash52 | 机关阻滞：命中减速1.2s(×0.65) | onHit(复用 slow) | 复用 |

### 派发器扩展（game.js，最小改动）
- **aura 多维**（`recomputeBonds` aura 段）：把 `tw.auraMult` 拆为 `tw.auraDmg / tw.auraRate / tw.auraRange`，分别取范围内最高的 aura 源对应维度；`towerStats` 读这三者参与计算（dmg 乘 auraDmg、fireRate 除 auraRate、range 乘 auraRange）。光环可视化范围环对任意 aura 类型生效。
- **onHit armorBreak**（`resolveHit`）：命中后 `target.armor = Math.max(0, target.armor - armorBreak)`，永久生效（克制盾兵）。
- **onHit execute**（`resolveHit`）：主伤害结算后，若 `target.hp>0 && target.hp/target.maxHp <= execute`，直接置 0 并 `onEnemyKilled`（不斩 boss：`maxHp` 高于阈值的 siege 仍按比例，简单起见对所有敌人按血量比例，攻城车血厚自然难触发）。
- **onKill goldBonus**（`onEnemyKilled`）：击杀者被动含 goldBonus 时 `game.gold += goldBonus` + 飘字。
- **modifier growthPerWave**（`towerStats`）：伤害额外 ×`(1 + Math.min(growthMax, game.waveIndex*growthPerWave))`。

### 新增羁绊（BONDS）
| id | 名称 | 需武将 | 效果 |
|----|------|--------|------|
| guanmen | 关门虎子 | 关羽·关平·关兴 | 伤害+30% |
| huben | 虎贲双骁 | 关兴·张苞 | 伤害+20%、攻速+10% |
| chuanren | 武侯传人 | 诸葛亮·姜维 | 伤害+30% |
| jiguan | 机关连弩 | 诸葛亮·黄月英 | 伤害+25%、攻速+10% |

---

## R14 关卡扩充：10 个关卡（蜀汉战役线）

### 需求
关卡 6 → 16，延续蜀汉征战时间线，难度阶梯递增；混入盾兵/军医/攻城车比例渐升。每关 `shardRewards` 覆盖新武将，保证 10 个新将碎片均有稳定产出。

### 关卡表（7~16）
| # | 关卡 | gold/hp | 主要机制 | 碎片产出 |
|---|------|---------|----------|----------|
| 7 | 博望坡之战 | 320/18 | 初阵火攻 | 诸葛亮2·魏延2 |
| 8 | 火烧新野 | 330/18 | 盾兵增多 | 关平3·关兴2 |
| 9 | 江陵争夺 | 330/17 | 骑兵+盾兵 | 张苞3·赵云1 |
| 10 | 葭萌关·入川 | 340/17 | 军医登场 | 魏延2·法正2·马岱2 |
| 11 | 汉中之战 | 350/16 | 盾+医+攻城 | 法正2·黄忠2·马超1 |
| 12 | 七擒孟获 | 350/16 | 南蛮·医盾海 | 黄月英3·廖化2 |
| 13 | 街亭之战 | 350/15 | 高速骑兵潮 | 王平3·马岱2 |
| 14 | 陈仓鏖兵 | 360/15 | 攻城车阵 | 廖化3·魏延2 |
| 15 | 五丈原 | 360/14 | 全兵种混编 | 姜维2·黄月英2·诸葛亮1 |
| 16 | 剑阁天险 | 380/14 | 收官·最高强度 | 姜维3·关兴2·张苞2 |

### 数据约定
- `cells` 路径沿用轴向折线（每段仅 c 或 r 变化），起点贴左/上边、终点贴右边（c≈15），城池绘制于末点。
- 波次沿用既有量级，逐关递增波数(5→7)与每波密度；盾兵/军医/攻城车占比随关卡上升。
- HP 缩放沿用 `TUNING.hpScalePerWave`，不为新关单独加缩放。

### 平衡策略
- 不为 16 关逐一精调；以既有「固定强阵 0 漏怪、难度在经济 ramp」模型为基线，新关波量对齐 6 关后段。
- 抽测 2~3 关（页内无头模拟器）确认无死局；其余靠量级一致性保证可玩。

---

## R15 图鉴武将详细页

### 需求
现状：图鉴仅一行列表（头像+名+兵种+星+trait+招募费），信息太少。需点击武将进入**详细页**，展示完整属性与技能。

### 设计
- 新增遮罩 `#heroDetail`（复用 `.overlay`/`.overlay-card`），图鉴武将行 `cursor:pointer`，点击 `openHeroDetail(id)`；详细页「返回」回到图鉴。
- 展示内容：
  - 大头像（portrait，无图回退占位）+ 武将名 + 阵营/兵种 + 星级。
  - **属性**（基于 ARCHETYPES×差异化倍率×当前升级 Lv，Lv1 战斗形态、不含羁绊/光环）：射程、伤害、攻速(次/秒)、溅射半径(无则「单体」)、定位 trait。
  - **养成**：升级 Lv.x/5、专属碎片数。
  - **被动**：名称 + 完整描述 + 解锁状态（已解锁/Lv.3 解锁）。
  - **所属羁绊**：列出该武将参与的所有 BONDS（名称 + 需哪些武将 + 效果）。
- 纯渲染，数据全部来自 GameData + meta，无新存档字段。
- `computeHeroPreview(id)`：无需 tower 实例计算预览属性，复用 towerStats 的公式（rank 加成 + 差异化倍率），level 固定 1。

### 验收
- 图鉴点任一武将 → 弹详细页，属性/被动/羁绊正确；返回回图鉴。
- 升级某将后再看详细页，属性与 Lv 同步更新（读 meta 实时值）。

---

## 实现顺序
1. data.js：HEROES +10、BONDS +4、LEVELS +10。
2. sprites.js：ProceduralSprites +10。
3. game.js：派发器扩展（aura 多维 / armorBreak / execute / goldBonus / growth）。
4. index.html + style.css + game.js：详细页。
5. chrome-devtools 实测，回填 DESIGN.md 测试表。
