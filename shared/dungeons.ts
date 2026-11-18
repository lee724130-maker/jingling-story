/* 精灵物语 · 副本配置（前后端共用）
 * 手游式玩法：主面板 → 副本选择 → 副本场景点「探索」→ 概率判定（精灵/物品/空）。
 * 探索判定与物品发放由服务端按种子权威结算；遭遇精灵只返回种类/等级，进战斗后走原有结算。
 * 场景图复用现有 AI 素材（scene_grass/scene_sky），不新增美术、不消耗积分。 */

export type DungeonId = 'meadow' | 'stream' | 'cavern';

export interface DungeonDef {
  id: DungeonId;
  name: string;
  subtitle: string;
  desc: string;
  /** 场景背景图（复用现有 AI 素材） */
  bg: string;
  /** 主题色，用于卡片与探索按钮 */
  accent: string;
  /** 遭遇精灵池：物种 id + 权重 */
  encounters: { species: number; w: number }[];
  /** 等级范围 */
  level: [number, number];
  /** 探索结果概率（三项之和应为 1） */
  rates: { monster: number; item: number; nothing: number };
  /** 物品池：可捡到的道具与权重 */
  items: { item: 'ball' | 'herb' | 'coins'; min: number; max: number; w: number }[];
  /** 解锁所需主线标记（空=默认解锁） */
  unlockFlag?: string;
}

import { ART } from './gamedata';

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  meadow: {
    id: 'meadow', name: '微风草原', subtitle: '新手区 · Lv.3-7',
    desc: '青芽村外的开阔草原，风里带着青草香。适合初出茅庐的训练师。',
    bg: ART.sceneGrass, accent: '#5fd0a6',
    encounters: [
      { species: 1, w: 18 }, { species: 3, w: 18 }, { species: 5, w: 16 },
      { species: 7, w: 14 }, { species: 9, w: 12 }, { species: 11, w: 12 },
      { species: 2, w: 4 }, { species: 4, w: 3 }, { species: 8, w: 3 }
    ],
    level: [3, 7],
    rates: { monster: 0.55, item: 0.30, nothing: 0.15 },
    items: [
      { item: 'coins', min: 8, max: 20, w: 40 },
      { item: 'herb', min: 1, max: 1, w: 35 },
      { item: 'ball', min: 1, max: 1, w: 25 }
    ]
  },
  stream: {
    id: 'stream', name: '潺潺溪谷', subtitle: '进阶区 · Lv.8-13',
    desc: '穿过草原的清澈溪流，水雾弥漫。栖息着更强韧的精灵。',
    bg: ART.sceneGrass, accent: '#5aa9e6',
    encounters: [
      { species: 3, w: 20 }, { species: 4, w: 14 }, { species: 5, w: 14 },
      { species: 6, w: 12 }, { species: 11, w: 12 }, { species: 12, w: 10 },
      { species: 7, w: 8 }, { species: 8, w: 6 }, { species: 10, w: 4 }
    ],
    level: [8, 13],
    rates: { monster: 0.58, item: 0.27, nothing: 0.15 },
    items: [
      { item: 'coins', min: 15, max: 32, w: 40 },
      { item: 'ball', min: 1, max: 2, w: 35 },
      { item: 'herb', min: 1, max: 2, w: 25 }
    ],
    unlockFlag: 'story:starter_chosen'
  },
  cavern: {
    id: 'cavern', name: '回声岩洞', subtitle: '挑战区 · Lv.14-20',
    desc: '幽深岩洞，回荡着奇怪的声响。只有经验丰富的训练师才敢深入。',
    bg: ART.sceneGrass, accent: '#b98bff',
    encounters: [
      { species: 9, w: 20 }, { species: 10, w: 16 }, { species: 8, w: 16 },
      { species: 12, w: 14 }, { species: 2, w: 12 }, { species: 6, w: 10 },
      { species: 4, w: 8 }, { species: 11, w: 4 }
    ],
    level: [14, 20],
    rates: { monster: 0.62, item: 0.28, nothing: 0.10 },
    items: [
      { item: 'coins', min: 28, max: 55, w: 42 },
      { item: 'ball', min: 2, max: 3, w: 33 },
      { item: 'herb', min: 2, max: 3, w: 25 }
    ],
    unlockFlag: 'quest:win_5:claimed'
  }
};

export const DUNGEON_LIST = Object.values(DUNGEONS);

export function isDungeonId(v: string): v is DungeonId {
  return v === 'meadow' || v === 'stream' || v === 'cavern';
}

/** 副本是否解锁（按存档 flags 判定） */
export function isDungeonUnlocked(def: DungeonDef, flags: string[]): boolean {
  return !def.unlockFlag || flags.includes(def.unlockFlag);
}

/** 从加权池抽取一项（客户端预览用，权威判定在服务端） */
export function pickWeighted<T extends { w: number }>(pool: T[], rng: () => number): T {
  const total = pool.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const x of pool) { r -= x.w; if (r <= 0) return x; }
  return pool[pool.length - 1];
}
