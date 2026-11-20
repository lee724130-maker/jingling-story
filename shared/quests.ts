/* 精灵物语 · 任务系统定义（前后端共用）
 * 进度全部从权威存档字段推导，客户端无法伪造；奖励由服务端校验后发放。
 * 领取状态记录在 save.progress.flags 中，格式为 'quest:<id>:claimed'。 */

import type { SaveData } from './types';

export interface QuestReward {
  coins?: number;
  ball?: number;
  herb?: number;
}

export interface QuestDef {
  id: string;
  title: string;
  desc: string;
  /** 目标值（进度达到即完成） */
  goal: number;
  /** 从权威存档计算当前进度 */
  progress: (save: SaveData) => number;
  reward: QuestReward;
  /** 任务阶段，用于引导顺序 */
  stage: number;
}

/** 已领取标记的 key */
export const questFlag = (id: string) => `quest:${id}:claimed`;

/** 任务列表：顺序即引导顺序 */
export const QUESTS: QuestDef[] = [
  {
    id: 'first_steps', stage: 1,
    title: '启程的第一步',
    desc: '在副本中探索 30 次',
    goal: 30,
    progress: (s) => s.profile.steps,
    reward: { coins: 30 }
  },
  {
    id: 'first_battle', stage: 2,
    title: '初次对战',
    desc: '赢得 1 场精灵对战',
    goal: 1,
    progress: (s) => s.profile.wins,
    reward: { coins: 50, herb: 2 }
  },
  {
    id: 'first_catch', stage: 3,
    title: '精灵收藏家',
    desc: '成功捕获 2 只精灵',
    goal: 2,
    progress: (s) => Math.max(0, s.pokedex.caught.length - 1), // 初始伙伴不计
    reward: { coins: 60, ball: 3 }
  },
  {
    id: 'explorer', stage: 4,
    title: '见多识广',
    desc: '在图鉴中记录 5 种精灵',
    goal: 5,
    progress: (s) => s.pokedex.seen.length,
    reward: { coins: 80, herb: 3 }
  },
  {
    id: 'veteran', stage: 5,
    title: '身经百战',
    desc: '累计赢得 5 场对战',
    goal: 5,
    progress: (s) => s.profile.wins,
    reward: { coins: 150, ball: 5 }
  },
  {
    id: 'trainer', stage: 6,
    title: '训练有素',
    desc: '让一只精灵达到 Lv.10',
    goal: 10,
    progress: (s) => Math.max(0, ...s.team.map(m => m.level)),
    reward: { coins: 120, herb: 5 }
  },
  {
    id: 'collector', stage: 7,
    title: '图鉴大师',
    desc: '捕获 12 种不同的精灵',
    goal: 12,
    progress: (s) => s.pokedex.caught.length,
    reward: { coins: 300, ball: 10 }
  }
];

export interface QuestView {
  id: string;
  title: string;
  desc: string;
  progress: number;
  goal: number;
  claimed: boolean;
  complete: boolean;
  reward: QuestReward;
  stage: number;
}

/** 计算单个任务在存档中的视图状态 */
export function questView(def: QuestDef, save: SaveData): QuestView {
  const raw = def.progress(save);
  const progress = Math.max(0, Math.min(def.goal, raw));
  return {
    id: def.id, title: def.title, desc: def.desc,
    progress, goal: def.goal,
    claimed: save.progress.flags.includes(questFlag(def.id)),
    complete: raw >= def.goal,
    reward: def.reward, stage: def.stage
  };
}

/** 全部任务视图 */
export function allQuestViews(save: SaveData): QuestView[] {
  return QUESTS.map(def => questView(def, save));
}

/** 当前可领取的任务数（完成且未领取） */
export function claimableCount(save: SaveData): number {
  return allQuestViews(save).filter(v => v.complete && !v.claimed).length;
}
