/* 精灵物语 · 前后端共享类型（前端 React 与 NestJS 共同引用） */

export type ElementType = 'fire' | 'water' | 'wood' | 'thunder' | 'rock' | 'wind' | 'normal';
export type Gender = 'male' | 'female' | 'unknown';

/** 单个灵兽实例 */
export interface Monster {
  id: string;
  species: number;
  level: number;
  exp: number;
  iv: [number, number, number, number];
  skills: string[];
  hp: number;
  maxHp: number;
  gender: Gender;      // 捕获时随机
  nature: string;      // 捕获时随机的属性倾向
}

/** 存档 data（对应文档 4.2，新增 gender/nature） */
export interface SaveData {
  meta: { configVersion: number; createdAt: number; playSeconds: number };
  profile: { name: string; gender: Gender; steps: number; battles: number; wins: number };
  resources: { coins: number; gems: number };
  team: Monster[];
  storage: Monster[];
  bag: Record<string, number>;
  progress: { map: string; flags: string[] };
  pokedex: { seen: number[]; caught: number[] };
  lastHeal: { x: number; y: number };
}

/** API 统一响应 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 登录 */
export interface LoginDto { username: string; password?: string; }
export interface LoginResult { uid: number; token: string; nickname: string; isNewUser: boolean; }

/** 存档提交（乐观锁） */
export interface SaveSubmitDto { version: number; data: SaveData; }
export interface SaveResult { version: number; data: SaveData; }

/* ---------- 服务端权威结算（阶段 2） ---------- */

/** 战斗结算上报：客户端只上报战斗过程与随机种子，所有奖励由服务端重算 */
export interface BattleSettleDto {
  battleId: string;          // 幂等键，防止重复结算刷奖励
  result: 'win' | 'faint' | 'run';
  enemySpecies: number;
  enemyLevel: number;
  allyIndex: number;         // 出战精灵在队伍中的下标
  rounds: number;            // 战斗回合数
  herbsUsed: number;         // 本场消耗的活力草数（由服务端权威扣除）
  seed: number;              // 本场随机种子（种子决定伤害浮动/捕获随机的可复算性）
  clientChecksum: string;    // 对上述字段的校验和
}

/** 捕获结算上报：捕获成功与否由服务端按种判定 */
export interface CaptureSettleDto {
  battleId: string;
  enemySpecies: number;
  enemyLevel: number;
  enemyHp: number;           // 捕获时敌方剩余血量（服务端据此重算捕获率）
  enemyMaxHp: number;
  allyIndex: number;
  seed: number;
  clientChecksum: string;
}

/** 任务奖励领取上报：只需任务 id，条件由服务端按权威存档校验 */
export interface QuestClaimDto { questId: string; }

/** 任务领取返回 */
export interface QuestClaimResult {
  questId: string;
  reward: { coins?: number; ball?: number; herb?: number };
  version: number;
  data: SaveData;
}

/** 结算返回：权威结果 + 最新存档（version 递增） */
export interface SettleResult {
  coinsGained: number;
  expGained: number;
  caught?: boolean;
  caughtMonster?: Monster;
  events: { type: string; text: string }[];
  version: number;
  data: SaveData;
}

/** 错误码 */
export const ERR = {
  OK: 0,
  NOT_LOGIN: 1001,
  TOKEN_EXPIRED: 1002,
  SAVE_CONFLICT: 2001,
  BAD_PARAMS: 3001,
  CHECKSUM_FAILED: 3002,  // 结算校验和不符，疑似篡改
  DUPLICATE_SETTLE: 3003, // 重复结算（幂等键命中）
  CONFIG_OUTDATED: 4001
} as const;
