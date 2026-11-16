/* 技能特效系统：按属性绘制「蓄力 → 飞行 → 命中爆裂」的粒子动画。
 * 纯 Canvas 绘制，粒子位置由 index 确定性计算（不用逐帧 Math.random，避免闪烁）。 */
import type { ElementType } from './config';

export interface SkillFx {
  skillId: string;
  type: ElementType;   // 属性
  kind: 'dmg' | 'heal';
  fromX: number; fromY: number;  // 施法者位置（脚底附近）
  toX: number; toY: number;      // 目标位置
  t: number;                     // 已播放毫秒（由 startAt 实时计算）
  duration: number;              // 总时长
  power: number;                 // 技能威力，影响强度
  seq: number;                   // 递增序号，用于 UI 动画重播
  startAt: number;               // performance.now() 起始时间戳
}

const PALETTE: Record<string, { core: string; glow: string; spark: string }> = {
  fire:    { core: '#ff7a2f', glow: 'rgba(255,120,40,.55)',  spark: '#ffd25e' },
  water:   { core: '#3fa7f0', glow: 'rgba(70,170,245,.55)',  spark: '#bfe9ff' },
  wood:    { core: '#4fbf5a', glow: 'rgba(80,200,95,.5)',    spark: '#c7f08c' },
  thunder: { core: '#ffd23f', glow: 'rgba(255,220,70,.6)',   spark: '#fff6b0' },
  rock:    { core: '#9b8163', glow: 'rgba(150,125,95,.5)',   spark: '#d8c4a4' },
  wind:    { core: '#7fded6', glow: 'rgba(130,225,215,.5)',  spark: '#e2fffb' },
  normal:  { core: '#e6edf3', glow: 'rgba(210,225,240,.5)',  spark: '#ffffff' }
};

/** 确定性伪随机 [0,1)：由 index 与 salt 生成，逐帧稳定 */
function rnd(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, core: string, glow: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, core);
  g.addColorStop(0.45, glow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
}

/** 蓄力光环：施法者脚下的能量聚集 */
function drawCharge(ctx: CanvasRenderingContext2D, fx: SkillFx, p: number, pal: typeof PALETTE[string]) {
  const { fromX, fromY } = fx;
  const k = p / 0.2;
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.5 * k;
  ctx.shadowColor = pal.core; ctx.shadowBlur = 12;
  const r = 10 + 26 * k;
  ctx.strokeStyle = pal.core; ctx.lineWidth = 3 + k * 2;
  ctx.beginPath(); ctx.ellipse(fromX, fromY - 14, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + k * 2;
    const d = r * (0.75 + rnd(i) * 0.5);
    glowDot(ctx, fromX + Math.cos(a) * d, fromY - 14 + Math.sin(a) * d * 0.55, 3 + k * 3, pal.spark, pal.glow);
  }
  ctx.restore();
}

/** 命中爆裂：通用放射状冲击 + 属性粒子 */
function drawImpact(ctx: CanvasRenderingContext2D, fx: SkillFx, p: number, pal: typeof PALETTE[string]) {
  const { toX, toY } = fx;
  const k = (p - 0.62) / 0.38;               // 0..1
  const fade = Math.max(0, 1 - k);
  const cx = toX, cy = toY - 24;
  ctx.save();
  // 白色闪光
  ctx.shadowColor = pal.core; ctx.shadowBlur = 20;
  ctx.globalAlpha = fade;
  glowDot(ctx, cx, cy, 34 * (1 - k * 0.3), '#ffffff', pal.glow);
  // 双层冲击波环
  ctx.strokeStyle = pal.core; ctx.lineWidth = 4 * fade;
  ctx.beginPath(); ctx.arc(cx, cy, 14 + k * 62, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = pal.spark; ctx.lineWidth = 2 * fade;
  ctx.beginPath(); ctx.arc(cx, cy, 8 + k * 40, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(i, 9) * 0.5;
    const spd = 34 + rnd(i, 3) * 46 + fx.power * 0.15;
    const d = k * spd;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d - (fx.type === 'rock' ? k * k * 26 : 0);
    ctx.save();
    ctx.globalAlpha = fade * (0.65 + rnd(i, 5) * 0.35);
    drawElementParticle(ctx, fx.type, x, y, 3 + rnd(i, 7) * 3, a, k, pal);
    ctx.restore();
  }
}

/** 单个属性粒子形状 */
function drawElementParticle(ctx: CanvasRenderingContext2D, type: ElementType, x: number, y: number,
  r: number, angle: number, k: number, pal: typeof PALETTE[string]) {
  if (type === 'fire') {
    // 火苗：上尖下圆
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * r * 1.6, y + Math.sin(angle) * r * 1.6);
    ctx.quadraticCurveTo(x - r, y, x, y - r * 1.8);
    ctx.quadraticCurveTo(x + r, y, x + Math.cos(angle) * r * 1.6, y + Math.sin(angle) * r * 1.6);
    ctx.fill();
  } else if (type === 'thunder') {
    ctx.strokeStyle = pal.spark; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r * 0.2, y); ctx.lineTo(x - r * 0.4, y + r * 0.2);
    ctx.lineTo(x + r, y + r); ctx.stroke();
  } else if (type === 'rock') {
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    for (let v = 0; v < 6; v++) {
      const a = v / 6 * Math.PI * 2, rr = r * (0.7 + rnd(v, 11) * 0.6);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  } else if (type === 'wood') {
    ctx.fillStyle = pal.core;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 0.7, angle, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'wind') {
    ctx.strokeStyle = pal.spark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * 1.4, angle, angle + Math.PI * 1.1); ctx.stroke();
  } else if (type === 'water') {
    glowDot(ctx, x, y, r, pal.core, pal.glow);
  } else {
    glowDot(ctx, x, y, r, pal.spark, pal.glow);
  }
}

