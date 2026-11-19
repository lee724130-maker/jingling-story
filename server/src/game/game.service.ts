/* 服务端权威结算：战斗/捕获的所有奖励由服务端按共享规则重算，
 * 客户端只上报战斗上下文与随机种子，不信任客户端算出的经验/金币/捕获结果。 */
import { Injectable } from '@nestjs/common';
import { store } from '../common/store';
import {
  ERR, SaveData, Monster, BattleSettleDto, CaptureSettleDto, SettleResult,
  QuestClaimDto, QuestClaimResult, ChooseStarterDto, ChooseStarterResult,
  ShopBuyDto, ShopBuyResult, ExploreDto, ExploreResult
} from '../../../shared/types';
import { seededRandom, captureRate, grantExp, makeMonster, checksum } from '../../../shared/rules';
import { MONSTERS } from '../../../shared/gamedata';
import { QUESTS, questFlag } from '../../../shared/quests';
import { STARTER_CHOICES, SHOP_ITEMS } from '../../../shared/maps';
import { DUNGEONS, isDungeonId, isDungeonUnlocked, pickWeighted, type DungeonId } from '../../../shared/dungeons';
import { ITEMS } from '../../../shared/gamedata';

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
  // 探索幂等键：已判定的 exploreId -> 结果（防止重复点击刷物品）
  private explored = new Map<string, ExploreResult>();

  /** 探索校验和：字段顺序固定 */
  private explorePayload(d: ExploreDto) {
    return [d.exploreId, d.dungeonId, d.seed].join('|');
  }

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

  /** 任务奖励领取：按权威存档校验条件是否达成，防重复领取，发奖后 version+1。
   *  客户端无法伪造进度——步数/胜场/图鉴/等级全部来自服务端存档。 */
  async claimQuest(uid: number, dto: QuestClaimDto): Promise<{ code: number; message: string; data: QuestClaimResult | null }> {
    if (!uid || !dto?.questId) return { code: ERR.BAD_PARAMS, message: '参数不完整', data: null };
    const def = QUESTS.find(q => q.id === dto.questId);
    if (!def) return { code: ERR.BAD_PARAMS, message: '任务不存在', data: null };

    const row = await store.getSave(uid);
    if (!row) return { code: ERR.BAD_PARAMS, message: '存档不存在', data: null };
    const save: SaveData = JSON.parse(JSON.stringify(row.data));

    // 防重复领取
    if (save.progress.flags.includes(questFlag(def.id))) {
      return { code: ERR.DUPLICATE_SETTLE, message: '该任务奖励已领取', data: null };
    }
    // 条件校验：从权威存档实时计算，客户端无法伪造
    if (def.progress(save) < def.goal) {
      return { code: ERR.BAD_PARAMS, message: '任务尚未完成', data: null };
    }

    // 发奖
    const r = def.reward;
    if (r.coins) save.resources.coins += r.coins;
    if (r.ball) save.bag.ball = (save.bag.ball || 0) + r.ball;
    if (r.herb) save.bag.herb = (save.bag.herb || 0) + r.herb;
    save.progress.flags.push(questFlag(def.id));

    const nextVersion = row.version + 1;
    const written = await store.putSave(uid, nextVersion, save);
    return {
      code: ERR.OK, message: 'ok',
      data: { questId: def.id, reward: r, version: written.version, data: written.data }
    };
  }

  /** 选择初始伙伴：三选一白名单校验，服务端生成精灵（性别/性格由种子随机），防重复选择。
   *  老账号（已有精灵）也允许补选一次，但已有队伍时不覆盖。 */
  async chooseStarter(uid: number, dto: ChooseStarterDto): Promise<{ code: number; message: string; data: ChooseStarterResult | null }> {
    if (!uid || !dto || !dto.species) return { code: ERR.BAD_PARAMS, message: '参数不完整', data: null };
    if (!STARTER_CHOICES.some(c => c.species === dto.species)) {
      return { code: ERR.BAD_PARAMS, message: '无效的初始伙伴', data: null };
    }
    if (dto.gender !== 'male' && dto.gender !== 'female') {
      return { code: ERR.BAD_PARAMS, message: '无效性别', data: null };
    }
    const row = await store.getSave(uid);
    if (!row) return { code: ERR.BAD_PARAMS, message: '存档不存在', data: null };
    const save: SaveData = JSON.parse(JSON.stringify(row.data));

    if (save.progress.flags.includes('story:starter_chosen') || save.team.length > 0) {
      return { code: ERR.DUPLICATE_SETTLE, message: '已选择过初始伙伴', data: null };
    }

    const seed = Math.floor(Math.random() * 1e9);
    const monster = makeMonster(dto.species, 5, seededRandom(seed), { gender: dto.gender });
    save.team.push(monster);
    if (!save.pokedex.seen.includes(dto.species)) save.pokedex.seen.push(dto.species);
    if (!save.pokedex.caught.includes(dto.species)) save.pokedex.caught.push(dto.species);
    save.progress.flags.push('story:starter_chosen');
    save.progress.flags = save.progress.flags.filter(f => f !== 'story:need_starter');

    const nextVersion = row.version + 1;
    const written = await store.putSave(uid, nextVersion, save);
    return {
      code: ERR.OK, message: 'ok',
      data: { monster, version: written.version, data: written.data }
    };
  }

  /** 商店购买：服务端按 SHOP_ITEMS 权威定价，校验余额后扣钱加道具 */
  async shopBuy(uid: number, dto: ShopBuyDto): Promise<{ code: number; message: string; data: ShopBuyResult | null }> {
    if (!uid || !dto?.item || !dto.count) return { code: ERR.BAD_PARAMS, message: '参数不完整', data: null };
    const item = SHOP_ITEMS[dto.item];
    if (!item) return { code: ERR.BAD_PARAMS, message: '商品不存在', data: null };
    if (dto.count < 1 || dto.count > 99) return { code: ERR.BAD_PARAMS, message: '数量非法', data: null };

    const row = await store.getSave(uid);
    if (!row) return { code: ERR.BAD_PARAMS, message: '存档不存在', data: null };
    const save: SaveData = JSON.parse(JSON.stringify(row.data));
    const cost = item.price * dto.count;
    if (save.resources.coins < cost) return { code: ERR.BAD_PARAMS, message: '金币不足', data: null };

    save.resources.coins -= cost;
    save.bag[dto.item] = (save.bag[dto.item] || 0) + dto.count;
    const nextVersion = row.version + 1;
    const written = await store.putSave(uid, nextVersion, save);
    return {
      code: ERR.OK, message: 'ok',
      data: { item: dto.item, count: dto.count, cost, version: written.version, data: written.data }
    };
  }

  /** 副本探索：按服务端种子权威判定结果（精灵/物品/空）。
   *  - 精灵：只返回遭遇信息供前端进战斗，不改队伍（捕获走既有战斗结算）；权威补 seen 图鉴。
   *  - 物品：服务端直接发放到权威存档（金币/灵兽球/活力草）。
   *  - 空：不改存档。
   *  客户端仅上报 dungeonId/种子/校验和，无法伪造概率或奖励；exploreId 幂等防重复刷。 */
  async explore(uid: number, dto: ExploreDto): Promise<{ code: number; message: string; data: ExploreResult | null }> {
    if (!uid || !dto?.exploreId || !dto.dungeonId || !Number.isFinite(dto.seed)) {
      return { code: ERR.BAD_PARAMS, message: '参数不完整', data: null };
    }
    if (checksum(this.explorePayload(dto)) !== dto.clientChecksum) {
      return { code: ERR.CHECKSUM_FAILED, message: '校验和不符，疑似篡改', data: null };
    }
    if (this.explored.has(dto.exploreId)) {
      return { code: ERR.DUPLICATE_SETTLE, message: '该次探索已结算', data: this.explored.get(dto.exploreId)! };
    }
    if (!isDungeonId(dto.dungeonId)) return { code: ERR.BAD_PARAMS, message: '副本不存在', data: null };
    const def = DUNGEONS[dto.dungeonId as DungeonId];

    const row = await store.getSave(uid);
    if (!row) return { code: ERR.BAD_PARAMS, message: '存档不存在', data: null };
    const save: SaveData = JSON.parse(JSON.stringify(row.data));
    if (!isDungeonUnlocked(def, save.progress.flags)) {
      return { code: ERR.BAD_PARAMS, message: '副本尚未解锁', data: null };
    }

    // 每次探索记 1 步（新玩法无移动，探索即冒险行动，用于推进"启程"任务）
    save.profile.steps = (save.profile.steps || 0) + 1;

    const rng = seededRandom(dto.seed + 2026);
    const roll = rng();
    let version = row.version;

    if (roll < def.rates.monster) {
      // 遇敌：按副本权重池抽物种与等级，只补 seen 图鉴，不写队伍
      const pick = pickWeighted(def.encounters, rng);
      const level = def.level[0] + Math.floor(rng() * (def.level[1] - def.level[0] + 1));
      if (!save.pokedex.seen.includes(pick.species)) save.pokedex.seen.push(pick.species);
      const written = await store.putSave(uid, version + 1, save);
      version = written.version;
      const result: ExploreResult = {
        exploreId: dto.exploreId, dungeonId: def.id, kind: 'monster',
        encounter: { species: pick.species, level, name: MONSTERS[pick.species].name },
        text: `野生的 ${MONSTERS[pick.species].name} 出现了！`,
        version, data: written.data
      };
      this.explored.set(dto.exploreId, result);
      return { code: ERR.OK, message: 'ok', data: result };
    }

    if (roll < def.rates.monster + def.rates.item) {
      // 物品：按权重抽奖励并权威发放
      const reward = pickWeighted(def.items, rng);
      const amount = reward.min + Math.floor(rng() * (reward.max - reward.min + 1));
      let name = '';
      if (reward.item === 'coins') { save.resources.coins += amount; name = '灵石'; }
      else if (reward.item === 'ball') { save.bag.ball = (save.bag.ball || 0) + amount; name = ITEMS.ball.name; }
      else if (reward.item === 'herb') { save.bag.herb = (save.bag.herb || 0) + amount; name = ITEMS.herb.name; }
      const written = await store.putSave(uid, version + 1, save);
      version = written.version;
      const result: ExploreResult = {
        exploreId: dto.exploreId, dungeonId: def.id, kind: 'item',
        reward: { item: reward.item, amount, name },
        text: `探索发现了 ${name} ×${amount}！`,
        version, data: written.data
      };
      this.explored.set(dto.exploreId, result);
      return { code: ERR.OK, message: 'ok', data: result };
    }

    // 空手而归：仅记录步数，不发奖励
    const written = await store.putSave(uid, version + 1, save);
    const result: ExploreResult = {
      exploreId: dto.exploreId, dungeonId: def.id, kind: 'nothing',
      text: '四处搜寻，但没有发现任何东西……',
      version: written.version, data: written.data
    };
    this.explored.set(dto.exploreId, result);
    return { code: ERR.OK, message: 'ok', data: result };
  }
}
