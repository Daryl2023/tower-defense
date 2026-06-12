"use strict";

// ============================================================
// 美术系统（R6）：Sprite 抽象层 + 程序化形象 + 粒子特效
// 详见 docs/art-system.md。零依赖，挂载到 window 供 game.js 调用。
// ============================================================

// ---------- R6-A: 资源清单（替换入口）----------
// img 为 null 时走程序化绘制；填入图片路径后，预加载成功即自动切换。
// 资源清单自动从 GameData 生成：每个武将/敌人一条，img=null 走程序化。
// 替换图片：把对应 id 的 img 填成路径即可（见 docs/art-system.md §2）。
const SPRITE_ASSETS = {};
(function buildAssetRegistry() {
  const heroes = (window.GameData && window.GameData.HEROES) || {};
  for (const id in heroes) SPRITE_ASSETS["hero:" + id] = { img: null, _image: null, _ready: false };
  const enemies = (window.GameData && window.GameData.ENEMY_TYPES) || { infantry: 1, cavalry: 1, siege: 1 };
  for (const t in enemies) SPRITE_ASSETS["enemy:" + t] = { img: null, _image: null, _ready: false };
  const bosses = (window.GameData && window.GameData.BOSSES) || {};
  for (const id in bosses) SPRITE_ASSETS["boss:" + id] = { img: null, _image: null, _ready: false };
})();

// 图片资产覆盖（img=null 走程序化；可配精灵表 cols/rows/frameW/frameH + portrait）
const IMAGE_OVERRIDES = {
  "hero:guanyu": {
    img: "assets/heroes/guanyu/sheet.png",
    cols: 4, rows: 2, frameW: 724, frameH: 724,
    frameInset: 0.1,
    portrait: "assets/heroes/guanyu/portrait.png",
    icons: "assets/heroes/guanyu/icons.png",
  },
  "hero:liubei": {
    img: "assets/heroes/liubei/sheet.png",
    cols: 4, rows: 2, frameW: 364, frameH: 360,
    frameInset: 0.1,
    portrait: "assets/heroes/liubei/portrait.png",
    icons: "assets/heroes/liubei/icons.png",
  },
  "hero:zhangfei": {
    img: "assets/heroes/zhangfei/sheet.png",
    cols: 4, rows: 2, frameW: 724, frameH: 724,
    frameInset: 0.1,
    portrait: "assets/heroes/zhangfei/portrait.png",
    icons: "assets/heroes/zhangfei/icons.png",
  },
  "hero:zhugeliang": {
    img: "assets/heroes/zhugeliang/sheet.png",
    cols: 4, rows: 2, frameW: 344, frameH: 384, // 整表 16:9（1376×768）
    frameInset: 0.1,
    portrait: "assets/heroes/zhugeliang/portrait.png", // 3:4（896×1200）
    icons: "assets/heroes/zhugeliang/icons.png", // 16:9（1376×768）
  },
  "hero:zhaoyun": {
    img: "assets/heroes/zhaoyun/sheet.png",
    cols: 4, rows: 2, frameW: 364, frameH: 360, // 整表 1456×720
    frameInset: 0.1,
    portrait: "assets/heroes/zhaoyun/portrait.png",
    icons: "assets/heroes/zhaoyun/icons.png",
  },
};
(function applyImageOverrides() {
  for (const id in IMAGE_OVERRIDES) {
    if (!SPRITE_ASSETS[id]) continue;
    Object.assign(SPRITE_ASSETS[id], IMAGE_OVERRIDES[id]);
  }
})();

function loadImage(src, onOk, onErr) {
  const im = new Image();
  im.onload = () => onOk(im);
  im.onerror = onErr || (() => {});
  im.src = src;
}

