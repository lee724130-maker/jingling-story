/* 2D 像素坐标（engine 内部）与 3D 世界坐标的桥接。
 * engine 仍用旧像素坐标跑逻辑，这里只做渲染层换算，逻辑零改动。 */
export const PX_W = 640, PX_H = 448;   // 旧地图像素尺寸
export const SCALE = 1 / 16;            // 1 像素 = 1/16 世界单位

export function pxToWorld(px: number, py: number): [number, number] {
  return [(px - PX_W / 2) * SCALE, (py - PX_H / 2) * SCALE];
}
export function worldSpanX(px: number) { return px * SCALE; }
export function worldSpanY(py: number) { return py * SCALE; }
