/* 精灵物语 · 地图配置（前后端共用）
 * 区域一：新手村 qingya —— 无野怪，含村长/商店 NPC、任务板、疗伤石碑、通向上方草原的出口
 * 区域二：大草原 grassland —— 副本式野外区，只有这里刷野怪，出口回新手村
 * 地图字符：# 树/墙(不可走) ~ 水(不可走) . 草地 = 建筑/广场 S 出生点 H 疗伤石碑
 *           E 区域出口 N NPC交互点 B 任务板 P 商店 */
import type { ElementType } from './types';

export type MapId = 'qingya' | 'grassland';

export interface NpcDef {
  id: string;
  name: string;
  role: 'elder' | 'shop' | 'questboard' | 'sign';
  x: number;   // 格子列
  y: number;   // 格子行
  lines: string[];  // 对话内容（elder 的首段引导）
}

export interface ExitDef {
  x: number; y: number;
  to: MapId;
  spawn: { x: number; y: number };  // 切换后的落点格子
  label: string;
}

export interface MapDef {
  id: MapId;
  name: string;
  grid: string[];
  wilds: boolean;      // 是否生成野怪
  exits: ExitDef[];
  npcs: NpcDef[];
  groundColor: string; // 3D 地面底色
  treeCount: number;   // 3D 程序化树数量
}

/** 新手村：开阔、少障碍，基础设施齐全 */
const QINGYA_GRID = [
  '####################',
  '#.........#........#',
  '#..===....#...===..#',
  '#..===........===..#',
  '#..................#',
  '#....P......N......#',   // P 商店老板(第5列) N 村长(第13列)
  '#..................#',
  '#......S...........#',   // S 出生点
  '#..................#',
  '#....N........B....#',   // N 向导NPC B 任务板
  '#..................#',
  '#..........H.......#',   // H 疗伤石碑
  '#........E.........#',   // E 通向大草原的出口（地图上方区域）
  '####################'
];

/** 大草原：副本野外区，野怪游荡，出口回村 */
const GRASSLAND_GRID = [
  '####################',
  '#......#####.......#',
  '#......#...#...~~..#',
  '#..==..#...#...~~..#',
  '#..==......#.......#',
  '#..==..#####...##..#',
  '#......#...#...##..#',
  '#..S...#...#.......#',   // S 从新手村进入的落点
  '#......#...#..==...#',
  '#..~~..#...#..==...#',
  '#..~~......#..==...#',
  '#......#####.......#',
  '#...........E......#',   // E 返回新手村的出口
  '####################'
];

export const MAPS: Record<MapId, MapDef> = {
  qingya: {
    id: 'qingya', name: '青芽村 · 新手村', grid: QINGYA_GRID,
    wilds: false,
    exits: [{ x: 9, y: 12, to: 'grassland', spawn: { x: 3, y: 7 }, label: '前往 大草原' }],
    npcs: [
      { id: 'elder', name: '村长 木老', role: 'elder', x: 13, y: 5,
        lines: ['欢迎来到青芽村，年轻的冒险家。', '在踏上旅途之前，先选一只精灵伙伴吧。'] },
      { id: 'shop', name: '商店老板 阿布', role: 'shop', x: 5, y: 5,
        lines: ['欢迎光临！灵兽球、活力草，要什么随便挑。'] },
      { id: 'guide', name: '向导 小岚', role: 'sign', x: 5, y: 9,
        lines: ['村子上方的出口通往大草原，那里有野生精灵。', '想抓精灵记得先来商店买灵兽球哦！'] },
      { id: 'board', name: '冒险任务板', role: 'questboard', x: 14, y: 9,
        lines: ['这里张贴着冒险者们的任务委托。'] }
    ],
    groundColor: '#8fce74', treeCount: 26
  },
  grassland: {
    id: 'grassland', name: '大草原 · 野外区', grid: GRASSLAND_GRID,
    wilds: true,
    exits: [{ x: 12, y: 12, to: 'qingya', spawn: { x: 8, y: 7 }, label: '返回 青芽村' }],
    npcs: [],
    groundColor: '#6cbf5a', treeCount: 90
  }
};

/** 初始三选一主宠（火/水/木三系初始） */
export const STARTER_CHOICES: { species: number; name: string; type: ElementType; desc: string }[] = [
  { species: 1, name: '焰苗兽', type: 'fire', desc: '额头的小火苗会随情绪摇曳。焰系初始伙伴。' },
  { species: 3, name: '潮泡兽', type: 'water', desc: '背上驮着一颗装满泉水的泡泡。潮系初始伙伴。' },
  { species: 5, name: '木芽兽', type: 'wood', desc: '头顶的嫩芽晒足阳光会舒展。木系初始伙伴。' }
];

/** 商店商品（服务端权威定价） */
export const SHOP_ITEMS: Record<string, { name: string; price: number }> = {
  ball: { name: '灵兽球', price: 20 },
  herb: { name: '活力草', price: 15 }
};

export function isMapId(v: string): v is MapId { return v === 'qingya' || v === 'grassland'; }