// AI 生图常见假透明：棋盘格暗格~96、亮格~144 被画进像素；银甲/白袍通常 >=161
// 去除低饱和中性灰格（保留有色彩的盔甲/皮肤/特效）
function stripAICheckerboard(img, opts = {}) {
  const darkMax = opts.darkMax ?? 158;
  const whiteMin = opts.whiteMin ?? (opts.portrait ? 250 : 238);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (d[i + 3] === 0) continue;
    if (Math.abs(r - g) > 18 || Math.abs(g - b) > 18) continue;
    if ((r >= 85 && r <= darkMax) || r >= whiteMin) d[i + 3] = 0;
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

function finalizeSpriteImage(im, asset) {
  if (asset.stripBg === false) return im;
  return stripAICheckerboard(im, { portrait: !asset.cols });
}

function preloadSprites() {
  for (const id in SPRITE_ASSETS) {
    const a = SPRITE_ASSETS[id];
    if (a.img) {
      loadImage(a.img, (im) => {
        a._image = finalizeSpriteImage(im, a);
        a._ready = true;
      }, () => { a._ready = false; });
    }
    if (a.portrait) {
      loadImage(a.portrait, (im) => {
        a._portrait = finalizeSpriteImage(im, a);
        a._portraitReady = true;
      });
    }
  }
}

// 精灵表选帧：0待机 1跑 2~4攻击 5蹲防 6胜利 7受击
function pickSpriteFrame(a, opts) {
  const attack = opts.attack != null ? opts.attack : 1;
  if (attack < 1) {
    const t = 1 - attack;
    if (t < 0.34) return 2;
    if (t < 0.67) return 3;
    return 4;
  }
  return 0;
}

function getHeroPortrait(heroId) {
  const a = SPRITE_ASSETS["hero:" + heroId];
  return (a && a._portraitReady && a._portrait) ? a.portrait : null;
}

// ---------- R6-A: 统一绘制入口 ----------
// opts: { size, angle, t, walk, flashAlpha, scale }
function drawSprite(ctx, id, x, y, opts = {}) {
  const a = SPRITE_ASSETS[id];
  const size = opts.size || 40;
  if (a && a._ready && a._image) {
    const s = size * (opts.scale || 1);
    if (a.cols && a.rows) {
      const frame = pickSpriteFrame(a, opts);
      const col = frame % a.cols;
      const row = Math.floor(frame / a.cols);
      const fw = a.frameW || a._image.width / a.cols;
      const fh = a.frameH || a._image.height / a.rows;
      const inset = a.frameInset || 0;
      const sx = col * fw + fw * inset;
      const sy = row * fh + fh * inset;
      const sw = fw * (1 - 2 * inset);
      const sh = fh * (1 - 2 * inset);
      const aspect = sh / sw;
      const drawW = s;
      const drawH = s * aspect;
      ctx.drawImage(a._image, sx, sy, sw, sh, x - drawW / 2, y - drawH / 2, drawW, drawH);
    } else {
      ctx.drawImage(a._image, x - s / 2, y - s / 2, s, s);
    }
  } else {
    const fn = ProceduralSprites[id];
    if (fn) fn(ctx, x, y, size, opts);
  }
  // 命中白闪（对两种渲染都生效）
  if (opts.flashAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = opts.flashAlpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(x, y, size * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ---------- 绘制辅助 ----------
function circle(ctx, x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 通用 Q 版底座：圆身 + 大头，返回头部中心 y 供武将叠加特征
function drawChibiBase(ctx, x, y, size, bodyColor, skinColor) {
  const r = size * 0.5;
  // 身体（下半圆袍）
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.25, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
  // 头（大）
  const hy = y - r * 0.42;
  circle(ctx, x, hy, r * 0.6, skinColor || "#f0d8b8", "rgba(0,0,0,0.35)", 2);
  return { hy, r };
}

// Boss 帅旗：背后竖一杆带字号令旗，强化「名将」存在感
function bossBanner(ctx, x, y, size, flagColor, ch) {
  const r = size * 0.5;
  const px = x - r * 0.95, top = y - r * 1.55;
  ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, y + r * 0.6); ctx.stroke();
  ctx.fillStyle = flagColor; ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.5;
  roundRect(ctx, px, top, r * 0.95, r * 0.7, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e8d070"; ctx.font = "bold " + Math.round(r * 0.5) + "px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ch || "将", px + r * 0.48, top + r * 0.36);
  ctx.textBaseline = "alphabetic";
}

// ---------- R6-B: 武将程序化形象 ----------
const ProceduralSprites = {
  "hero:liubei"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#c8a04a");
    // 主公冠（金冠 + 双带）
    ctx.fillStyle = "#e8c84a";
    roundRect(ctx, x - r * 0.42, hy - r * 0.78, r * 0.84, r * 0.34, 3); ctx.fill();
    ctx.fillStyle = "#a07820";
    ctx.fillRect(x - r * 0.12, hy - r * 0.95, r * 0.24, r * 0.22);
    // 眼
    eyes(ctx, x, hy, r);
    // 双股剑（朝攻击方向）
    weapon(ctx, x, y, r, o, (cx, cy, ang) => {
      ctx.strokeStyle = "#dfe6ee"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * r * 1.1, cy + Math.sin(ang) * r * 1.1); ctx.stroke();
    });
  },
  "hero:guanyu"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#3f7a3a", "#e8a070"); // 红脸
    // 绿头巾
    ctx.fillStyle = "#2f5a2a";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.15, r * 0.62, Math.PI, 0); ctx.fill();
    eyes(ctx, x, hy, r);
    // 长髯
    ctx.fillStyle = "#2a1810";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, hy + r * 0.25);
    ctx.quadraticCurveTo(x, hy + r * 1.1, x + r * 0.3, hy + r * 0.25);
    ctx.fill();
    // 青龙偃月刀（大刀剪影）
    weapon(ctx, x, y, r, o, (cx, cy, ang) => {
      const ex = cx + Math.cos(ang) * r * 1.15, ey = cy + Math.sin(ang) * r * 1.15;
      ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      // 刀头
      ctx.fillStyle = "#cfe8d0";
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.35, ang - 1.2, ang + 0.6);
      ctx.lineTo(ex, ey); ctx.fill();
    });
  },
  "hero:zhangfei"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#2a2a30", "#d8a878");
    // 黑盔
    ctx.fillStyle = "#1a1a20";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#c83a3a"; ctx.fillRect(x - r * 0.08, hy - r * 0.9, r * 0.16, r * 0.3); // 红缨
    eyes(ctx, x, hy, r, true);
    // 虬髯
    ctx.fillStyle = "#15100c";
    ctx.beginPath(); ctx.arc(x, hy + r * 0.45, r * 0.4, 0, Math.PI); ctx.fill();
    // 丈八蛇矛（长枪 + 蛇头尖）
    weapon(ctx, x, y, r, o, (cx, cy, ang) => {
      const ex = cx + Math.cos(ang) * r * 1.3, ey = cy + Math.sin(ang) * r * 1.3;
      ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#dfe6ee";
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ang) * r * 0.25, ey + Math.sin(ang) * r * 0.25);
      ctx.lineTo(ex + Math.cos(ang + 2.4) * r * 0.18, ey + Math.sin(ang + 2.4) * r * 0.18);
      ctx.lineTo(ex + Math.cos(ang - 2.4) * r * 0.18, ey + Math.sin(ang - 2.4) * r * 0.18);
      ctx.fill();
    });
  },
  "hero:zhugeliang"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#e8e4d8");
    // 纶巾
    ctx.fillStyle = "#cfcabc";
    roundRect(ctx, x - r * 0.5, hy - r * 0.7, r, r * 0.4, 4); ctx.fill();
    eyes(ctx, x, hy, r);
    // 羽扇
    weapon(ctx, x, y, r, o, (cx, cy, ang) => {
      const ex = cx + Math.cos(ang) * r * 0.7, ey = cy + Math.sin(ang) * r * 0.7;
      ctx.strokeStyle = "#8a7a5a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#f4f0e4"; ctx.strokeStyle = "#c8baa0";
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.42, ang - 0.7, ang + 0.7); ctx.lineTo(ex, ey); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1; ctx.stroke();
    });
  },

  // ---------- R8-2: 新增武将 ----------
  "hero:machao"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#c0c0d0", "#e8c8a0"); // 银甲锦马超
    // 白银盔 + 白缨
    ctx.fillStyle = "#e8e8f0";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#f0f0f8"; ctx.fillRect(x - r * 0.07, hy - r * 0.95, r * 0.14, r * 0.32);
    eyes(ctx, x, hy, r);
    // 长枪（带小旗）
    weapon(ctx, x, y, r, o, (cx, cy, ang) => {
      const ex = cx + Math.cos(ang) * r * 1.25, ey = cy + Math.sin(ang) * r * 1.25;
      ctx.strokeStyle = "#8a8a9a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#dfe6ee";
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c83a3a"; // 红缨小旗
      ctx.fillRect(cx + Math.cos(ang) * r * 0.5, cy + Math.sin(ang) * r * 0.5 - r * 0.2, r * 0.18, r * 0.2);
    });
  },
  "hero:huangzhong"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#b87333", "#d8b088"); // 古铜老将
    // 武盔
    ctx.fillStyle = "#8a5a28";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.12, r * 0.62, Math.PI, 0); ctx.fill();
    eyes(ctx, x, hy, r);
    // 白须（老将）
    ctx.fillStyle = "#e8e8e0";
    ctx.beginPath(); ctx.arc(x, hy + r * 0.4, r * 0.36, 0, Math.PI); ctx.fill();
    // 大弓（拉满）
    weapon(ctx, x, y, r, o, (cx, cy, ang) => {
      const bx = cx + Math.cos(ang) * r * 0.5, by = cy + Math.sin(ang) * r * 0.5;
      ctx.strokeStyle = "#7a4a1a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by, r * 0.5, ang - 1.4, ang + 1.4); ctx.stroke();
      // 箭
      ctx.strokeStyle = "#dfe6ee"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx + Math.cos(ang) * r * 0.6, by + Math.sin(ang) * r * 0.6); ctx.stroke();
    });
  },
  "hero:pangtong"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#7a9a6a", "#e0c8a8"); // 凤雏
    // 素巾
    ctx.fillStyle = "#5a7a4a";
    roundRect(ctx, x - r * 0.5, hy - r * 0.7, r, r * 0.38, 4); ctx.fill();
    eyes(ctx, x, hy, r);
    // 短须
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath(); ctx.arc(x, hy + r * 0.42, r * 0.22, 0, Math.PI); ctx.fill();
    // 道经卷轴（范围控制）
    weapon(ctx, x, y, r, o, (cx, cy, ang) => {
      const ex = cx + Math.cos(ang) * r * 0.7, ey = cy + Math.sin(ang) * r * 0.7;
      ctx.fillStyle = "#e8dcc0";
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      roundRect(ctx, -r * 0.28, -r * 0.12, r * 0.56, r * 0.24, 3); ctx.fill();
      ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    });
  },
  "hero:zhaoyun"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#d8d8e8", "#e8c8a0"); // 白袍银甲
    // 银盔 + 白龙缨
    ctx.fillStyle = "#f0f0f8";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#a0c8e8"; ctx.fillRect(x - r * 0.07, hy - r * 0.98, r * 0.14, r * 0.34);
    eyes(ctx, x, hy, r);
    // 亮银枪（带光晕，常胜将军）
    weapon(ctx, x, y, r, o, (cx, cy, ang) => {
      const ex = cx + Math.cos(ang) * r * 1.3, ey = cy + Math.sin(ang) * r * 1.3;
      ctx.strokeStyle = "#cfcfe0"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "rgba(180,200,255,0.5)"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f0f4ff"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.12, 0, Math.PI * 2); ctx.fill();
    });
  },

  // ---------- R13: 武将扩充（+10 蜀将）----------
  "hero:jiangwei"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#5a6a8a", "#e8c8a0"); // 银蓝甲
    ctx.fillStyle = "#c8d0e0"; // 银盔
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#6a78a0"; ctx.fillRect(x - r * 0.07, hy - r * 0.95, r * 0.14, r * 0.34); // 蓝缨
    eyes(ctx, x, hy, r);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 长枪
      const ex = cx + Math.cos(ang) * r * 1.25, ey = cy + Math.sin(ang) * r * 1.25;
      ctx.strokeStyle = "#aab0c0"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#eef2ff"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.15, 0, Math.PI * 2); ctx.fill();
    });
  },
  "hero:weiyan"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#8a4a3a", "#d8a878"); // 暗红甲
    ctx.fillStyle = "#5a2a22"; // 角盔
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.6, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = "#c8b84a"; ctx.lineWidth = 2; // 金角
    ctx.beginPath(); ctx.moveTo(x - r * 0.4, hy - r * 0.5); ctx.lineTo(x - r * 0.55, hy - r * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.4, hy - r * 0.5); ctx.lineTo(x + r * 0.55, hy - r * 0.85); ctx.stroke();
    eyes(ctx, x, hy, r, true);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 大刀
      const ex = cx + Math.cos(ang) * r * 1.1, ey = cy + Math.sin(ang) * r * 1.1;
      ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#d0d8e0"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.3, ang - 1.1, ang + 0.5); ctx.lineTo(ex, ey); ctx.fill();
    });
  },
  "hero:fazheng"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#5a7682", "#e0c8a8"); // 青灰文士
    ctx.fillStyle = "#3a5662";
    roundRect(ctx, x - r * 0.5, hy - r * 0.72, r, r * 0.4, 4); ctx.fill(); // 文士巾
    eyes(ctx, x, hy, r);
    ctx.fillStyle = "#2a1a10"; ctx.beginPath(); ctx.arc(x, hy + r * 0.4, r * 0.2, 0, Math.PI); ctx.fill(); // 短须
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 谋卷
      const ex = cx + Math.cos(ang) * r * 0.7, ey = cy + Math.sin(ang) * r * 0.7;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = "#e8dcc0"; roundRect(ctx, -r * 0.26, -r * 0.12, r * 0.52, r * 0.24, 3); ctx.fill();
      ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    });
  },
  "hero:madai"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#9a8a5a", "#e0c098"); // 西凉土黄
    ctx.fillStyle = "#7a6a3a";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.12, r * 0.62, Math.PI, 0); ctx.fill(); // 战巾
    ctx.fillStyle = "#c83a3a"; ctx.fillRect(x - r * 0.5, hy - r * 0.2, r * 1.0, r * 0.12); // 红巾带
    eyes(ctx, x, hy, r, true);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 弩
      const bx = cx + Math.cos(ang) * r * 0.5, by = cy + Math.sin(ang) * r * 0.5;
      ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(bx - Math.cos(ang) * r * 0.3, by - Math.sin(ang) * r * 0.3); ctx.lineTo(bx + Math.cos(ang) * r * 0.5, by + Math.sin(ang) * r * 0.5); ctx.stroke();
      ctx.strokeStyle = "#cfd6de"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, r * 0.3, ang - 1.5, ang + 1.5); ctx.stroke();
    });
  },
  "hero:guanping"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#4a8a4a", "#f0d8b8"); // 绿袍少将
    ctx.fillStyle = "#2f5a2a";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.15, r * 0.6, Math.PI, 0); ctx.fill(); // 绿巾
    eyes(ctx, x, hy, r);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 弓
      const bx = cx + Math.cos(ang) * r * 0.5, by = cy + Math.sin(ang) * r * 0.5;
      ctx.strokeStyle = "#7a4a1a"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx, by, r * 0.46, ang - 1.3, ang + 1.3); ctx.stroke();
      ctx.strokeStyle = "#dfe6ee"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx + Math.cos(ang) * r * 0.55, by + Math.sin(ang) * r * 0.55); ctx.stroke();
    });
  },
  "hero:guanxing"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#3f7a3a", "#e8b890"); // 承父绿
    ctx.fillStyle = "#244a20";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.62, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#c8b84a"; ctx.fillRect(x - r * 0.06, hy - r * 0.88, r * 0.12, r * 0.28); // 金缨
    eyes(ctx, x, hy, r, true);
    ctx.fillStyle = "#2a1810"; ctx.beginPath(); ctx.arc(x, hy + r * 0.42, r * 0.18, 0, Math.PI); ctx.fill(); // 须
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 枪
      const ex = cx + Math.cos(ang) * r * 1.25, ey = cy + Math.sin(ang) * r * 1.25;
      ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#dfe6ee"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.14, 0, Math.PI * 2); ctx.fill();
    });
  },
  "hero:zhangbao"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#33333c", "#d8a878"); // 承父黑
    ctx.fillStyle = "#1a1a20";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#c83a3a"; ctx.fillRect(x - r * 0.08, hy - r * 0.9, r * 0.16, r * 0.3); // 红缨
    eyes(ctx, x, hy, r, true);
    ctx.fillStyle = "#15100c"; ctx.beginPath(); ctx.arc(x, hy + r * 0.45, r * 0.34, 0, Math.PI); ctx.fill(); // 虬髯
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 蛇矛
      const ex = cx + Math.cos(ang) * r * 1.3, ey = cy + Math.sin(ang) * r * 1.3;
      ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#dfe6ee";
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ang) * r * 0.22, ey + Math.sin(ang) * r * 0.22);
      ctx.lineTo(ex + Math.cos(ang + 2.4) * r * 0.16, ey + Math.sin(ang + 2.4) * r * 0.16);
      ctx.lineTo(ex + Math.cos(ang - 2.4) * r * 0.16, ey + Math.sin(ang - 2.4) * r * 0.16);
      ctx.fill();
    });
  },
  "hero:wangping"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#6a7a5a", "#e0c8a8"); // 橄榄军袍
    ctx.fillStyle = "#4a5a3a";
    roundRect(ctx, x - r * 0.5, hy - r * 0.7, r, r * 0.36, 4); ctx.fill(); // 抹额巾
    eyes(ctx, x, hy, r);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 朴刀
      const ex = cx + Math.cos(ang) * r * 1.15, ey = cy + Math.sin(ang) * r * 1.15;
      ctx.strokeStyle = "#5a4a2a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#cfd6de"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.24, ang - 0.9, ang + 0.4); ctx.lineTo(ex, ey); ctx.fill();
    });
  },
  "hero:liaohua"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#8a7a4a", "#d8b890"); // 旧土褐老兵
    ctx.fillStyle = "#6a5a30";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.12, r * 0.6, Math.PI, 0); ctx.fill(); // 旧盔
    eyes(ctx, x, hy, r);
    ctx.fillStyle = "#d8d8d0"; ctx.beginPath(); ctx.arc(x, hy + r * 0.42, r * 0.3, 0, Math.PI); ctx.fill(); // 花白须
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 旧刀
      const ex = cx + Math.cos(ang) * r * 1.05, ey = cy + Math.sin(ang) * r * 1.05;
      ctx.strokeStyle = "#5a4a2a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#b8c0c8"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.22, ang - 1.0, ang + 0.4); ctx.lineTo(ex, ey); ctx.fill();
    });
  },
  "hero:huangyueying"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#b89a6a", "#f0dcc0"); // 米黄·才女
    ctx.fillStyle = "#8a6a3a"; // 发髻
    circle(ctx, x - r * 0.3, hy - r * 0.5, r * 0.16, "#3a2a1a");
    circle(ctx, x + r * 0.3, hy - r * 0.5, r * 0.16, "#3a2a1a");
    ctx.fillStyle = "#d84a6a"; circle(ctx, x, hy - r * 0.62, r * 0.1, "#d84a6a"); // 红发饰
    eyes(ctx, x, hy, r);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 机关连弩
      const ex = cx + Math.cos(ang) * r * 0.7, ey = cy + Math.sin(ang) * r * 0.7;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = "#9a7a4a"; roundRect(ctx, -r * 0.28, -r * 0.14, r * 0.56, r * 0.28, 3); ctx.fill();
      ctx.fillStyle = "#5a4a2a"; ctx.fillRect(-r * 0.08, -r * 0.22, r * 0.16, r * 0.2); // 弩匣
      ctx.strokeStyle = "#cfd6de"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r * 0.28, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
      ctx.restore();
    });
  },

  // ---------- R17: 起始低品质武将 ----------
  "hero:zhoucang"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#6a5a3a", "#cf9f70"); // 黝黑力士
    ctx.fillStyle = "#3a2e1a"; // 头巾
    ctx.beginPath(); ctx.arc(x, hy - r * 0.12, r * 0.6, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#c83a3a"; ctx.fillRect(x - r * 0.5, hy - r * 0.2, r * 1.0, r * 0.1); // 红巾带
    eyes(ctx, x, hy, r, true);
    ctx.fillStyle = "#2a1810"; ctx.beginPath(); ctx.arc(x, hy + r * 0.42, r * 0.26, 0, Math.PI); ctx.fill(); // 络腮
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 扛刀（青龙刀次级）
      const ex = cx + Math.cos(ang) * r * 1.15, ey = cy + Math.sin(ang) * r * 1.15;
      ctx.strokeStyle = "#5a4326"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#b8c0c8"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.28, ang - 1.1, ang + 0.5); ctx.lineTo(ex, ey); ctx.fill();
    });
  },
  "hero:guansuo"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#5a9a6a", "#f0d8b8"); // 绿袍少年
    ctx.fillStyle = "#3a6a44";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.15, r * 0.58, Math.PI, 0); ctx.fill(); // 绿巾
    ctx.fillStyle = "#e8c84a"; ctx.fillRect(x - r * 0.05, hy - r * 0.82, r * 0.1, r * 0.22); // 小金缨
    eyes(ctx, x, hy, r);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 弓
      const bx = cx + Math.cos(ang) * r * 0.5, by = cy + Math.sin(ang) * r * 0.5;
      ctx.strokeStyle = "#7a4a1a"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx, by, r * 0.44, ang - 1.3, ang + 1.3); ctx.stroke();
      ctx.strokeStyle = "#dfe6ee"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx + Math.cos(ang) * r * 0.55, by + Math.sin(ang) * r * 0.55); ctx.stroke();
    });
  },
  "hero:dengzhi"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#5a7a7a", "#e0c8a8"); // 青灰使者
    ctx.fillStyle = "#3a5656";
    roundRect(ctx, x - r * 0.5, hy - r * 0.72, r, r * 0.4, 4); ctx.fill(); // 文士巾
    eyes(ctx, x, hy, r);
    ctx.fillStyle = "#2a1a10"; ctx.beginPath(); ctx.arc(x, hy + r * 0.4, r * 0.18, 0, Math.PI); ctx.fill(); // 短须
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 符节（使者）
      const ex = cx + Math.cos(ang) * r * 0.8, ey = cy + Math.sin(ang) * r * 0.8;
      ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#e8d070"; circle(ctx, ex, ey, r * 0.13, "#e8d070"); // 节旄
      ctx.fillStyle = "#c83a3a"; ctx.fillRect(ex - r * 0.04, ey - r * 0.28, r * 0.08, r * 0.18);
    });
  },
  "hero:chendao"(ctx, x, y, size, o) {
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#8a8a78", "#e8c8a0"); // 素白精兵
    ctx.fillStyle = "#cfd0c4"; // 白盔
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.62, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#f4f4ee"; ctx.fillRect(x - r * 0.07, hy - r * 0.98, r * 0.14, r * 0.36); // 白毦缨
    eyes(ctx, x, hy, r, true);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 长枪
      const ex = cx + Math.cos(ang) * r * 1.25, ey = cy + Math.sin(ang) * r * 1.25;
      ctx.strokeStyle = "#8a8478"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#eef0ea"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.14, 0, Math.PI * 2); ctx.fill();
    });
  },

  // ---------- R16: 名将 Boss（更大体型 + 帅旗 + 深甲）----------
  "boss:lvbu"(ctx, x, y, size, o) {
    bossBanner(ctx, x, y, size, "#7a1a1a", "吕");
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#b03a3a", "#e8b890");
    ctx.fillStyle = "#2a1a14"; // 束发冠
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI, 0); ctx.fill();
    // 雉鸡翎（飞将标志）
    ctx.strokeStyle = "#caa84a"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - r * 0.2, hy - r * 0.6); ctx.quadraticCurveTo(x - r * 0.7, hy - r * 1.3, x - r * 0.4, hy - r * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.2, hy - r * 0.6); ctx.quadraticCurveTo(x + r * 0.7, hy - r * 1.3, x + r * 0.4, hy - r * 1.5); ctx.stroke();
    eyes(ctx, x, hy, r, true);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 方天画戟
      const ex = cx + Math.cos(ang) * r * 1.5, ey = cy + Math.sin(ang) * r * 1.5;
      ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#dfe6ee"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.34, ang - 1.2, ang + 0.6); ctx.lineTo(ex, ey); ctx.fill();
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.22, ang + 1.4, ang + 2.6); ctx.lineTo(ex, ey); ctx.fill(); // 月牙侧枝
    });
  },
  "boss:caocao"(ctx, x, y, size, o) {
    bossBanner(ctx, x, y, size, "#1a2a4a", "曹");
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#3a4a7a", "#e8c8a0");
    ctx.fillStyle = "#cdb24a"; // 魏王金冠
    roundRect(ctx, x - r * 0.46, hy - r * 0.82, r * 0.92, r * 0.36, 3); ctx.fill();
    ctx.fillStyle = "#1a1a26"; ctx.fillRect(x - r * 0.1, hy - r * 1.0, r * 0.2, r * 0.22);
    eyes(ctx, x, hy, r, true);
    ctx.fillStyle = "#1a1208"; ctx.beginPath(); ctx.arc(x, hy + r * 0.42, r * 0.22, 0, Math.PI); ctx.fill();
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 倚天剑
      const ex = cx + Math.cos(ang) * r * 1.25, ey = cy + Math.sin(ang) * r * 1.25;
      ctx.strokeStyle = "#e8eef6"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = "#caa84a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(ang) * r * 0.18, cy - Math.sin(ang) * r * 0.18 - 4); ctx.lineTo(cx - Math.cos(ang) * r * 0.18, cy - Math.sin(ang) * r * 0.18 + 4); ctx.stroke();
    });
  },
  "boss:xiahouyuan"(ctx, x, y, size, o) {
    bossBanner(ctx, x, y, size, "#4a3416", "夏");
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#7a5a2a", "#e0c098");
    ctx.fillStyle = "#5a4018"; // 战盔
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#caa84a"; ctx.fillRect(x - r * 0.07, hy - r * 0.96, r * 0.14, r * 0.32);
    eyes(ctx, x, hy, r, true);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 大弓（疾射）
      const bx = cx + Math.cos(ang) * r * 0.55, by = cy + Math.sin(ang) * r * 0.55;
      ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(bx, by, r * 0.55, ang - 1.4, ang + 1.4); ctx.stroke();
      ctx.strokeStyle = "#dfe6ee"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx + Math.cos(ang) * r * 0.7, by + Math.sin(ang) * r * 0.7); ctx.stroke();
    });
  },
  "boss:luxun"(ctx, x, y, size, o) {
    bossBanner(ctx, x, y, size, "#7a3010", "陆");
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#c85a2a", "#f0d8b8"); // 火色书生
    ctx.fillStyle = "#9a3a14";
    roundRect(ctx, x - r * 0.5, hy - r * 0.74, r, r * 0.42, 4); ctx.fill(); // 文士巾
    eyes(ctx, x, hy, r);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 火把令旗
      const ex = cx + Math.cos(ang) * r * 0.85, ey = cy + Math.sin(ang) * r * 0.85;
      ctx.strokeStyle = "#5a3a1a"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#ff7a2a"; circle(ctx, ex, ey, r * 0.2, "#ff7a2a");
      ctx.fillStyle = "#ffd24a"; circle(ctx, ex, ey, r * 0.1, "#ffd24a");
    });
  },
  "boss:caoren"(ctx, x, y, size, o) {
    bossBanner(ctx, x, y, size, "#2a361e", "曹");
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#5a6a4a", "#e0c098");
    ctx.fillStyle = "#3a4630"; // 重盔
    ctx.beginPath(); ctx.arc(x, hy - r * 0.08, r * 0.66, Math.PI, 0); ctx.fill();
    eyes(ctx, x, hy, r, true);
    ctx.fillStyle = "#15100c"; ctx.beginPath(); ctx.arc(x, hy + r * 0.44, r * 0.28, 0, Math.PI); ctx.fill();
    // 大塔盾（铁壁）
    ctx.fillStyle = "#8a96a2"; ctx.strokeStyle = "#2a3038"; ctx.lineWidth = 3;
    roundRect(ctx, x - r * 1.05, y - r * 0.55, r * 0.5, r * 1.1, r * 0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#5a6670";
    for (const ny of [-r * 0.3, 0, r * 0.3]) circle(ctx, x - r * 0.8, y + ny, r * 0.07, "#5a6670");
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 短戟
      const ex = cx + Math.cos(ang) * r * 1.0, ey = cy + Math.sin(ang) * r * 1.0;
      ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#cfd6de"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.16, 0, Math.PI * 2); ctx.fill();
    });
  },
  "boss:zhanghe"(ctx, x, y, size, o) {
    bossBanner(ctx, x, y, size, "#4a3e16", "張");
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#8a7a3a", "#e8c8a0");
    ctx.fillStyle = "#6a5a26";
    ctx.beginPath(); ctx.arc(x, hy - r * 0.1, r * 0.64, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#caa84a"; ctx.fillRect(x - r * 0.06, hy - r * 0.92, r * 0.12, r * 0.3);
    eyes(ctx, x, hy, r, true);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 长枪（巧变）
      const ex = cx + Math.cos(ang) * r * 1.4, ey = cy + Math.sin(ang) * r * 1.4;
      ctx.strokeStyle = "#5a4326"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#eef2f6"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c83a3a"; ctx.fillRect(cx + Math.cos(ang) * r * 0.6, cy + Math.sin(ang) * r * 0.6 - r * 0.22, r * 0.2, r * 0.22);
    });
  },
  "boss:simayi"(ctx, x, y, size, o) {
    bossBanner(ctx, x, y, size, "#2a1e3e", "司");
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#4a3a6a", "#e0c8a8"); // 冢虎紫
    ctx.fillStyle = "#322650";
    roundRect(ctx, x - r * 0.5, hy - r * 0.76, r, r * 0.44, 4); ctx.fill(); // 谋士高冠
    ctx.fillStyle = "#caa84a"; ctx.fillRect(x - r * 0.5, hy - r * 0.4, r, r * 0.08);
    eyes(ctx, x, hy, r, true);
    ctx.fillStyle = "#16100c"; ctx.beginPath(); ctx.arc(x, hy + r * 0.42, r * 0.24, 0, Math.PI); ctx.fill();
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 持剑谋帅
      const ex = cx + Math.cos(ang) * r * 1.2, ey = cy + Math.sin(ang) * r * 1.2;
      ctx.strokeStyle = "#c9c2dd"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "rgba(150,120,210,0.5)"; circle(ctx, ex, ey, r * 0.18, "rgba(150,120,210,0.5)");
    });
  },
  "boss:dengai"(ctx, x, y, size, o) {
    bossBanner(ctx, x, y, size, "#3e1616", "鄧");
    const { hy, r } = drawChibiBase(ctx, x, y, size, "#6a3a3a", "#e0c098");
    ctx.fillStyle = "#4a2424"; // 玄铁盔
    ctx.beginPath(); ctx.arc(x, hy - r * 0.08, r * 0.66, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#caa84a"; ctx.fillRect(x - r * 0.08, hy - r * 1.0, r * 0.16, r * 0.34); // 金缨
    ctx.strokeStyle = "#caa84a"; ctx.lineWidth = 2; // 双角
    ctx.beginPath(); ctx.moveTo(x - r * 0.42, hy - r * 0.5); ctx.lineTo(x - r * 0.58, hy - r * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.42, hy - r * 0.5); ctx.lineTo(x + r * 0.58, hy - r * 0.9); ctx.stroke();
    eyes(ctx, x, hy, r, true);
    weapon(ctx, x, y, r, o, (cx, cy, ang) => { // 重刀
      const ex = cx + Math.cos(ang) * r * 1.35, ey = cy + Math.sin(ang) * r * 1.35;
      ctx.strokeStyle = "#2a1e1a"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#d0d8e0"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.36, ang - 1.1, ang + 0.5); ctx.lineTo(ex, ey); ctx.fill();
    });
  },

  // ---------- R6-C: 小兵 / Boss ----------
  "enemy:infantry"(ctx, x, y, size, o) {
    const r = size * 0.5;
    const bob = o.walk ? Math.sin(o.walk) * r * 0.06 : 0;
    // 身体
    circle(ctx, x, y + bob, r * 0.6, "#9a9080", "#1b1410", 2);
    // 头盔
    circle(ctx, x, y - r * 0.35 + bob, r * 0.34, "#7a7060", "#1b1410", 2);
    // 圆盾
    circle(ctx, x - r * 0.5, y + bob, r * 0.3, "#6a5a44", "#3a2e20", 2);
    // 短刀
    ctx.strokeStyle = "#cfd6de"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + r * 0.4, y + bob); ctx.lineTo(x + r * 0.7, y - r * 0.5 + bob); ctx.stroke();
  },
  "enemy:cavalry"(ctx, x, y, size, o) {
    const r = size * 0.5;
    const gallop = o.walk ? Math.sin(o.walk * 1.6) * r * 0.12 : 0;
    // 马身
    ctx.fillStyle = "#c8923a";
    roundRect(ctx, x - r * 0.7, y - r * 0.1, r * 1.4, r * 0.55, r * 0.2); ctx.fill();
    ctx.strokeStyle = "#1b1410"; ctx.lineWidth = 2; ctx.stroke();
    // 马腿（动）
    ctx.strokeStyle = "#8a6020"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.4); ctx.lineTo(x - r * 0.5 - gallop, y + r * 0.75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.5, y + r * 0.4); ctx.lineTo(x + r * 0.5 + gallop, y + r * 0.75); ctx.stroke();
    // 骑手
    circle(ctx, x, y - r * 0.45, r * 0.26, "#a06038", "#1b1410", 2);
    // 长枪
    ctx.strokeStyle = "#cfd6de"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - r * 0.4); ctx.lineTo(x + r * 0.9, y - r * 0.7); ctx.stroke();
  },
  "enemy:siege"(ctx, x, y, size, o) {
    const r = size * 0.5;
    // 车体
    ctx.fillStyle = "#8a5a3a";
    roundRect(ctx, x - r * 0.85, y - r * 0.6, r * 1.7, r * 1.1, 4); ctx.fill();
    ctx.strokeStyle = "#1b1410"; ctx.lineWidth = 3; ctx.stroke();
    // 木纹
    ctx.strokeStyle = "#6a401f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - r * 0.85, y); ctx.lineTo(x + r * 0.85, y); ctx.stroke();
    // 轮子（转动）
    const spin = o.walk || 0;
    for (const wx of [-r * 0.5, r * 0.5]) {
      circle(ctx, x + wx, y + r * 0.6, r * 0.26, "#3a2818", "#1b1410", 2);
      ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + wx + Math.cos(spin) * r * 0.2, y + r * 0.6 + Math.sin(spin) * r * 0.2);
      ctx.lineTo(x + wx - Math.cos(spin) * r * 0.2, y + r * 0.6 - Math.sin(spin) * r * 0.2);
      ctx.stroke();
    }
    // 撞角（前向尖）
    ctx.fillStyle = "#5a5a64";
    ctx.beginPath();
    ctx.moveTo(x + r * 0.85, y - r * 0.2);
    ctx.lineTo(x + r * 1.2, y);
    ctx.lineTo(x + r * 0.85, y + r * 0.2);
    ctx.fill();
  },
  "enemy:shield"(ctx, x, y, size, o) {
    const r = size * 0.5;
    const bob = o.walk ? Math.sin(o.walk) * r * 0.05 : 0;
    // 重甲身体
    circle(ctx, x, y + bob, r * 0.62, "#6a7682", "#1b1410", 2);
    // 头盔（带横盔脊）
    circle(ctx, x, y - r * 0.38 + bob, r * 0.34, "#566169", "#1b1410", 2);
    ctx.strokeStyle = "#3a444c"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.72 + bob); ctx.lineTo(x, y - r * 0.4 + bob); ctx.stroke();
    // 大塔盾（前置，铆钉）
    ctx.fillStyle = "#9aa6b2"; ctx.strokeStyle = "#3a444c"; ctx.lineWidth = 2.5;
    roundRect(ctx, x - r * 0.95, y - r * 0.5 + bob, r * 0.5, r, r * 0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#5a6670";
    for (const ny of [-r * 0.28, 0, r * 0.28]) circle(ctx, x - r * 0.7, y + ny + bob, r * 0.06, "#5a6670");
  },
  "enemy:healer"(ctx, x, y, size, o) {
    const r = size * 0.5;
    const bob = o.walk ? Math.sin(o.walk) * r * 0.06 : 0;
    const pulse = o.walk ? 0.85 + Math.sin(o.walk * 2) * 0.15 : 1;
    // 治疗光圈
    ctx.globalAlpha = 0.18 * pulse;
    circle(ctx, x, y + bob, r * 0.95, "#7fe0a0");
    ctx.globalAlpha = 1;
    // 道袍身体
    circle(ctx, x, y + bob, r * 0.56, "#cf6f7a", "#1b1410", 2);
    // 头巾
    circle(ctx, x, y - r * 0.36 + bob, r * 0.3, "#e8d8c0", "#1b1410", 2);
    // 药幡：竿 + 红底白十字旗
    ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + r * 0.55, y - r * 0.7 + bob); ctx.lineTo(x + r * 0.55, y + r * 0.5 + bob); ctx.stroke();
    ctx.fillStyle = "#d8424e"; ctx.strokeStyle = "#1b1410"; ctx.lineWidth = 1.5;
    roundRect(ctx, x + r * 0.55, y - r * 0.7 + bob, r * 0.5, r * 0.4, 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    const cx = x + r * 0.8, cy = y - r * 0.5 + bob;
    ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.12); ctx.lineTo(cx, cy + r * 0.12); ctx.moveTo(cx - r * 0.12, cy); ctx.lineTo(cx + r * 0.12, cy); ctx.stroke();
  },
};

