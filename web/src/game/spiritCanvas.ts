/* AI 精灵群像 → 单只透明贴图缓存（战斗 2D 绘制用）
 * 思路：按 SPIRIT_CELL 裁出每格，用 flood-fill 从四边抠掉「与边缘连通的纯白背景」，
 * 只抠纯白（r/g/b>240 且接近），保留精灵内部的白色区域（如风羽兽的白羽）。
 * 加载完成后供 drawSpiritSprite 同步取用；未加载时调用方回退程序化绘制。 */
import { SPIRIT_SHEETS, SPIRIT_CELL } from './config';

const cache = new Map<number, HTMLCanvasElement>();
let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';

/** 判断是否纯白背景像素（严格：接近 255 的中性白，避免吃掉浅灰羽毛） */
function isWhite(p: Uint8ClampedArray, i: number): boolean {
  const r = p[i], g = p[i + 1], b = p[i + 2];
  return r > 238 && g > 238 && b > 238 && Math.max(r, g, b) - Math.min(r, g, b) < 12;
}

/** 对单格做边缘 flood-fill 抠白底 */
function cutout(cell: HTMLCanvasElement): HTMLCanvasElement {
  const w = cell.width, h = cell.height;
  const ctx = cell.getContext('2d')!;
  const img = ctx.getImageData(0, 0, w, h);
  const p = img.data;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  const pushEdge = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    if (isWhite(p, idx * 4)) { p[idx * 4 + 3] = 0; stack.push(idx); }
  };
  for (let x = 0; x < w; x++) { pushEdge(x, 0); pushEdge(x, h - 1); }
  for (let y = 0; y < h; y++) { pushEdge(0, y); pushEdge(w - 1, y); }

  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % w, y = (idx / w) | 0;
    pushEdge(x + 1, y); pushEdge(x - 1, y); pushEdge(x, y + 1); pushEdge(x, y - 1);
  }
  ctx.putImageData(img, 0, 0);
  return cell;
}

/** 从群像裁出某物种的单格（3列×2行），返回带透明背景的 canvas */
function cropCell(img: HTMLImageElement, col: number, row: number): HTMLCanvasElement {
  const cw = Math.floor(img.naturalWidth / 3), ch = Math.floor(img.naturalHeight / 2);
  const cell = document.createElement('canvas');
  cell.width = cw; cell.height = ch;
  const ctx = cell.getContext('2d')!;
  ctx.drawImage(img, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
  return cutout(cell);
}

/** 预加载全部图集并裁好所有物种贴图（幂等）。返回 Promise 便于调用方等待。 */
export function preloadSpirits(): Promise<void> {
  if (state === 'ready' || state === 'loading') return Promise.resolve();
  state = 'loading';
  return new Promise((resolve) => {
    let remaining = SPIRIT_SHEETS.length;
    if (!remaining) { state = 'ready'; resolve(); return; }
    const done = () => { if (--remaining <= 0) { state = 'ready'; resolve(); } };
    const imgs: (HTMLImageElement | null)[] = SPIRIT_SHEETS.map(() => null);
    SPIRIT_SHEETS.forEach((src, sheetIdx) => {
      const img = new Image();
      img.onload = () => {
        imgs[sheetIdx] = img;
        try {
          for (const species of Object.keys(SPIRIT_CELL)) {
            const sid = Number(species);
            const [col, row, sheet = 0] = SPIRIT_CELL[sid];
            if (sheet !== sheetIdx || !imgs[sheet]) continue;
            cache.set(sid, cropCell(imgs[sheet]!, col, row));
          }
        } catch (e) {
          console.warn('spirit cutout failed', e);
        }
        done();
      };
      img.onerror = () => { state = 'failed'; done(); };
      img.src = src;
    });
  });
}

/** 同步取某物种的透明贴图；未就绪返回 null（调用方回退程序化绘制） */
export function getSpiritSprite(speciesId: number): HTMLCanvasElement | null {
  return cache.get(speciesId) || null;
}
export function isSpiritReady() { return state === 'ready'; }
