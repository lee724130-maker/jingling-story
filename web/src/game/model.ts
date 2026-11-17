/* 精灵物语 · 数据模型：复用 shared 规则，保证前后端一致 */
import type { Monster, SaveData, Gender } from '@shared/types';
import { START_PARTNER, START_BALLS, START_HERBS } from './config';
import { makeMonster, maxHpFor } from '@shared/rules';

export { maxHpFor } from '@shared/rules';

export function rnd(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }
export function randomGender(): Gender { return Math.random() < 0.5 ? 'male' : 'female'; }
export function randomNature(): string { return makeMonster(START_PARTNER, 5, Math.random).nature; }

export function newMonster(speciesId: number, level: number, opts?: Partial<Monster>): Monster {
  return makeMonster(speciesId, level, Math.random, opts);
}

export function createNewSave(name: string, gender: Gender): SaveData {
  // 新账号：队伍为空，主线从「找村长选初始伙伴」开始；不再默认送精灵
  return {
    meta: { configVersion: 1, createdAt: Date.now(), playSeconds: 0 },
    profile: { name, gender, steps: 0, battles: 0, wins: 0 },
    resources: { coins: 100, gems: 0 },
    team: [],
    storage: [],
    bag: { ball: START_BALLS, herb: START_HERBS },
    progress: { map: 'qingya', flags: ['tutorial_done', 'story:need_starter'] },
    pokedex: { seen: [], caught: [] },
    lastHeal: { x: 0, y: 0 }
  };
}

/** 老存档兼容：已有精灵的账号补上主线完成标记，跳过选宠流程 */
export function migrateSave(save: SaveData): SaveData {
  if (save.team.length > 0 && !save.progress.flags.includes('story:starter_chosen')) {
    save.progress.flags.push('story:starter_chosen');
  }
  if (!save.progress.map) save.progress.map = 'qingya';
  return save;
}