// 眼睛
function eyes(ctx, x, hy, r, angry) {
  ctx.fillStyle = "#1b1410";
  const dy = hy - r * 0.02;
  if (angry) {
    ctx.lineWidth = 2; ctx.strokeStyle = "#1b1410";
    ctx.beginPath(); ctx.moveTo(x - r * 0.28, dy - r * 0.12); ctx.lineTo(x - r * 0.08, dy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r * 0.28, dy - r * 0.12); ctx.lineTo(x + r * 0.08, dy); ctx.stroke();
  }
  circle(ctx, x - r * 0.18, dy, r * 0.06, "#1b1410");
  circle(ctx, x + r * 0.18, dy, r * 0.06, "#1b1410");
}

// 武器：根据攻击动画把武器从待机角度挥向目标
function weapon(ctx, x, y, r, o, drawFn) {
  const ang = o.angle != null ? o.angle : -Math.PI / 2;
  // 攻击进度 0..1（0=刚开火，挥到位；1=回弹到待机）
  const swing = o.attack != null ? o.attack : 1;
  const cx = x, cy = y - r * 0.05;
  // 待机时武器略抬，攻击时朝向目标
  const idleAng = -Math.PI / 2 + Math.sin((o.t || 0) * 2) * 0.12;
  const useAng = swing < 1 ? lerpAng(ang, idleAng, swing) : idleAng;
  drawFn(cx, cy, useAng);
}
function lerpAng(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---------- R6-E: 粒子池 ----------
const PARTICLE_MAX = 300;
const particles = [];
function emitParticles(x, y, opts) {
  const n = opts.count || 8;
  for (let i = 0; i < n; i++) {
    if (particles.length >= PARTICLE_MAX) break;
    const ang = opts.angle != null ? opts.angle + (Math.random() - 0.5) * (opts.spread || 6.28)
                                    : Math.random() * Math.PI * 2;
    const spd = (opts.speed || 60) * (0.4 + Math.random() * 0.8);
    particles.push({
      x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: (opts.life || 0.5) * (0.6 + Math.random() * 0.6),
      max: opts.life || 0.5,
      size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
      color: opts.color || "#ffcc66",
      gravity: opts.gravity || 0,
    });
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life -= dt;
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
}
function drawParticles(ctx) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function clearParticles() { particles.length = 0; }

// ---------- 导出到全局 ----------
// ============================================================
// 主界面程序化背景（R19）：三国关隘暮色图
// 远山层叠 + 雾气 + 关隘城楼剪影 + 军旗 + 火把，轻动画（旗摆/火把闪/雾飘）。
// 静态层（天空/山/城楼）离屏缓存，仅动态层逐帧重绘。
// ============================================================
const _homeCache = { w: 0, h: 0, canvas: null };

// 确定性伪随机（避免 Math.random 让缓存层每次不同）
function _hashRand(n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }

function _buildHomeStatic(w, h) {
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const c = off.getContext("2d");
  // 天空：暮色渐变（顶部加深的靛蓝 → 暖橙地平线）
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1a1430");
  sky.addColorStop(0.28, "#2a1d2e");
  sky.addColorStop(0.5, "#5a2f2a");
  sky.addColorStop(0.72, "#8a4a2a");
  sky.addColorStop(1, "#c87a3a");
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  // 星点（仅上半部，越往上越多越亮）
  for (let i = 0; i < 90; i++) {
    const sx = _hashRand(i * 2.1) * w;
    const sy = _hashRand(i * 3.7) * h * 0.42;
    const a = (1 - sy / (h * 0.42)) * 0.7 * (0.4 + _hashRand(i * 5.3) * 0.6);
    c.fillStyle = "rgba(255,240,210," + a.toFixed(3) + ")";
    const r = _hashRand(i * 7.1) < 0.15 ? 1.6 : 0.9;
    c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
  }
  // 落日辉光
  const sunY = h * 0.66, sunX = w * 0.5;
  const halo = c.createRadialGradient(sunX, sunY, 8, sunX, sunY, h * 0.55);
  halo.addColorStop(0, "rgba(255,210,130,0.95)");
  halo.addColorStop(0.16, "rgba(255,170,90,0.55)");
  halo.addColorStop(0.42, "rgba(220,120,70,0.22)");
  halo.addColorStop(1, "rgba(255,150,80,0)");
  c.fillStyle = halo; c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,228,168,0.95)";
  c.beginPath(); c.arc(sunX, sunY, h * 0.072, 0, Math.PI * 2); c.fill();
  // 远山四层（越远越淡），向阳侧描一道暖色轮廓光
  const ranges = [
    { base: h * 0.58, amp: h * 0.07, col: "#7a4a40", step: 0.7, rim: "rgba(255,180,110,0.5)" },
    { base: h * 0.64, amp: h * 0.11, col: "#5e352f", step: 1.0, rim: "rgba(240,150,90,0.42)" },
    { base: h * 0.72, amp: h * 0.13, col: "#43241f", step: 1.35, rim: "rgba(210,120,70,0.32)" },
    { base: h * 0.82, amp: h * 0.10, col: "#2c1715", step: 1.75, rim: null },
  ];
  for (const rg of ranges) {
    const pts = [];
    for (let x = 0; x <= w; x += 6) {
      const y = rg.base
        + Math.sin(x * 0.006 * rg.step) * rg.amp
        + Math.sin(x * 0.017 * rg.step + 1.3) * rg.amp * 0.4
        + Math.sin(x * 0.041 * rg.step + 2.1) * rg.amp * 0.16;
      pts.push([x, y]);
    }
    c.fillStyle = rg.col;
    c.beginPath(); c.moveTo(0, h); c.lineTo(0, pts[0][1]);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.lineTo(w, h); c.closePath(); c.fill();
    // 轮廓光：山脊线上靠太阳一侧提亮
    if (rg.rim) {
      c.strokeStyle = rg.rim; c.lineWidth = 1.6;
      c.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const lit = 1 - Math.min(1, Math.abs(pts[i][0] - sunX) / (w * 0.5));
        if (lit < 0.15) { c.stroke(); c.beginPath(); continue; }
        if (i === 0 || c._broke) { c.moveTo(pts[i][0], pts[i][1]); }
        else c.lineTo(pts[i][0], pts[i][1]);
      }
      c.stroke();
    }
  }
  // 关隘城楼剪影（居中偏下，虎牢关意象）
  _drawGateTower(c, w * 0.5, h * 0.86, w * 0.46, h * 0.40, sunX);
  // 前景松树剪影（左右各一丛，最暗）
  _drawPines(c, w * 0.085, h * 0.97, h * 0.30, 0);
  _drawPines(c, w * 0.93, h * 0.99, h * 0.34, 7);
  return off;
}

