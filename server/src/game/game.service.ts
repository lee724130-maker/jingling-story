/* 服务端权威结算：战斗/捕获的所有奖励由服务端按共享规则重算，
 * 客户端只上报战斗上下文与随机种子，不信任客户端算出的经验/金币/捕获结果。 */
import { Injectable } from '@nestjs/common';
import { store } from '../common/store';
import {
  ERR, SaveData, Monster, BattleSettleDto, CaptureSettleDto, SettleResult
} from '../../../shared/types';
import { seededRandom, captureRate, grantExp, makeMonster, checksum } from '../../../shared/rules';
import { MONSTERS } from '../../../shared/gamedata';

type ExpEventLike = { type: string; text: string };

export interface SettleOutcome {
  code: number;
  message: string;
  data: (SettleResult & { version: number; data: SaveData }) | null;
}

@Injectable()
export class GameService {
  // 幂等键：已结算的 battleId -> 结算结果快照（防止重复提交刷奖励）
  private settled = new Map<string, SettleResult>();

  /** 构造校验和字符串：字段顺序固定，前后端必须一致 */
  private battlePayload(d: BattleSettleDto) {
    return [d.battleId, d.result, d.enemySpecies, d.enemyLevel, d.allyIndex, d.rounds, d.herbsUsed, d.seed].join('|');
  }
  private capturePayload(d: CaptureSettleDto) {
    return [d.battleId, d.enemySpecies, d.enemyLevel, d.enemyHp, d.enemyMaxHp, d.allyIndex, d.seed].join('|');
  }

  private validCommon(uid: number, battleId: string, payload: string, clientChecksum: string): string | null {
    if (!uid || !battleId) return '参数不完整';
    if (checksum(payload) !== clientChecksum) return '校验和不符，疑似篡改';
    return null;
  }

  private async persist(uid: number, save: SaveData, result: Omit<SettleResult, 'version' | 'data'>): Promise<SettleOutcome> {
    const row = await store.getSave(uid);
    const nextVersion = (row ? row.version : 0) + 1;
    const written = await store.putSave(uid, nextVersion, save);
    const full: SettleResult = { ...result, version: written.version, data: written.data };
    return { code: ERR.OK, message: 'ok', data: full };
  }

  /** 战斗结算：金币、经验、升级、进化全部按共享规则从权威存档重算 */
  async settleBattle(uid: number, dto: BattleSettleDto): Promise<SettleOutcome> {
    const err = this.validCommon(uid, dto.battleId, this.battlePayload(dto), dto.clientChecksum);
    if (err) return { code: ERR.CHECKSUM_FAILED, message: err, data: null };
    if (this.settled.has(dto.battleId)) {
      return { code: ERR.DUPLICATE_SETTLE, message: '该战斗已结算', data: this.settled.get(dto.battleId)! };
    }
    if (!['win', 'faint', 'run'].includes(dto.result)) return { code: ERR.BAD_PARAMS, message: '非法战斗结果', data: null };
    // 合理性校验：敌方种类必须存在、等级在配置范围内、回合数非负，防伪造高等级刷金币
    if (!MONSTERS[dto.enemySpecies]) return { code: ERR.BAD_PARAMS, message: '非法精灵种类', data: null };
    if (dto.enemyLevel < 1 || dto.enemyLevel > 50) return { code: ERR.BAD_PARAMS, message: '非法精灵等级', data: null };
    if (dto.rounds < 0 || dto.rounds > 999) return { code: ERR.BAD_PARAMS, message: '非法回合数', data: null };
    if (dto.herbsUsed < 0 || dto.herbsUsed > 99) return { code: ERR.BAD_PARAMS, message: '非法道具数', data: null };

    const row = await store.getSave(uid);
    if (!row) return { code: ERR.BAD_PARAMS, message: '存档不存在', data: null };
    const save: SaveData = JSON.parse(JSON.stringify(row.data));
    const ally = save.team[dto.allyIndex];
    const events: ExpEventLike[] = [];
    let coinsGained = 0, expGained = 0;

    // 活力草消耗：服务端按上报数权威扣除（客户端本地使用仅用于动画流畅）
    if (dto.herbsUsed > 0) {
      save.bag.herb = Math.max(0, (save.bag.herb || 0) - dto.herbsUsed);
    }

    if (dto.result === 'win') {
      // 金币：基础 10~25 + 敌方等级×2（随机由种子决定，可复算）
      const rng = seededRandom(dto.seed + 101);
      coinsGained = 10 + Math.floor(rng() * 16) + dto.enemyLevel * 2;
      save.resources.coins += coinsGained;
      save.profile.battles++;
      save.profile.wins++;
      expGained = Math.floor(dto.enemyLevel * 12);
      if (ally && ally.hp > 0) {
        const r = grantExp(ally, expGained);
        r.events.forEach(e => events.push({ type: e.type, text: e.text }));
      }
    } else if (dto.result === 'faint') {
      // 战败：全队恢复，客户端会送回石碑（位置由客户端处理，资源结算在此）
      save.team.forEach(m => { m.hp = m.maxHp; });
      events.push({ type: 'info', text: '精灵们已恢复体力。' });
    }

    // 记录图鉴已见（服务端权威补齐）
    if (!save.pokedex.seen.includes(dto.enemySpecies)) save.pokedex.seen.push(dto.enemySpecies);

    const result: Omit<SettleResult, 'version' | 'data'> = { coinsGained, expGained, events };
    const outcome = await this.persist(uid, save, result);
    if (outcome.code === ERR.OK && outcome.data) {
      const { version, data, ...rest } = outcome.data;
      this.settled.set(dto.battleId, rest as SettleResult);
    }
    return outcome;
  }