/** 飞行阶段：从施法者射向目标的一串属性粒子/轨迹 */
function drawTravel(ctx: CanvasRenderingContext2D, fx: SkillFx, p: number, pal: typeof PALETTE[string]) {
  const k = (p - 0.2) / 0.42;                 // 0..1
  const sx = fx.fromX, sy = fx.fromY - 22;
  const tx = fx.toX, ty = fx.toY - 24;
  const count = fx.type === 'wind' || fx.type === 'fire' ? 12 : 8;
  ctx.save();
  ctx.shadowColor = pal.core; ctx.shadowBlur = 14;
  for (let i = 0; i < count; i++) {
    const lag = i * 0.05;
    const kk = Math.max(0, Math.min(1, k - lag));
    const x = sx + (tx - sx) * kk;
    // 抛物线弧度
    const arc = -Math.sin(kk * Math.PI) * (fx.type === 'rock' ? 60 : 26);
    const y = sy + (ty - sy) * kk + arc + Math.sin(kk * 10 + i) * 5;
    const r = 5 + (i === 0 ? 6 : 0) + fx.power * 0.03;
    ctx.save();
    ctx.globalAlpha = kk <= 0 ? 0 : (i === 0 ? 1 : 0.7) * (1 - lag * 0.7);
    // 运动拖尾线：沿飞行方向拉出一段发光轨迹，静态帧也能看清动向
    if (kk > 0 && fx.type !== 'thunder') {
      const tail = 16 + r;
      const ang = Math.atan2(ty - sy, tx - sx);
      ctx.strokeStyle = pal.core; ctx.lineWidth = Math.max(1.5, r * 0.7);
      ctx.globalAlpha *= 0.5;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * tail, y - Math.sin(ang) * tail);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = kk <= 0 ? 0 : (i === 0 ? 1 : 0.7) * (1 - lag * 0.7);
    }
    if (fx.type === 'thunder') {
      // 电光：折线闪电
      ctx.strokeStyle = pal.spark; ctx.lineWidth = 2.5; ctx.shadowColor = pal.core; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let s = 0; s < 5; s++) {
        const lx = sx + (x - sx) * (s / 4);
        const ly = y + (s % 2 ? -6 : 6);
        s === 0 ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    } else {
      drawElementParticle(ctx, fx.type, x, y, r, Math.atan2(ty - sy, tx - sx), kk, pal);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** 治疗特效：上升的绿色光点 + 环绕光环 */
function drawHeal(ctx: CanvasRenderingContext2D, fx: SkillFx, p: number) {
  const cx = fx.fromX, cy = fx.fromY - 26;
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const life = (p + rnd(i, 2)) % 1;
    const x = cx + Math.sin(i * 2.4 + p * 3) * (16 + rnd(i, 4) * 18);
    const y = cy + 30 - life * 66;
    ctx.globalAlpha = Math.sin(life * Math.PI) * 0.9;
    glowDot(ctx, x, y, 3 + rnd(i, 6) * 2, '#dcffb0', 'rgba(120,220,110,.55)');
  }
  ctx.globalAlpha = Math.max(0, 1 - p) * 0.7;
  ctx.strokeStyle = '#8ef0a0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy + 30, 20 + p * 16, 8 + p * 6, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** 主入口：绘制一帧技能特效 */
export function drawSkillFx(ctx: CanvasRenderingContext2D, fx: SkillFx) {
  const p = Math.max(0, Math.min(1, fx.t / fx.duration));
  if (fx.kind === 'heal') { drawHeal(ctx, fx, p); return; }
  const pal = PALETTE[fx.type] || PALETTE.normal;
  if (p < 0.22) drawCharge(ctx, fx, p, pal);
  else if (p < 0.64) drawTravel(ctx, fx, p, pal);
  else drawImpact(ctx, fx, p, pal);
}