// 前景松树丛剪影
function _drawPines(c, cx, baseY, hgt, seed) {
  c.fillStyle = "#140b0a";
  for (let k = 0; k < 3; k++) {
    const px = cx + (_hashRand(seed + k * 1.7) - 0.5) * hgt * 0.7;
    const ph = hgt * (0.7 + _hashRand(seed + k * 2.3) * 0.5);
    const pw = ph * 0.34;
    c.fillRect(px - pw * 0.06, baseY - ph * 0.25, pw * 0.12, ph * 0.25); // 树干
    for (let tier = 0; tier < 4; tier++) {
      const ty = baseY - ph * 0.18 - tier * ph * 0.2;
      const tw = pw * (1 - tier * 0.2);
      c.beginPath();
      c.moveTo(px, ty - ph * 0.26);
      c.lineTo(px - tw / 2, ty);
      c.lineTo(px + tw / 2, ty);
      c.closePath(); c.fill();
    }
  }
}

// 城楼剪影：城墙 + 雉堞 + 谯楼 + 拱门（sunX 用于受光面提亮）
function _drawGateTower(c, cx, baseY, ww, hh, sunX) {
  const wallTop = baseY - hh * 0.5;
  const x0 = cx - ww / 2, x1 = cx + ww / 2;
  c.fillStyle = "#241413";
  c.fillRect(x0, wallTop, ww, baseY - wallTop);
  // 砖缝横线（淡）
  c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 1;
  for (let yy = wallTop + 10; yy < baseY; yy += 14) {
    c.beginPath(); c.moveTo(x0, yy); c.lineTo(x1, yy); c.stroke();
  }
  // 受光顶边
  c.fillStyle = "rgba(255,170,100,0.18)";
  c.fillRect(x0, wallTop, ww, 3);
  // 雉堞（垛口）
  const merlonW = ww / 18;
  c.fillStyle = "#1c0f0e";
  for (let i = 0; i < 18; i += 2) {
    c.fillRect(x0 + i * merlonW, wallTop - hh * 0.05, merlonW, hh * 0.05);
    c.fillStyle = "rgba(255,170,100,0.14)";
    c.fillRect(x0 + i * merlonW, wallTop - hh * 0.05, merlonW, 2);
    c.fillStyle = "#1c0f0e";
  }
  // 谯楼（城楼主体，居中）
  const tw = ww * 0.30, th = hh * 0.42;
  const tx = cx - tw / 2, ty = wallTop - th;
  c.fillStyle = "#2a1715";
  c.fillRect(tx, ty, tw, th);
  // 飞檐屋顶（梯形）+ 屋脊提亮
  c.fillStyle = "#3a201c";
  c.beginPath();
  c.moveTo(tx - tw * 0.18, ty);
  c.lineTo(tx + tw * 0.5, ty - th * 0.45);
  c.lineTo(tx + tw * 1.18, ty);
  c.closePath(); c.fill();
  c.strokeStyle = "rgba(255,180,110,0.3)"; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(tx - tw * 0.18, ty); c.lineTo(tx + tw * 0.5, ty - th * 0.45); c.stroke();
  c.fillStyle = "#2a1715"; c.fillRect(tx - tw * 0.18, ty - 2, 4, 6);
  c.fillRect(tx + tw * 1.14, ty - 2, 4, 6);
  // 拱门
  const gw = ww * 0.12, gh = hh * 0.34, gx = cx - gw / 2, gy = baseY - gh;
  c.fillStyle = "#0c0605";
  c.beginPath();
  c.moveTo(gx, baseY);
  c.lineTo(gx, gy + gw * 0.5);
  c.arc(cx, gy + gw * 0.5, gw / 2, Math.PI, 0);
  c.lineTo(gx + gw, baseY);
  c.closePath(); c.fill();
  // 城楼窗口微光（静态底光，动态层再叠闪烁）
  c.fillStyle = "rgba(255,180,90,0.45)";
  c.fillRect(cx - tw * 0.22, ty + th * 0.35, tw * 0.16, th * 0.3);
  c.fillRect(cx + tw * 0.06, ty + th * 0.35, tw * 0.16, th * 0.3);
}

