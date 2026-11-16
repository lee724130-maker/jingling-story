/* 精灵物语 · 改进版美术 + 动作效果：优先 AI 精灵贴图，未就绪回退程序化绘制 */
import { TYPES, TILE, MONSTERS, SPIRIT_CELL } from './config';
import { getSpiritSprite } from './spiritCanvas';

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function tri(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
}
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export function drawMap(ctx: CanvasRenderingContext2D, map: string[]) {
  for (let r = 0; r < map.length; r++) for (let c = 0; c < map[0].length; c++) {
    const ch = map[r][c], x = c * TILE, y = r * TILE;
    if (ch === '#') {
      ctx.fillStyle = '#1f6b46'; ctx.fillRect(x, y, TILE, TILE);
      circle(ctx, x + 10, y + 12, 10, '#2f8f5c'); circle(ctx, x + 22, y + 10, 11, '#38a568'); circle(ctx, x + 16, y + 20, 10, '#2c8557');
      circle(ctx, x + 12, y + 9, 3, '#5cc98b');
    } else if (ch === '~') {
      ctx.fillStyle = '#2b6fa8'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#3b86c4'; ctx.fillRect(x + 3, y + 8, 12, 2); ctx.fillRect(x + 16, y + 18, 13, 2); ctx.fillRect(x + 6, y + 25, 16, 2);
    } else if (ch === '=') {
      ctx.fillStyle = '#cbb58a'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#bda474'; ctx.fillRect(x, y, TILE, 2); ctx.fillRect(x, y + TILE - 2, TILE, 2);
    } else if (ch === 'H') {
      ctx.fillStyle = '#8f9aa6'; ctx.fillRect(x, y, TILE, TILE);
      rr(ctx, x + 7, y + 5, 18, 24, 3, '#d7e0ea');
      ctx.fillStyle = '#5fd0a6'; ctx.fillRect(x + 14, y + 10, 4, 14); ctx.fillRect(x + 10, y + 14, 12, 4);
    } else {
      ctx.fillStyle = '#7fc06a'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#6fb35c'; ctx.fillRect(x + 4, y + 6, 2, 5); ctx.fillRect(x + 20, y + 18, 2, 6); ctx.fillRect(x + 26, y + 7, 2, 4); ctx.fillRect(x + 12, y + 24, 2, 5);
    }
  }
}
export function isWalkable(ch: string) { return ch !== '#' && ch !== '~'; }

/** 训练师：走动摆臂 + 上下踏步，支持男女不同形象 */
export function drawTrainer(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, frame: number, gender: string, walking = false) {
  const step = walking ? Math.sin(frame * 1.6) : 0;
  const bob = walking ? Math.abs(Math.sin(frame * 1.6)) * 1.6 : (Math.floor(frame) % 2 === 0 ? 0 : 0.6);
  const py = y + bob;
  // 影子
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, py + 15, 8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  // 腿（走动交替）
  ctx.strokeStyle = '#2c3550'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 3, py + 8); ctx.lineTo(x - 3 + step * 2, py + 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 3, py + 8); ctx.lineTo(x + 3 - step * 2, py + 14); ctx.stroke();
  // 手臂（走动摆动）
  ctx.strokeStyle = '#f0c9a0'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x - 6, py - 1); ctx.lineTo(x - 8 - step * 2.4, py + 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 6, py - 1); ctx.lineTo(x + 8 + step * 2.4, py + 5); ctx.stroke();
  // 身体
  if (gender === 'female') {
    ctx.fillStyle = '#3a2b22'; ctx.beginPath(); ctx.arc(x, py - 8, 8, Math.PI, 0); ctx.fill();
    circle(ctx, x + 8, py - 12, 4, '#3a2b22');
    rr(ctx, x - 7, py - 2, 14, 12, 4, '#e2607c');
  } else {
    rr(ctx, x - 7, py - 2, 14, 12, 4, '#3a6ea5');
  }
  circle(ctx, x, py - 7, 7, '#f0c9a0');
  rr(ctx, x - 8, py - 13, 16, 5, 2, gender === 'male' ? '#e2604c' : '#f08aa0');
  // 眼睛（随朝向偏移）
  const ex = dir * 1.2;
  circle(ctx, x - 3 + ex, py - 7, 1.2, '#333'); circle(ctx, x + 3 + ex, py - 7, 1.2, '#333');
  ctx.restore();
}