  /** 捕获结算：成功与否由服务端按血量比例重算，捕获到的精灵属性由服务端种子生成 */
  async settleCapture(uid: number, dto: CaptureSettleDto): Promise<SettleOutcome> {
    const err = this.validCommon(uid, dto.battleId, this.capturePayload(dto), dto.clientChecksum);
    if (err) return { code: ERR.CHECKSUM_FAILED, message: err, data: null };
    if (this.settled.has(dto.battleId)) {
      return { code: ERR.DUPLICATE_SETTLE, message: '该战斗已结算', data: this.settled.get(dto.battleId)! };
    }
    if (!MONSTERS[dto.enemySpecies]) return { code: ERR.BAD_PARAMS, message: '非法精灵种类', data: null };
    if (dto.enemyLevel < 1 || dto.enemyLevel > 50) return { code: ERR.BAD_PARAMS, message: '非法精灵等级', data: null };
    if (dto.enemyHp < 0 || dto.enemyHp > dto.enemyMaxHp || dto.enemyMaxHp <= 0) {
      return { code: ERR.BAD_PARAMS, message: '非法血量', data: null };
    }

    const row = await store.getSave(uid);
    if (!row) return { code: ERR.BAD_PARAMS, message: '存档不存在', data: null };
    const save: SaveData = JSON.parse(JSON.stringify(row.data));
    if ((save.bag.ball || 0) < 1) return { code: ERR.BAD_PARAMS, message: '没有灵兽球了', data: null };
    save.bag.ball--; // 扣球由服务端权威执行

    const rate = captureRate(dto.enemyHp, dto.enemyMaxHp);
    const rng = seededRandom(dto.seed + 707);
    const caught = rng() < rate;
    const events: ExpEventLike[] = [];
    let expGained = 0;
    let caughtMonster: Monster | undefined;

    if (caught) {
      caughtMonster = makeMonster(dto.enemySpecies, dto.enemyLevel, seededRandom(dto.seed + 909));
      if (save.team.length < 6) save.team.push(caughtMonster); else save.storage.push(caughtMonster);
      if (!save.pokedex.caught.includes(dto.enemySpecies)) save.pokedex.caught.push(dto.enemySpecies);
      if (!save.pokedex.seen.includes(dto.enemySpecies)) save.pokedex.seen.push(dto.enemySpecies);
      const ally = save.team[dto.allyIndex];
      expGained = Math.floor(dto.enemyLevel * 8);
      if (ally && ally.hp > 0) grantExp(ally, expGained).events.forEach(e => events.push({ type: e.type, text: e.text }));
      events.push({ type: 'info', text: `捕获成功！${caughtMonster ? '' : ''}` });
    }
    if (!save.pokedex.seen.includes(dto.enemySpecies)) save.pokedex.seen.push(dto.enemySpecies);

    const result: Omit<SettleResult, 'version' | 'data'> = { coinsGained: 0, expGained, caught, caughtMonster, events };
    const outcome = await this.persist(uid, save, result);
    if (outcome.code === ERR.OK && outcome.data) {
      const { version, data, ...rest } = outcome.data;
      this.settled.set(dto.battleId, rest as SettleResult);
    }
    return outcome;
  }
}