// 飘扬军旗（动态）：旗杆 + 卷动旗面（贝塞尔上下缘）+ 帥字
function _drawBanner(c, x, baseY, hgt, t, flip) {
  const poleW = Math.max(3, hgt * 0.02);
  const dir = flip ? -1 : 1;
  c.fillStyle = "#1a0e0a";
  c.fillRect(x - poleW / 2, baseY - hgt, poleW, hgt);
  // 杆顶矛尖 + 缨穗
  c.fillStyle = "#c8a04a";
  c.beginPath(); c.moveTo(x, baseY - hgt - hgt * 0.07); c.lineTo(x - poleW, baseY - hgt); c.lineTo(x + poleW, baseY - hgt); c.closePath(); c.fill();
  c.fillStyle = "#b03a2a";
  c.beginPath(); c.arc(x, baseY - hgt, poleW * 1.2, 0, Math.PI * 2); c.fill();
  // 旗面：随时间整体卷动，用上下两条波动缘围成
  const fw = hgt * 0.52 * dir, fh = hgt * 0.40, top = baseY - hgt + hgt * 0.05;
  const seg = 14;
  const edge = (frac, rowOff) => {
    const px = x + fw * frac;
    const roll = Math.sin(t * 2.4 + frac * 5.0) * hgt * 0.05 * frac
               + Math.sin(t * 4.1 + frac * 9.0) * hgt * 0.02 * frac;
    return [px, top + fh * rowOff + roll];
  };
  // 旗面主体（深红）
  c.fillStyle = "#9a2b22";
  c.beginPath();
  let p = edge(0, 0); c.moveTo(p[0], p[1]);
  for (let i = 1; i <= seg; i++) { p = edge(i / seg, 0); c.lineTo(p[0], p[1]); }
  for (let i = seg; i >= 0; i--) { p = edge(i / seg, 0.95); c.lineTo(p[0], p[1]); }
  c.closePath(); c.fill();
  // 卷动高光（旗面波峰提亮）
  c.strokeStyle = "rgba(255,140,110,0.35)"; c.lineWidth = 2;
  c.beginPath();
  for (let i = 0; i <= seg; i++) { p = edge(i / seg, 0.48); if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); }
  c.stroke();
  // 旗缘金边
  c.strokeStyle = "rgba(200,160,74,0.6)"; c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i <= seg; i++) { p = edge(i / seg, 0.95); if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); }
  c.stroke();
  // 帥字（随旗微动）
  const cp = edge(0.5, 0.42);
  c.fillStyle = "#f0e0b0";
  c.font = "bold " + Math.round(hgt * 0.13) + "px serif";
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("帥", cp[0], cp[1]);
  c.textBaseline = "alphabetic";
}