/** 精灵：程序化绘制，支持浮动(呼吸)、攻击前冲、受击抖动、警戒跳 */
export interface MonsterMotion { bob?: number; lunge?: number; shake?: number; scale?: number; }
export function drawMonster(ctx: CanvasRenderingContext2D, speciesId: number, cx: number, cy: number, scale = 1, dir = 1, gender?: string, motion: MonsterMotion = {}) {
  const def = MONSTERS[speciesId]; if (!def) return;
  const col = TYPES[def.type].color, s = scale * (motion.scale || 1);
  const bx = cx + (motion.lunge || 0) + (motion.shake || 0);
  const by = cy + (motion.bob || 0);
  ctx.save(); ctx.translate(bx, by); ctx.scale(s, s); if (dir === -1) ctx.scale(-1, 1);
  // 影子（浮动时缩小）
  const lift = Math.max(0, -(motion.bob || 0));
  ctx.fillStyle = `rgba(0,0,0,${0.2 - lift * 0.006})`;
  ctx.beginPath(); ctx.ellipse(0, 14 + lift * 0.4, 11 - lift * 0.2, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  circle(ctx, 0, 0, 13, col); circle(ctx, -4, -3, 9, shade(col, 1.18));
  if (def.shape === 'flame') { tri(ctx, -7, -9, -3, -20, 1, -10, '#f2a13c'); tri(ctx, 3, -10, 9, -19, 11, -6, '#e8663c'); }
  else if (def.shape === 'bubble') { circle(ctx, 8, -10, 5, 'rgba(120,190,240,.7)'); circle(ctx, 11, -15, 3, 'rgba(120,190,240,.5)'); }
  else if (def.shape === 'leaf') { tri(ctx, -3, -10, -8, -22, 3, -12, '#4fb05a'); circle(ctx, 4, -14, 5, '#67c672'); }
  else if (def.shape === 'spark') { tri(ctx, -8, -8, -6, -20, 0, -10, '#f0d24b'); tri(ctx, 4, -10, 10, -20, 10, -6, '#f0d24b'); }
  else if (def.shape === 'rock') { rr(ctx, -11, -12, 22, 8, 3, shade(col, .8)); rr(ctx, -6, -18, 12, 8, 2, shade(col, .9)); }
  else if (def.shape === 'wind') { tri(ctx, -10, -4, -18, -12, -4, -8, '#a7e2de'); tri(ctx, 10, -4, 18, -12, 4, -8, '#a7e2de'); }
  circle(ctx, -5, -1, 2.4, '#fff'); circle(ctx, 5, -1, 2.4, '#fff');
  circle(ctx, -4.5, -1, 1.2, '#222'); circle(ctx, 5.5, -1, 1.2, '#222');
  ctx.strokeStyle = '#3a2b22'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 4, 3, 0.15, Math.PI - 0.15); ctx.stroke();
  if (gender === 'female') circle(ctx, 11, -12, 2.4, '#ff9ec4');
  ctx.restore();
}

/** 战斗精灵：优先用 AI 贴图（抠白底）绘制，带影子/浮动/前冲/抖动/缩放/翻转。
 *  贴图未就绪时自动回退程序化 drawMonster，保证任何时刻都有画面。 */
export function drawBattleSpirit(ctx: CanvasRenderingContext2D, speciesId: number, cx: number, cy: number,
  scale = 1, dir = 1, gender?: string, motion: MonsterMotion = {}) {
  const img = getSpiritSprite(speciesId);
  if (!img) return drawMonster(ctx, speciesId, cx, cy, scale, dir, gender, motion);

  const bx = cx + (motion.lunge || 0) + (motion.shake || 0);
  const by = cy + (motion.bob || 0);
  const s = scale * (motion.scale || 1);
  // AI 精灵正面朝向观者：dir=-1 时水平翻转
  const drawW = 96 * s, drawH = 96 * s;
  const lift = Math.max(0, -(motion.bob || 0));

  ctx.save();
  // 接地影子（浮起时变淡变小）
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.06, 0.24 - lift * 0.01)})`;
  ctx.beginPath();
  ctx.ellipse(bx, cy + 44 * s, (30 - lift * 0.5) * s, (8 - lift * 0.1) * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // 贴图本体：以脚底为基准对齐到 cy+44s，向上绘制
  ctx.translate(bx, by + 44 * s);
  if (dir === -1) ctx.scale(-1, 1);
  ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
}

/** 精灵球：可指定旋转、摇晃、开启 */
export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, opt: { rot?: number; shake?: number; open?: boolean } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(opt.shake || 0);
  if (opt.open) {
    // 开盖：上下两半分开
    ctx.save(); ctx.rotate(-0.35); ctx.translate(0, -r * 0.7);
    circle(ctx, 0, 0, r, '#e8503f');
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.lineTo(0, 0); ctx.fillStyle = '#f5f5f5'; ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(0.35); ctx.translate(0, r * 0.7);
    circle(ctx, 0, 0, r, '#e8503f');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.lineTo(0, 0); ctx.fillStyle = '#f5f5f5'; ctx.fill();
    ctx.restore();
  } else {
    ctx.rotate(opt.rot || 0);
    circle(ctx, 0, 0, r, '#e8503f');
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.lineTo(0, 0); ctx.fillStyle = '#f5f5f5'; ctx.fill();
    rr(ctx, -r, -2.2, r * 2, 4.4, 1, '#22272e');
    circle(ctx, 0, 0, r * 0.3, '#fff'); circle(ctx, 0, 0, r * 0.16, '#333');
  }
  ctx.restore();
}

/** 出场光柱 */
export function drawBeam(ctx: CanvasRenderingContext2D, x: number, groundY: number, progress: number, color: string) {
  const h = 150 * Math.min(1, progress * 2.2);
  const w = 40 * Math.min(1, progress * 2.6);
  ctx.save();
  const g = ctx.createLinearGradient(0, groundY - h, 0, groundY);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, color + 'aa');
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - w * 0.35, groundY - h); ctx.lineTo(x + w * 0.35, groundY - h);
  ctx.lineTo(x + w, groundY); ctx.lineTo(x - w, groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - progress)})`;
  ctx.beginPath(); ctx.ellipse(x, groundY, w + 14, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 警戒感叹号（野怪发现玩家） */
export function drawAlert(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const up = Math.max(0, Math.sin(t * 0.012));
  ctx.save(); ctx.translate(x, y - up * 4);
  ctx.fillStyle = '#ffd34a'; ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, -6, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a4a00'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, -6);
  ctx.restore();
}
