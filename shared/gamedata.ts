/* 精灵物语 · 前后端共享游戏数据（原创 IP）
 * 战斗/捕获/升级规则见 rules.ts。此文件只放静态配置，前端 config.ts 与后端结算共用，
 * 避免前后端数据漂移导致结算校验不一致。 */

export type ElementType = 'fire' | 'water' | 'wood' | 'thunder' | 'rock' | 'wind' | 'normal';

export const TYPES: Record<string, { name: string; color: string; light: string }> = {
  fire:    { name: '焰', color: '#e8663c', light: '#ffb08a' },
  water:   { name: '潮', color: '#3c8ce8', light: '#8ac0ff' },
  wood:    { name: '木', color: '#4fb05a', light: '#9be09b' },
  thunder: { name: '雷', color: '#d1a32b', light: '#ffe07a' },
  rock:    { name: '岩', color: '#a08963', light: '#cbb58a' },
  wind:    { name: '风', color: '#63b6b0', light: '#a7e2de' },
  normal:  { name: '常', color: '#9aa3ad', light: '#d5d9dc' }
};

export const TYPE_CHART: Record<string, Record<string, number>> = {
  fire:    { wood: 2, water: 0.5, rock: 0.5 },
  water:   { fire: 2, rock: 2, wood: 0.5, thunder: 0.5 },
  wood:    { water: 2, rock: 2, fire: 0.5, wind: 0.5 },
  thunder: { water: 2, wind: 2, wood: 0.5, rock: 0.5 },
  rock:    { fire: 2, thunder: 2, water: 0.5, wood: 0.5 },
  wind:    { wood: 2, thunder: 2, rock: 0.5 },
  normal:  {}
};

export interface Skill { name: string; type: ElementType; power: number; acc: number; pp: number; kind: 'dmg' | 'heal'; value?: number; }
export const SKILLS: Record<string, Skill> = {
  tackle:   { name: '冲撞', type: 'normal',  power: 40, acc: 100, pp: 35, kind: 'dmg' },
  ember:    { name: '火星', type: 'fire',    power: 55, acc: 95,  pp: 25, kind: 'dmg' },
  blaze:    { name: '烈焰', type: 'fire',    power: 85, acc: 85,  pp: 10, kind: 'dmg' },
  bubble:   { name: '水泡', type: 'water',   power: 55, acc: 95,  pp: 25, kind: 'dmg' },
  surge:    { name: '洪流', type: 'water',   power: 85, acc: 85,  pp: 10, kind: 'dmg' },
  vine:     { name: '藤鞭', type: 'wood',    power: 55, acc: 95,  pp: 25, kind: 'dmg' },
  crush:    { name: '木碎', type: 'wood',    power: 85, acc: 85,  pp: 10, kind: 'dmg' },
  spark:    { name: '电光', type: 'thunder', power: 55, acc: 95,  pp: 25, kind: 'dmg' },
  bolt:     { name: '雷击', type: 'thunder', power: 85, acc: 85,  pp: 10, kind: 'dmg' },
  rockfall: { name: '落石', type: 'rock',    power: 55, acc: 95,  pp: 25, kind: 'dmg' },
  avalanche:{ name: '岩崩', type: 'rock',    power: 85, acc: 85,  pp: 10, kind: 'dmg' },
  gust:     { name: '风刃', type: 'wind',    power: 55, acc: 95,  pp: 25, kind: 'dmg' },
  storm:    { name: '风暴', type: 'wind',    power: 85, acc: 85,  pp: 10, kind: 'dmg' },
  heal:     { name: '回春', type: 'normal',  power: 0,  acc: 100, pp: 10, kind: 'heal', value: 0.5 }
};