// 火把（动态）：摇曳火焰 + 光晕 + 升腾余烬
function _drawTorch(c, x, baseY, t, seed) {
  c.fillStyle = "#1a0e0a"; c.fillRect(x - 2, baseY - 26, 4, 26);
  const flick = 0.7 + Math.sin(t * 9 + seed) * 0.18 + Math.sin(t * 17 + seed) * 0.12;
  const fy = baseY - 30, fr = 10 * flick;
  const glow = c.createRadialGradient(x, fy, 1, x, fy, fr * 4.5);
  glow.addColorStop(0, "rgba(255,190,90,0.5)");
  glow.addColorStop(1, "rgba(255,150,60,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(x, fy, fr * 4.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ff8a2a";
  c.beginPath(); c.ellipse(x, fy, fr * 0.6, fr, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ffd24a";
  c.beginPath(); c.ellipse(x, fy + 2, fr * 0.32, fr * 0.6, 0, 0, Math.PI * 2); c.fill();
  // 余烬：两点周期上升
  for (let k = 0; k < 2; k++) {
    const ph = (t * 0.7 + seed + k * 0.5) % 1;
    const ey = fy - ph * 34, ex = x + Math.sin((t * 3 + k * 2 + seed)) * 5;
    c.fillStyle = "rgba(255,180,80," + (0.7 * (1 - ph)).toFixed(3) + ")";
    c.beginPath(); c.arc(ex, ey, 1.6, 0, Math.PI * 2); c.fill();
  }
}

// 飞雁（动态）：一行人字雁，缓慢横越天空
function _drawGeese(c, w, h, time) {
  const span = w * 1.3;
  const gx = ((time * 16) % span) - w * 0.15; // 从左缓慢飞向右
  const gy = h * 0.22 + Math.sin(time * 0.3) * 6;
  const flap = Math.sin(time * 6);
  c.strokeStyle = "rgba(30,18,16,0.55)"; c.lineWidth = 2; c.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const rank = Math.ceil(i / 2);
    const bx = gx - rank * 16, by = gy + rank * 9 * (side > 0 ? 1 : 1);
    const ax = bx, ay = by;
    const wing = 6 + flap * 2.2;
    c.beginPath();
    c.moveTo(ax - 7, ay + (i % 2 ? wing : -wing) * 0.3 + wing);
    c.lineTo(ax, ay);
    c.lineTo(ax + 7, ay + (i % 2 ? -wing : wing) * 0.3 + wing);
    c.stroke();
  }
}

function drawHomeScene(ctx, w, h, time) {
  if (!_homeCache.canvas || _homeCache.w !== w || _homeCache.h !== h) {
    _homeCache.canvas = _buildHomeStatic(w, h);
    _homeCache.w = w; _homeCache.h = h;
  }
  ctx.drawImage(_homeCache.canvas, 0, 0);
  // 飘移云带（暖色薄云，两层不同速）
  for (let k = 0; k < 3; k++) {
    const cy = h * (0.30 + k * 0.10);
    const speed = 8 + k * 5;
    const cx = ((time * speed) % (w + 360)) - 180;
    const cg = ctx.createRadialGradient(cx, cy, 6, cx, cy, 170);
    const a = 0.12 - k * 0.025;
    cg.addColorStop(0, "rgba(240,180,130," + a + ")");
    cg.addColorStop(1, "rgba(240,180,130,0)");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(cx, cy, 170, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 90, cy + 8, 90, 18, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 飞雁
  _drawGeese(ctx, w, h, time);
  // 雾气带（横向飘移）
  const drift = (time * 14) % (w + 200);
  for (let k = 0; k < 2; k++) {
    const my = h * (0.62 + k * 0.12);
    const mg = ctx.createLinearGradient(0, my - 30, 0, my + 30);
    mg.addColorStop(0, "rgba(220,200,180,0)");
    mg.addColorStop(0.5, "rgba(220,200,180," + (0.11 - k * 0.03) + ")");
    mg.addColorStop(1, "rgba(220,200,180,0)");
    ctx.fillStyle = mg;
    ctx.save();
    ctx.translate(-100 + (k % 2 ? drift : -drift) * 0.3, 0);
    ctx.fillRect(0, my - 30, w + 200, 60);
    ctx.restore();
  }
  // 城楼窗口呼吸微光（叠在静态底光上）
  const winA = 0.25 + Math.sin(time * 2.3) * 0.12;
  const cx = w * 0.5, tw = w * 0.46 * 0.30, th = h * 0.40 * 0.42;
  const ty = h * 0.86 - h * 0.40 * 0.5 - th;
  ctx.fillStyle = "rgba(255,190,100," + winA.toFixed(3) + ")";
  ctx.fillRect(cx - tw * 0.22, ty + th * 0.35, tw * 0.16, th * 0.3);
  ctx.fillRect(cx + tw * 0.06, ty + th * 0.35, tw * 0.16, th * 0.3);
  // 军旗（左右）+ 火把
  _drawBanner(ctx, w * 0.16, h * 0.92, h * 0.42, time, false);
  _drawBanner(ctx, w * 0.84, h * 0.92, h * 0.42, time, true);
  _drawTorch(ctx, w * 0.30, h * 0.92, time, 1.7);
  _drawTorch(ctx, w * 0.70, h * 0.92, time, 4.2);
  // 底部压暗，承托 UI
  const vg = ctx.createLinearGradient(0, h * 0.55, 0, h);
  vg.addColorStop(0, "rgba(10,6,4,0)");
  vg.addColorStop(1, "rgba(10,6,4,0.66)");
  ctx.fillStyle = vg; ctx.fillRect(0, h * 0.55, w, h * 0.45);
}

// ============================================================
// 战中结算过场动画（R21）：胜利金光 / 失败城破，p 为 0→1 进度
// 绘制在战斗 canvas 上层，纯程序化。
// ============================================================
function _easeOut(p) { return 1 - Math.pow(1 - p, 3); }
function drawCutscene(ctx, w, h, type, p) {
  p = Math.max(0, Math.min(1, p));
  const cx = w / 2, cy = h * 0.42;
  if (type === "win") {
    // 暗角渐入
    ctx.fillStyle = "rgba(8,6,2," + (0.55 * Math.min(1, p * 2)).toFixed(3) + ")";
    ctx.fillRect(0, 0, w, h);
    // 旋转放射金光
    const rays = 18, rot = p * 1.4, reach = _easeOut(Math.min(1, p * 1.3)) * Math.hypot(w, h) * 0.6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < rays; i++) {
      const a = rot + (i / rays) * Math.PI * 2;
      ctx.fillStyle = "rgba(255,205,110," + (0.10 + 0.06 * Math.sin(p * 6 + i)).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.04) * reach, Math.sin(a - 0.04) * reach);
      ctx.lineTo(Math.cos(a + 0.04) * reach, Math.sin(a + 0.04) * reach);
      ctx.closePath(); ctx.fill();
    }
    // 中心光球
    const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, reach * 0.5);
    gr.addColorStop(0, "rgba(255,240,200," + (0.9 * p).toFixed(3) + ")");
    gr.addColorStop(0.3, "rgba(255,200,110," + (0.5 * p).toFixed(3) + ")");
    gr.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, reach * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 上升金色粒子（确定性）
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 28; i++) {
      const ph = (p * 1.2 + _hashRand(i * 3.1)) % 1;
      const px = cx + (_hashRand(i * 1.7) - 0.5) * w * 0.7;
      const py = cy + h * 0.3 - ph * h * 0.5;
      ctx.fillStyle = "rgba(255,215,130," + (0.8 * (1 - ph) * p).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(px, py, 2 + _hashRand(i * 5.3) * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    // 标题缩放入场
    const tp = Math.max(0, (p - 0.35) / 0.65);
    if (tp > 0) {
      const scale = 0.6 + _easeOut(tp) * 0.4;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(1, tp * 1.5);
      ctx.font = "bold " + Math.round(h * 0.11) + "px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(120,70,20,0.8)";
      ctx.strokeText("大 捷", 0, 0);
      const tg = ctx.createLinearGradient(0, -h * 0.06, 0, h * 0.06);
      tg.addColorStop(0, "#ffe9b0"); tg.addColorStop(1, "#e0a040");
      ctx.fillStyle = tg; ctx.fillText("大 捷", 0, 0);
      ctx.restore();
    }
  } else {
    // 失败：泛红压暗
    ctx.fillStyle = "rgba(40,6,4," + (0.6 * Math.min(1, p * 2)).toFixed(3) + ")";
    ctx.fillRect(0, 0, w, h);
    const red = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.hypot(w, h) * 0.6);
    red.addColorStop(0, "rgba(120,20,16," + (0.3 * p).toFixed(3) + ")");
    red.addColorStop(1, "rgba(60,8,6," + (0.5 * p).toFixed(3) + ")");
    ctx.fillStyle = red; ctx.fillRect(0, 0, w, h);
    // 斜向裂纹逐条绘出
    ctx.strokeStyle = "rgba(20,4,3,0.85)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    const cracks = 5;
    for (let i = 0; i < cracks; i++) {
      const cp = Math.max(0, Math.min(1, (p - i * 0.08) / 0.4));
      if (cp <= 0) continue;
      const bx = w * (0.2 + i * 0.16), by = -10;
      ctx.beginPath(); ctx.moveTo(bx, by);
      let x = bx, y = by;
      const segs = 9;
      for (let s = 1; s <= segs * cp; s++) {
        x += (_hashRand(i * 7 + s) - 0.35) * w * 0.05;
        y += h / segs;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 底部烟尘上涌
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 16; i++) {
      const ph = (p * 1.1 + _hashRand(i * 2.7)) % 1;
      const px = (_hashRand(i * 1.3)) * w;
      const py = h - ph * h * 0.4;
      const r = 20 + ph * 50;
      ctx.fillStyle = "rgba(40,30,26," + (0.22 * (1 - ph) * p).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    // 标题抖动下坠
    const tp = Math.max(0, (p - 0.3) / 0.7);
    if (tp > 0) {
      const drop = (1 - _easeOut(tp)) * -h * 0.08;
      const shake = (1 - tp) * Math.sin(p * 50) * 4;
      ctx.save();
      ctx.translate(cx + shake, cy + drop);
      ctx.globalAlpha = Math.min(1, tp * 1.5);
      ctx.font = "bold " + Math.round(h * 0.11) + "px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(20,2,2,0.9)";
      ctx.strokeText("关隘失守", 0, 0);
      ctx.fillStyle = "#d4503a"; ctx.fillText("关隘失守", 0, 0);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

window.Art = {
  SPRITE_ASSETS, IMAGE_OVERRIDES, preloadSprites, drawSprite, getHeroPortrait,
  emitParticles, updateParticles, drawParticles, clearParticles,
  drawHomeScene, drawCutscene,
};
