/* 运行时抠图：把 AI 图的浅色背景（浅绿/白）转成透明，生成 THREE.CanvasTexture。
 * 这样广告牌在 3D 场景里不会带方块背景。使用纯前端 Canvas，无需额外依赖。 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';

type BgMode = 'light' | 'white' | 'none';

function keyOut(img: HTMLImageElement, mode: BgMode): THREE.CanvasTexture {
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i+1], b = p[i+2];
    let transparent = false;
    if (mode === 'white') {
      // 白底：RGB 都高且接近
      transparent = r > 225 && g > 225 && b > 225;
    } else {
      // 浅绿底（训练师图）：绿色明显偏高且整体明亮、色相偏绿
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      transparent = g >= r && g >= b && max > 150 && (max - min) < 120 && g - min > 8;
    }
    if (transparent) p[i+3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 加载图片并抠背景，返回纹理。cell 用于从精灵群像中裁切单只（3列×2行）
 *  repeat 用于地面等需要平铺的纹理（仅 mode='none' 时生效） */
export function useBillboardTexture(url: string, mode: BgMode = 'light', cell?: [number, number], repeat?: [number, number]) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      if (mode === 'none') {
        // 用 TextureLoader 直接加载，避免 CanvasTexture 在软件渲染下上传失败
        const loader = new THREE.TextureLoader();
        loader.load(url, t => {
          if (!alive) return;
          t.colorSpace = THREE.SRGBColorSpace;
          t.generateMipmaps = false;
          t.minFilter = THREE.LinearFilter;
          if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
          t.needsUpdate = true;
          setTex(t as any);
        }, undefined, () => {});
        return;
      }
      if (!cell) { setTex(keyOut(img, mode)); return; }
      // 群像裁切：先裁单格到临时 canvas，再抠图
      const cw = img.naturalWidth / 3, ch = img.naturalHeight / 2;
      const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch;
      tmp.getContext('2d')!.drawImage(img, cell[0]*cw, cell[1]*ch, cw, ch, 0, 0, cw, ch);
      const tmpImg = new Image();
      tmpImg.onload = () => alive && setTex(keyOut(tmpImg, 'white'));
      tmpImg.src = tmp.toDataURL();
    };
    img.src = url;
    return () => { alive = false; };
  }, [url, mode, cell?.[0], cell?.[1], repeat?.[0], repeat?.[1]]);
  return tex;
}
