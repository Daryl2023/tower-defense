# 名将 Boss + 武将解锁系统（R16 / R17）

> 对应需求：1) 设计「名将 Boss」——以三国名将为关底大敌，含特殊机制；2) 武将逐步获取——不再开局即拥有全部武将，改为碎片招募解锁。
> 原则：延续配置化（data.js）+ 被动派发框架；零依赖；双击 `index.html` 即玩。

---

## R16 名将 Boss

### 一、定位
- 在若干「关底」（里程碑关卡）的最后一波，加入一名**三国名将**作为 Boss：高血量、巨型形象、顶部专属血条、若干**特殊能力**。
- Boss 与普通敌人共用行军/索敌/受击管线，但**血量固定**（不随波次缩放），并由「能力引擎」驱动其特殊行为。
- 击败 Boss 额外掉落**关卡 featured 武将碎片**（见 R17），强化「打 Boss 换强将」的循环。

### 二、数据结构（data.js → `BOSSES`，导出）
每个 Boss：
```
id: { name, title, color, hp, speed, radius, armor, reward, shardBonus, castleDmg, abilities:[...] }
```
- `hp` 固定血量（不乘 `hpScalePerWave`）；`armor` 每次受击固定减伤（同盾兵，最低保留 1）。
- `reward` 击杀军粮；`shardBonus` 击杀额外给「本关 featured 武将」碎片数；`castleDmg` 破城伤害（较高）。
- `title` 显示在血条上的称号。

### 三、能力引擎（数据驱动，类比被动 type 派发）
`abilities` 为数组，每项 `{ type, ...params }`：

| type | 参数 | 行为 |
|------|------|------|
| `charge` | everySec, dur, speedMul | 周期性冲锋：dur 秒内速度 ×speedMul（伴随尘土粒子预警） |
| `rally` | everySec, summon, count | 周期性召唤：在 Boss 当前位置生成 count 个 summon 型援军，沿路前进 |
| `aura` | radius, speedMul?, armorBonus? | 常驻光环：范围内**其他敌人**获得加速 / 临时护甲（Boss 存活期间） |
| `enrage` | hpPct, speedMul?, dmgReduction? | 狂暴：血量低于 hpPct 时，永久获得加速 / 减伤 |
| `regen` | perSec | 每秒自愈（被压制时拉锯） |
| `resist` | control(0~1) | 抗控：受到的眩晕/减速**持续时间 ×control**（0 = 完全免疫） |

实现要点：
- 每帧先汇总存活 Boss 的 `aura`，对范围内其他敌人写入临时 `_auraSpeed/_auraArmor`（每帧清零重算）。
- `charge/rally/regen/enrage` 各自计时器/触发，状态写到 Boss 自身字段（`chargeUntil/chargeMul/_enraged/enrageSpeed/dmgReduction`）。
- 移动速度 = 基础 × 减速 × 冲锋倍率 × 狂暴倍率 × 光环加速。
- 受伤结算（`damageBy`）：护甲(自身+光环) → 狂暴减伤 → 扣血。
- 控制施加统一走 `applyStun/applySlow`，按 `controlResist` 缩放（含空城计、张飞/马超等被动）。

### 四、Boss 阵容与关卡分布（8 名将）
| 关卡(序号) | Boss | 称号 | 主要能力 |
|------|------|------|----------|
| 1 虎牢关 | 吕布 lvbu | 飞将 | 冲锋（入门 Boss，可被空城计控） |
| 3 赤壁 | 曹操 caocao | 魏武·挟天子 | 召唤骑兵 + 加速光环 |
| 5 定军山 | 夏侯渊 xiahouyuan | 虎步关右 | 高频冲锋（疾行） |
| 6 夷陵 | 陆逊 luxun | 火烧连营 | 狂暴 + 召唤步兵 |
| 8 火烧新野 | 曹仁 caoren | 铁壁 | 自愈 + 抗控（肉盾） |
| 13 街亭 | 张郃 zhanghe | 巧变·五子良将 | 冲锋 + 召唤骑兵 |
| 15 五丈原 | 司马懿 simayi | 冢虎 | 光环(加速+护甲) + 召唤盾兵 + 狂暴 |
| 16 剑阁 | 邓艾 dengai | 偷渡阴平 | 终boss：冲锋+召唤+狂暴+抗控 |

- 接入：在对应关卡**最后一波**的 group 数组追加 `{ boss:"id" }`。

### 五、渲染
- `sprites.js` 为每个 Boss 加 `"boss:id"` 程序化形象（复用 chibi 底座，深色甲胄 + 头盔/缨 + 武器，体型更大）。`buildAssetRegistry` 增加 BOSSES 注册，可后续替换为图片。
- 战斗内：Boss 形象更大、头顶名号；**屏幕顶部居中专属血条**（名号 + 称号 + 血量比例）。冲锋/召唤/狂暴触发时给粒子反馈。

