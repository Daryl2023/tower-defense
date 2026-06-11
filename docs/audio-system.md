# 音效与打击感系统（R12）

> 对应需求：为游戏加入音效与背景音乐，补足"完全没声音"的手感断层。
> 原则：**零依赖**——不引入任何音频文件，全部用 Web Audio API 程序化合成；保持双击 `index.html` 即玩。
> 可替换：仿 `sprites.js` 思路，提供 `SFX_ASSETS` 资源钩子，`url=null` 走程序化；将来填入音频文件路径即切换为采样播放，无需改调用点。

---

## 一、架构（新文件 `audio.js` → `window.Sfx`）

> 注意：不可用 `window.Audio`（浏览器内置构造器），命名空间用 `window.Sfx`。

- **AudioContext 懒加载 + 手势解锁**：浏览器自动播放策略要求首个 `AudioContext` 必须在用户手势后才能出声。首次 `pointerdown`/`keydown` 时 `Sfx.init()` 创建并 `resume()`；`Sfx.play()` 内若 ctx 仍 suspended 再尝试 resume。
- **三层增益**：`masterGain →（sfxGain / musicGain）`。静音切 masterGain；音乐独立调节。
- **节流与复音上限**：高频音效（开火）会被 16 塔狂刷——
  - 每个音效名设 `minGap`（如开火 70ms、击杀 50ms），间隔内的重复调用直接丢弃。
  - 全局活跃 voice 计数上限（约 12），超出丢弃，防止削波/爆音。
  - 每次受击不发声（太密），只在**击杀/暴击/斩杀**等关键事件发声。
- **静音持久化**：独立小键 `sgtd_audio`（`{muted}`），容错读取；与游戏存档解耦，不影响 `sgtd_save_v1`。

### 合成基元
- `tone(freq, dur, {type, gain, attack, decay, slideTo})`：振荡器 + ADSR 包络，可频率滑音。
- `noise(dur, {gain, filter, type})`：白噪声 buffer + 带通/低通，用于箭矢 whoosh、爆破、扣城闷响。
- `arp(freqs[], step, opts)`：琶音序列（招贤、升级、胜利）。

---

## 二、音效事件清单

| 事件 | 触发点(game.js) | 合成设计 | minGap |
|------|----------------|----------|--------|
| `ui` | 关键按钮点击 | 短方波 660Hz 0.05s | 40ms |
| `recruit` | drawRecruit | 上行琶音(招财感) | 120ms |
| `place` | 放置武将塔 | 低音拨弦 + 轻噪 | 80ms |
| `upgrade` | selectCandidate 升级 | 两音上行叮 | 80ms |
| `fire_archer` | 弓塔开火 | 高频短 tick + 噪声 whoosh | 70ms |
| `fire_spear` | 枪塔开火 | 金属低刺(方波下滑) | 70ms |
| `fire_strategist` | 谋士开火 | 下滑 zap(火球) | 80ms |
| `kill` | onEnemyKilled | 下行短音 + 噪声碎 | 50ms |
| `crit` | 暴击触发 | 明亮高音叮 | 60ms |
| `execute` | 马岱斩杀 | 锐利下劈(噪+低音) | 60ms |
| `skill_fire` | 火计 | 低 boom + 噪声爆裂 + 余烬 | — |
| `skill_fort` | 空城计 | 飘渺上扫(迷雾) | — |
| `castle_hit` | reachCastle 扣城 | 不谐低闷响 | 60ms |
| `wave_start` | startNextWave | 战鼓/号角双低音 | — |
| `win` | win() | 五声音阶上行凯旋琶音 | — |
| `lose` | lose() | 下行黯淡三音 | — |

---

## 三、背景音乐（BGM）

- 轻量**程序化循环**：用 lookahead 调度器（`setInterval` 25ms 前瞻 + AudioContext 精确 `start(time)`）排程一段**五声音阶（宫调）古风动机**：稀疏贝斯 + 偶发主旋音 + 柔和衬底，低音量循环。
- **生命周期**：进入战斗（confirmDeck）启动；返回菜单 / 胜负结算 停止；暂停时压低音量（duck）。
- 受静音开关统一控制（masterGain）。BGM 也走 `SFX_ASSETS` 同款可替换：将来可替换为整段音乐文件。

---

## 四、开关 UI
- HUD 加一个 🔊/🔇 按钮（复用 `.btn-sm`）：切换全局静音，状态写入 `sgtd_audio`，重载保持。
- 默认开启（首次手势后出声）。

---

## 五、验收标准
- 加载零报错；首次点击后 `AudioContext.state === "running"`。
- 各 `Sfx.play(name)` 不抛错、正确建节点；节流生效（间隔内重复调用被丢弃）；全局 voice 上限生效。
- BGM 进战启动、菜单/胜负停止；静音按钮切换并持久化。
- 实战触发链（开火/击杀/计谋/扣城/波次/胜负）零 console 报错。
- 说明：音频**输出**无法经 MCP 捕获，以"代码路径断言 + 节点创建 + 状态校验"验证，辅以人工试听确认听感。

---

## 六、改动文件
- 新增 `audio.js`（引擎，`window.Sfx`）。
- `index.html`：引入 `<script src="audio.js">`（在 game.js 前）+ HUD 静音按钮。
- `game.js`：各触发点调用 `Sfx.play`；首次手势 `Sfx.init`；进战/退战控制 BGM；按钮 toggle。
- `style.css`：静音按钮（可复用现有 `.btn-sm`，必要时微调）。
