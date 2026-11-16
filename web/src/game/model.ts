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
  return {
    meta: { configVersion: 1, createdAt: Date.now(), playSeconds: 0 },
    profile: { name, gender, steps: 0, battles: 0, wins: 0 },
    resources: { coins: 100, gems: 0 },
    team: [newMonster(START_PARTNER, 5, { gender })],
    storage: [],
    bag: { ball: START_BALLS, herb: START_HERBS },
    progress: { map: 'qingya', flags: ['tutorial_done'] },
    pokedex: { seen: [START_PARTNER], caught: [START_PARTNER] },
    lastHeal: { x: 0, y: 0 }
  };
}