---

## R17 武将解锁与碎片招募

### 一、起始武将（新增 4 个低品质 1★ + 主公）
开局**仅拥有 5 名武将**，其余 18 名全部锁定，需碎片招募：

| id | 武将 | 兵种 | 说明 | 被动(Lv.3) |
|----|------|------|------|-----------|
| liubei | 刘备 | 弓 | 主公（原有 1★） | 仁德光环 |
| zhoucang | 周仓 | 枪 | 扛刀力士·忠勇 | 力斩（弱暴击） |
| guansuo | 关索 | 弓 | 少年弓将 | 穿云（弱远距增伤） |
| dengzhi | 邓芝 | 谋 | 沉稳使者 | 斡旋（击杀+4粮） |
| chendao | 陈到 | 枪 | 白毦卫·坚毅 | 白毦（弱眩晕） |

- 起始武将数值偏低（1★，`dmgMul`≈0.9~1.05），被动为现有机制的弱化版（复用框架，零新代码）。设计意图：作为「过渡兵」，随招募强将逐步替换。
- `data.js` 导出 `STARTERS` 常量；新存档默认仅解锁 STARTERS。

### 二、碎片概率掉落（替换固定 shardRewards）
每次**通关**滚动掉落碎片，规则：
- 抽取次数 `draws = shardDrawsBase + floor(关卡序号 × shardDrawsPerLevel)`（约 5 → 14 递增）。
- 每次按**稀有度权重**加权随机一名武将 +1 碎片：复用 `RARITY.drawWeight`（1★=10 / 2★=5 / 3★=2）——**品质越低掉落概率越高**。
- 每关指定一名 **featured 武将**：抽取时附加 `featuredWeight` 权重，**该将掉率显著提升**；在选将界面/关卡介绍中注明「本关『X』碎片掉落提升」。
- 掉落覆盖**全部武将**（锁定者攒碎片以招募，已解锁者攒碎片以升级，碎片通用）。
- 击败关底 Boss 额外 `shardBonus` 枚 featured 碎片。

featured 分配（每关一名，写入 `LEVELS[i].featured`）：
1 关羽 · 2 张飞 · 3 诸葛亮 · 4 赵云 · 5 黄忠 · 6 关兴 · 7 魏延 · 8 关平 · 9 张苞 · 10 马岱 · 11 法正 · 12 黄月英 · 13 王平 · 14 廖化 · 15 姜维 · 16 马超

### 三、招募（解锁）
- 碎片招募成本（按稀有度，`TUNING.recruitShardCost`）：1★=6 / 2★=14 / 3★=26 枚专属碎片。
- 在**养成界面**：锁定武将显示「招募 (N 碎)」按钮（碎片足够才可点）；招募后该将解锁，等级置 Lv.1，转为正常「升级」流程（升级仍用 `rankCost`）。
- **图鉴 / 详细页**：锁定武将标注「未招募」+ 招募所需碎片；已解锁正常显示。
- **选将界面**：仅展示并允许选择**已解锁**武将。

### 四、弹性出战阵容（1~6）
- 阵容由「必须满 6」改为「**最多 6、至少 1**」：早期可用武将不足 6 时也能出战（如开局 5 将）。
- `normalizeDeck/defaultDeck` 只纳入已解锁武将，上限 6、不再强制补满；招贤池(`recruitPool`)随阵容（⊆已解锁）过滤。

### 五、存档
- `meta.unlocked = { id:true }` 持久化到 `sgtd_save_v1`（与 shards/ranks/deck 同存）。
- `loadSave` 容错：无 `unlocked` 字段时默认解锁 STARTERS。

---

## 改动文件
- `data.js`：新增 4 武将 + STARTERS + BOSSES(8) + 各关 featured + 末波 boss 接入 + TUNING 掉落/招募参数；导出 BOSSES/STARTERS。
- `sprites.js`：注册并绘制 4 新武将 + 8 Boss 形象。
- `game.js`：解锁/招募门控、概率掉落 `rollShardDrops`、弹性阵容、Boss 生成 + 能力引擎 + 控制抗性 + 血条渲染、养成/图鉴/详细页招募 UI。
- `style.css`：锁定灰显 + 招募按钮样式。

## 验收标准
- 新存档仅 5 将可用；图鉴/选将正确标注锁定；选将仅限已解锁。
- 通关碎片**概率**掉落，低稀有度更常见，featured 明显更多；Boss 击杀额外给 featured 碎片。
- 碎片足额可在养成界面招募解锁，之后可升级；存档持久。
- 阵容可 1~6 人出战。
- 8 关出现对应 Boss，顶部血条 + 大形象；各能力（冲锋/召唤/光环/狂暴/自愈/抗控）实测生效；Boss 可被集火 + 计谋击杀。
- L1（仅起始 5 将）可通关（含吕布），难度合理；全程零 console 报错。