export interface Species {
  id: number; name: string; type: ElementType;
  base: { hp: number; atk: number; def: number; spd: number };
  skills: string[]; evolve: { lv: number; to: number } | null; shape: string; desc: string;
}
export const MONSTERS: Record<number, Species> = {
  1:  { id: 1,  name: '焰苗兽', type: 'fire',    base: { hp: 45, atk: 52, def: 40, spd: 55 }, skills: ['tackle','ember'],              evolve: { lv: 16, to: 2 },  shape: 'flame',   desc: '额头的小火苗会随情绪摇曳。' },
  2:  { id: 2,  name: '焰鬃兽', type: 'fire',    base: { hp: 68, atk: 82, def: 60, spd: 78 }, skills: ['ember','blaze','tackle'],     evolve: null,               shape: 'flame',   desc: '鬃毛燃烧着永不熄灭的火焰。' },
  3:  { id: 3,  name: '潮泡兽', type: 'water',   base: { hp: 50, atk: 45, def: 48, spd: 48 }, skills: ['tackle','bubble'],            evolve: { lv: 16, to: 4 },  shape: 'bubble',  desc: '背上驮着一颗装满泉水的泡泡。' },
  4:  { id: 4,  name: '潮涛兽', type: 'water',   base: { hp: 78, atk: 70, def: 75, spd: 62 }, skills: ['bubble','surge','tackle'],    evolve: null,               shape: 'bubble',  desc: '能掀起足以吞没小船的巨浪。' },
  5:  { id: 5,  name: '木芽兽', type: 'wood',    base: { hp: 48, atk: 50, def: 52, spd: 45 }, skills: ['tackle','vine'],              evolve: { lv: 18, to: 6 },  shape: 'leaf',    desc: '头顶的嫩芽晒足阳光会舒展。' },
  6:  { id: 6,  name: '木角兽', type: 'wood',    base: { hp: 74, atk: 78, def: 82, spd: 55 }, skills: ['vine','crush','tackle'],      evolve: null,               shape: 'leaf',    desc: '树般的巨角能撞碎岩石。' },
  7:  { id: 7,  name: '电绒兽', type: 'thunder', base: { hp: 42, atk: 55, def: 38, spd: 70 }, skills: ['tackle','spark'],            evolve: { lv: 18, to: 8 },  shape: 'spark',   desc: '绒毛摩擦时会发出细密的电光。' },
  8:  { id: 8,  name: '雷纹兽', type: 'thunder', base: { hp: 66, atk: 88, def: 58, spd: 96 }, skills: ['spark','bolt','tackle'],     evolve: null,               shape: 'spark',   desc: '奔跑时身后留下闪电般的纹路。' },
  9:  { id: 9,  name: '岩仔',   type: 'rock',    base: { hp: 55, atk: 48, def: 62, spd: 35 }, skills: ['tackle','rockfall'],         evolve: { lv: 20, to: 10 }, shape: 'rock',    desc: '喜欢蜷在石堆里睡一整天。' },
  10: { id: 10, name: '岩卫',   type: 'rock',    base: { hp: 85, atk: 72, def: 100,spd: 45 }, skills: ['rockfall','avalanche','tackle'], evolve: null,          shape: 'rock',    desc: '坚硬身躯是同伴最可靠的屏障。' },
  11: { id: 11, name: '风羽兽', type: 'wind',    base: { hp: 46, atk: 54, def: 42, spd: 68 }, skills: ['tackle','gust'],            evolve: { lv: 20, to: 12 }, shape: 'wind',    desc: '羽翼轻盈，能借风滑翔很远。' },
  12: { id: 12, name: '风翔兽', type: 'wind',    base: { hp: 70, atk: 80, def: 62, spd: 100}, skills: ['gust','storm','tackle'],     evolve: null,               shape: 'wind',    desc: '展翅时气流会卷起地上的花瓣。' }
};

export const ITEMS = {
  ball: { id: 'ball', name: '灵兽球', desc: '捕获野生精灵' },
  herb: { id: 'herb', name: '活力草', desc: '回复 50% 生命' }
};

export const MAP = [
  '####################',
  '#......#####.......#',
  '#......#...#...~~..#',
  '#..==..#...#...~~..#',
  '#..==......#.......#',
  '#..==..#####...##..#',
  '#......#...#...##..#',
  '#..S...#...#.......#',
  '#......#...#..==...#',
  '#..~~..#...#..==...#',
  '#..~~......#..==...#',
  '#......#####.......#',
  '#................H.#',
  '####################'
];

export const ENCOUNTERS = [
  { id: 1, min: 3, max: 6, w: 18 }, { id: 3, min: 3, max: 6, w: 18 },
  { id: 5, min: 4, max: 7, w: 16 }, { id: 7, min: 4, max: 7, w: 14 },
  { id: 9, min: 5, max: 8, w: 12 }, { id: 11, min: 5, max: 8, w: 12 },
  { id: 2, min: 10, max: 13, w: 4 }, { id: 4, min: 10, max: 13, w: 3 }, { id: 8, min: 10, max: 13, w: 3 }
];

export const NATURES = ['勇敢','冷静','活泼','内向','贪吃','耐心','急躁','温柔'];

export const ART = {
  trainerMale: '/art/trainer_male.png',
  trainerFemale: '/art/trainer_female.png',
  trainerMaleHd: '/art/trainer_male_hd.png',
  trainerFemaleHd: '/art/trainer_female_hd.png',
  spirits: '/art/spirits.png',
  sceneGrass: '/art/scene_grass.png',
  sceneSky: '/art/scene_sky.png',
  sceneVillage: '/art/scene_village.png',
  sceneMeadow: '/art/scene_meadow.png',
  sceneStream: '/art/scene_stream.png',
  sceneCavern: '/art/scene_cavern.png'
};
export const SPIRIT_CELL: Record<number, [number, number]> = {
  1: [0,0], 2: [0,0],
  3: [1,0], 4: [1,0],
  5: [2,0], 6: [2,0],
  7: [0,1], 8: [0,1],
  9: [1,1], 10: [1,1],
  11: [2,1], 12: [2,1]
};

export const TILE = 32;
export const START_PARTNER = 1;
export const START_BALLS = 5;
export const START_HERBS = 3;
