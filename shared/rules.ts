/* 精灵物语 · 前后端共享战斗规则（纯函数，无副作用依赖）
 * 权威原则：伤害/捕获率/经验/升级/进化公式只在此定义一份，前后端共用，
 * 服务端结算时按这些规则从权威存档重算，客户端的本地模拟仅用于动画流畅。 */
import type { Monster } from './types';
import { MONSTERS, TYPE_CHART, SKILLS, NATURES } from './gamedata';

export function maxHpFor(species: number, level: number) {
  return Math.floor(MONSTERS[species].base.hp * 2 + level * 2 + 10);
}

/** 确定性伪随机：由种子生成 [0,1)，用于可校验的战斗随机（种子随上报传回，服务端可复算） */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 伤害计算：rng 为随机源（客户端 Math.random / 服务端按种子复算） */
export function calcDamage(attacker: Monster, defender: Monster, skillId: string, rng: () => number) {
  const sk = SKILLS[skillId];
  const atk = MONSTERS[attacker.species].base.atk + attacker.level + (attacker.iv?.[1] || 0);
  const def = MONSTERS[defender.species].base.def + defender.level;
  let dmg = Math.floor(((2 * attacker.level / 5 + 2) * sk.power * (atk / def)) / 50 + 2);
  let mult = (TYPE_CHART[sk.type]?.[MONSTERS[defender.species].type]) || 1;
  if (sk.type === MONSTERS[attacker.species].type) mult *= 1.3;
  dmg = Math.floor(dmg * mult * (0.85 + rng() * 0.3));
  return { dmg: Math.max(1, dmg), mult };
}

/** 捕获率：仅由敌方剩余血量比例决定（服务端按上报的 hp 比例复算，防伪造成功率） */
export function captureRate(hp: number, maxHp: number) {
  const ratio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
  return Math.max(0.08, 0.78 - ratio * 0.55 + (1 - ratio) * 0.2);
}

export interface ExpEvent { type: 'level' | 'evolve'; level?: number; from?: number; to?: number; text: string; }

/** 发放经验并处理升级/进化（权威逻辑，服务端对权威存档调用） */
export function grantExp(m: Monster, amount: number): { exp: number; events: ExpEvent[] } {
  const events: ExpEvent[] = [];
  m.exp += amount;
  while (m.exp >= m.level * 22 && m.level < 50) {
    m.exp -= m.level * 22;
    m.level++;
    const old = m.maxHp; m.maxHp = maxHpFor(m.species, m.level); m.hp += (m.maxHp - old);
    events.push({ type: 'level', level: m.level, text: `${MONSTERS[m.species].name} 升到了 Lv.${m.level}！` });
    const evo = MONSTERS[m.species].evolve;
    if (evo && m.level >= evo.lv) {
      const before = MONSTERS[m.species].name;
      m.species = evo.to; m.skills = [...MONSTERS[m.species].skills];
      const old2 = m.maxHp; m.maxHp = maxHpFor(m.species, m.level); m.hp += (m.maxHp - old2);
      events.push({ type: 'evolve', from: m.species, to: evo.to, text: `${before} 进化成了 ${MONSTERS[m.species].name}！` });
    }
  }
  return { exp: amount, events };
}

/** 创建精灵实例（可注入随机源，服务端捕获时按种子生成，客户端可复算校验） */
export function makeMonster(speciesId: number, level: number, rng: () => number, opts?: Partial<Monster>): Monster {
  const maxHp = maxHpFor(speciesId, level);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  return {
    id: opts?.id || 'm_' + Math.floor(rng() * 1e9).toString(36),
    species: speciesId, level, exp: 0,
    iv: [Math.floor(rng()*16), Math.floor(rng()*16), Math.floor(rng()*16), Math.floor(rng()*16)] as [number,number,number,number],
    skills: [...MONSTERS[speciesId].skills], hp: maxHp, maxHp,
    gender: opts?.gender || (rng() < 0.5 ? 'male' : 'female'),
    nature: opts?.nature || pick(NATURES)
  };
}

/** 战斗结算校验和：对上报的关键字段做确定性 hash，服务端复算比对，防中间人篡改 */
export function checksum(payload: string): string {
  let h = 5381;
  for (let i = 0; i < payload.length; i++) h = ((h << 5) + h + payload.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
