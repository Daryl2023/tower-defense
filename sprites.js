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
  for (const t of ["infantry", "cavalry", "siege"]) SPRITE_ASSETS["enemy:" + t] = { img: null, _image: null, _ready: false };
})();

function preloadSprites() {
  for (const id in SPRITE_ASSETS) {
    const a = SPRITE_ASSETS[id];
    if (!a.img) continue;
    const im = new Image();
    im.onload = () => { a._image = im; a._ready = true; };
    im.onerror = () => { a._ready = false; }; // 失败兜底→程序化
    im.src = a.img;
  }
}

// ---------- R6-A: 统一绘制入口 ----------
// opts: { size, angle, t, walk, flashAlpha, scale }
function drawSprite(ctx, id, x, y, opts = {}) {
  const a = SPRITE_ASSETS[id];
  const size = opts.size || 40;
  if (a && a._ready && a._image) {
    const s = size * (opts.scale || 1);
    ctx.drawImage(a._image, x - s / 2, y - s / 2, s, s);
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
window.Art = {
  SPRITE_ASSETS, preloadSprites, drawSprite,
  emitParticles, updateParticles, drawParticles, clearParticles,
};
