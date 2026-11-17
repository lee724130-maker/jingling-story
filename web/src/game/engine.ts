/* 精灵物语 · 游戏引擎：地图探索（可见野怪）+ 投球出战动画 + 回合战斗，纯逻辑，通过 onUpdate 通知 React */
import type { Monster, SaveData, BattleSettleDto, CaptureSettleDto, SettleResult } from '@shared/types';
import { TILE, SKILLS, TYPES, TYPE_CHART, MONSTERS, ENCOUNTERS } from './config';
import { isWalkable } from './sprites';
import { rnd, newMonster, maxHpFor } from './model';
import { checksum, seededRandom, captureRate, grantExp } from '@shared/rules';
import { MAPS, MAPS as MAP_DEF, type MapId, type NpcDef } from '@shared/maps';
import { api } from '../api/client';
import type { SkillFx } from './battleFx';

export type Scene = 'world' | 'summon' | 'battle';
export type SummonPhase = 'appear' | 'throw' | 'burst' | 'ready';

/** 地图上的野生精灵：可见、会游荡、走近才触发遭遇 */
export interface WildSpirit {
  id: string;
  species: number;
  level: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  dir: number;
  bob: number;
  wait: number;
  alert: number;
}

/** 投球出战过场动画 */
export interface SummonView {
  phase: SummonPhase;
  t: number;
  enemy: { species: number; level: number; x: number; y: number };
  allySpecies: number;
  allyName: string;
}

export interface BattleView {
  enemy: Monster;
  ally: Monster;
  message: string;
  options: string[];
  mode: 'main' | 'skills';
  allyFx: 'idle' | 'attack' | 'hurt' | 'heal';
  enemyFx: 'idle' | 'attack' | 'hurt';
  ballFx: { t: number; caught: boolean } | null;
  skillFx: SkillFx | null;
  skillName: string;   // 当前施放的技能名，用于战斗 UI 横幅提示
}

/** 战斗场景里两只精灵的站位（与 App.tsx Canvas 绘制一致），用于技能特效起止点 */
const BATTLE_POS = { ally: { x: 165, y: 300 }, enemy: { x: 470, y: 130 } };
const SKILL_FX_DUR = 620;

export interface EngineState {
  scene: Scene;
  player: { x: number; y: number; dir: number; walking: boolean; running: boolean; moveAngle: number };
  message: string;
  battle: BattleView | null;
  summon: SummonView | null;
  wilds: WildSpirit[];
}

const WILD_COUNT = 6;
const WILD_SPEED = 0.55;
const SUMMON_DUR: Record<SummonPhase, number> = { appear: 700, throw: 620, burst: 700, ready: 620 };

/** 当前地图定义（按存档 progress.map 动态取） */
function mapOf(id: string) { return MAP_DEF[id as MapId] || MAP_DEF.qingya; }

export class GameEngine {
  save: SaveData;
  state: EngineState;
  version = 0;
  private keys: Record<string, boolean> = {};
  /** 点击地面移动的目标点（像素坐标），null 表示无目标 */
  private moveTarget: { x: number; y: number } | null = null;
  /** 是否小跑（Shift+点击 或 Shift+WASD） */
  private running = false;
  /** 点击寻路撞墙累计帧，用于不可达保护 */
  private stuckFrames = 0;
  private healUsed = false;
  private frame = 0;
  private raf = 0;
  private lastT = 0;
  private wildSeq = 0;
  private activeWild: WildSpirit | null = null;
  private cooldown = 0;
  private allyIndex = 0;
  // 权威结算上下文
  private battleId = '';
  private battleSeed = 0;
  private rounds = 0;
  private herbsUsed = 0;
  private settled = false;
  private fxSeq = 0;
  onUpdate: (s: EngineState) => void = () => {};
  onSaveDirty: () => void = () => {};
  onDialog: (lines: string[]) => void = () => {};
  /** 结算后服务端返回了权威存档与版本，通知 App 同步（避免旧版本回写覆盖） */
  onAuthoritativeSave: (save: SaveData, version: number) => void = () => {};
  /** 是否启用服务端权威结算（默认开，网络失败时内部降级） */
  useServerSettle = true;

  // 场景切换/NPC 交互回调，交给 React 层处理 UI
  onSceneChange: (mapId: MapId, name: string) => void = () => {};
  onNpcInteract: (npc: NpcDef) => void = () => {};

  /* ---------- 当前地图派生数据（全部基于 save.progress.map） ---------- */
  private get map() { return mapOf(this.save.progress.map); }
  private get COLS() { return this.map.grid[0].length; }
  private get ROWS() { return this.map.grid.length; }
  private cellAt(c: number, r: number) {
    return (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) ? '#' : this.map.grid[r][c];
  }
  private isGrass(c: number, r: number) {
    const ch = this.cellAt(c, r);
    return (ch === '.' || ch === 'E' || ch === 'N' || ch === 'B' || ch === 'P' || ch === 'H' || ch === 'S');
  }
  private findStart(): { x: number; y: number } {
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++)
      if (this.cellAt(c, r) === 'S') return { x: c, y: r };
    return { x: 2, y: 2 };
  }
  private grassTiles(): { c: number; r: number }[] {
    const out: { c: number; r: number }[] = [];
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++)
      if (this.isGrass(c, r)) out.push({ c, r });
    return out;
  }

  constructor(save: SaveData, version: number) {
    this.save = save; this.version = version;
    if (!this.save.progress.map) this.save.progress.map = 'qingya';
    const st = this.findStart();
    this.state = {
      scene: 'world',
      player: { x: st.x * TILE + TILE / 2, y: st.y * TILE + TILE / 2 - 4, dir: 1, walking: false, running: false, moveAngle: 0 },
      message: '', battle: null, summon: null, wilds: []
    };
    this.initWilds();
  }

  start() { this.lastT = performance.now(); this.loop(this.lastT); }
  stop() { cancelAnimationFrame(this.raf); }
  setKey(k: string, v: boolean) { this.keys[k] = v; }
  getFrame() { return this.frame; }

  /** 左键点击地面：设置移动目标（像素坐标）。会立即清除键盘方向键的持续输入 */
  setMoveTarget(px: number, py: number, running = false) {
    this.moveTarget = { x: px, y: py };
    this.running = running;
    this.keys.up = this.keys.down = this.keys.left = this.keys.right = false;
  }
  /** 停止自动寻路（手动 WASD / 交互 / 切场景时调用） */
  clearMoveTarget() { this.moveTarget = null; this.running = false; this.state.player.running = false; }
  /** 设置小跑状态（Shift 键，作用于 WASD 与点击移动） */
  setRun(v: boolean) { this.running = v; if (!this.moveTarget) this.state.player.running = v; }

  private loop = (t: number) => {
    const dt = Math.min(40, t - this.lastT || 16); this.lastT = t;
    this.frame += 0.15;
    this.update(dt);
    this.onUpdate(this.state);
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.state.scene === 'world') this.updateWorld(dt);
    else if (this.state.scene === 'summon') this.updateSummon(dt);
    else if (this.state.scene === 'battle') {
      const b = this.state.battle;
      if (b?.ballFx) b.ballFx.t += dt;
      if (b?.skillFx) {
        b.skillFx.t = performance.now() - b.skillFx.startAt;
        if (b.skillFx.t >= b.skillFx.duration) b.skillFx = null;
      }
    }
  }

  // ---------- 地图野生精灵 ----------
  private pickEncounter() {
    let total = 0; ENCOUNTERS.forEach(e => total += e.w);
    let r = Math.random() * total, pick = ENCOUNTERS[0];
    for (const e of ENCOUNTERS) { r -= e.w; if (r <= 0) { pick = e; break; } }
    return pick;
  }

  private spawnWild(tiles: { c: number; r: number }[], avoid: { x: number; y: number }): WildSpirit {
    const pick = this.pickEncounter();
    let tile = tiles[rnd(0, tiles.length - 1)];
    for (let k = 0; k < 24 && Math.abs(tile.c - avoid.x) < 3 && Math.abs(tile.r - avoid.y) < 3; k++) {
      tile = tiles[rnd(0, tiles.length - 1)];
    }
    const x = tile.c * TILE + TILE / 2, y = tile.r * TILE + TILE / 2;
    return {
      id: 'w' + (++this.wildSeq), species: pick.id, level: rnd(pick.min, pick.max),
      x, y, tx: x, ty: y, dir: Math.random() < 0.5 ? 1 : -1,
      bob: Math.random() * 6, wait: rnd(50, 180), alert: 0
    };
  }

  private initWilds() {
    this.state.wilds = [];
    if (!this.map.wilds) return; // 新手村不刷野怪
    const tiles = this.grassTiles(), start = this.findStart();
    for (let i = 0; i < WILD_COUNT; i++) this.state.wilds.push(this.spawnWild(tiles, start));
  }

  private respawnWild() {
    if (!this.activeWild) return;
    const tiles = this.grassTiles(), start = this.findStart();
    const nw = this.spawnWild(tiles, start);
    const i = this.state.wilds.indexOf(this.activeWild);
    if (i >= 0) this.state.wilds[i] = nw;
    this.activeWild = null;
  }

  private updateWilds(dt: number) {
    const stepK = dt / 16;
    for (const w of this.state.wilds) {
      w.bob += 0.13 * stepK;
      if (w.alert > 0) w.alert -= dt;
      const dx = w.tx - w.x, dy = w.ty - w.y, dist = Math.hypot(dx, dy);
      if (dist < 1) {
        w.x = w.tx; w.y = w.ty;
        w.wait -= stepK;
        if (w.wait <= 0) {
          const c = Math.floor(w.x / TILE), r = Math.floor(w.y / TILE);
          const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .map(([dc, dr]) => ({ c: c + dc, r: r + dr }))
            .filter(t => this.isGrass(t.c, t.r));
          if (opts.length) {
            const t = opts[rnd(0, opts.length - 1)];
            w.tx = t.c * TILE + TILE / 2; w.ty = t.r * TILE + TILE / 2;
            if (t.c !== c) w.dir = t.c > c ? 1 : -1;
          }
          w.wait = rnd(70, 200);
        }
      } else {
        const step = Math.min(dist, WILD_SPEED * stepK);
        w.x += dx / dist * step; w.y += dy / dist * step;
      }
      const p = this.state.player;
      const near = Math.hypot(w.x - p.x, w.y - p.y);
      if (near < 46 && w.alert <= 0) w.alert = 500;
      if (near < 20 && this.cooldown <= 0) { this.beginEncounter(w); break; }
    }
  }

  /** 玩家所在格子是否有 NPC（用于交互提示） */
  npcNearby(): NpcDef | null {
    const p = this.state.player;
    const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
    return this.map.npcs.find(n => Math.abs(n.x - pc) <= 1 && Math.abs(n.y - pr) <= 1) || null;
  }

  /** 与附近 NPC / 任务板 / 商店交互 */
  interact() {
    const npc = this.npcNearby();
    if (npc) { this.onNpcInteract(npc); return; }
    // 出口：走到出口格子上按空格也可触发
    const p = this.state.player;
    const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
    const exit = this.map.exits.find(e => Math.abs(e.x - pc) <= 1 && Math.abs(e.y - pr) <= 1);
    if (exit) this.switchMap(exit.to, exit.spawn);
  }

  /** 切换区域：更新存档 map、重置玩家落点、重建野怪、通知 UI */
  switchMap(to: MapId, spawn?: { x: number; y: number }) {
    const dest = mapOf(to);
    this.save.progress.map = to;
    const sp = spawn || this.findStartAfterSwitch(to);
    const p = this.state.player;
    p.x = sp.x * TILE + TILE / 2; p.y = sp.y * TILE + TILE / 2 - 4;
    p.walking = false; p.running = false;
    this.clearMoveTarget();
    this.activeWild = null;
    this.cooldown = 1500; // 切图后短暂冷却，避免立刻触发遭遇
    this.initWilds();
    this.onSceneChange(to, dest.name);
    this.onSaveDirty();
  }

  private findStartAfterSwitch(to: MapId) {
    const g = mapOf(to).grid;
    for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++)
      if (g[r][c] === 'S') return { x: c, y: r };
    return { x: 2, y: 2 };
  }

  /** 尝试把玩家移动 (dx,dy)*speed，带元胞碰撞与轴向滑动；返回实际是否移动 */
  private tryMovePlayer(dx: number, dy: number, speed: number): boolean {
    const p = this.state.player;
    const r = 9; // 碰撞半径（像素）
    const canStand = (px: number, py: number) => {
      const col = Math.floor(px / TILE), row = Math.floor(py / TILE);
      // 四角探测，确保角色体积不穿墙
      return isWalkable(this.cellAt(col, row))
        && isWalkable(this.cellAt(Math.floor((px - r) / TILE), Math.floor((py - r) / TILE)))
        && isWalkable(this.cellAt(Math.floor((px + r) / TILE), Math.floor((py - r) / TILE)))
        && isWalkable(this.cellAt(Math.floor((px - r) / TILE), Math.floor((py + r) / TILE)))
        && isWalkable(this.cellAt(Math.floor((px + r) / TILE), Math.floor((py + r) / TILE)));
    };
    const beforeX = p.x, beforeY = p.y;
    let moved = false;
    const nx = p.x + dx * speed, ny = p.y + dy * speed;
    if (canStand(nx, ny)) { p.x = nx; p.y = ny; moved = true; }
    else {
      // 轴向滑动：贴墙时仍可沿另一轴移动
      if (dx && canStand(p.x + dx * speed, p.y)) { p.x += dx * speed; moved = true; }
      if (dy && canStand(p.x, p.y + dy * speed)) { p.y += dy * speed; moved = true; }
    }
    if (moved) {
      // 按实际位移方向记录朝向角（像素坐标系 x 右为正、y 下为正；atan2(dx,dy) 与 3D rotation.y 对应）
      const ax = p.x - beforeX, ay = p.y - beforeY;
      if (Math.abs(ax) > 1e-4 || Math.abs(ay) > 1e-4) p.moveAngle = Math.atan2(ax, ay);
      if (dx) p.dir = dx > 0 ? 1 : -1;
    }
    return moved;
  }

  /** 玩家踏入格子后的结算：疗伤、出口切换、步数 */
  private afterPlayerStep() {
    const p = this.state.player;
    this.save.profile.steps++;
    const col = Math.floor(p.x / TILE), row = Math.floor(p.y / TILE), ch = this.cellAt(col, row);
    if (ch === 'H' && !this.healUsed) {
      this.healUsed = true;
      this.save.lastHeal = { x: col, y: row };
      this.save.team.forEach(m => m.hp = m.maxHp);
      this.onDialog(['疗伤石碑亮起柔和的光芒……', '全队精灵的生命已完全恢复！']);
      setTimeout(() => this.healUsed = false, 100);
      this.onSaveDirty();
    }
    if (ch === 'E' && this.cooldown <= 0) {
      const exit = this.map.exits.find(e => e.x === col && e.y === row);
      if (exit) { this.clearMoveTarget(); this.switchMap(exit.to, exit.spawn); }
    }
  }

  private updateWorld(dt: number) {
    if (this.cooldown > 0) this.cooldown -= dt;
    const p = this.state.player;
    let dx = 0, dy = 0;
    const kbUp = this.keys.up, kbDown = this.keys.down, kbLeft = this.keys.left, kbRight = this.keys.right;
    if (kbUp) dy = -1; else if (kbDown) dy = 1; else if (kbLeft) dx = -1; else if (kbRight) dx = 1;

    // 键盘输入优先，接管后清除点击目标
    if (dx || dy) {
      if (this.moveTarget) this.clearMoveTarget();
      const speed = (this.running ? 3.7 : 2.3) * (dt / 16);
      p.walking = this.tryMovePlayer(dx, dy, speed);
      p.running = this.running && p.walking;
      if (p.walking) this.afterPlayerStep();
    } else if (this.moveTarget) {
      // 点击地面自动寻路（直线 + 轴向滑动绕障）
      const tx = this.moveTarget.x, ty = this.moveTarget.y;
      const dist = Math.hypot(tx - p.x, ty - p.y);
      if (dist < 6) {
        this.clearMoveTarget();
        p.walking = false; p.running = false;
      } else {
        const speed = (this.running ? 3.7 : 2.3) * (dt / 16);
        const ux = (tx - p.x) / dist, uy = (ty - p.y) / dist;
        p.walking = this.tryMovePlayer(ux, uy, speed);
        p.running = this.running && p.walking;
        if (p.walking) this.afterPlayerStep();
        // 卡墙超时保护：目标不可达时避免永久移动
        this.stuckFrames = p.walking ? 0 : this.stuckFrames + 1;
        if (this.stuckFrames > 24) { this.clearMoveTarget(); p.walking = false; p.running = false; this.stuckFrames = 0; }
      }
    } else {
      p.walking = false; p.running = false;
    }
    this.updateWilds(dt);
  }

  // ---------- 投球出战过场 ----------
  private beginEncounter(w: WildSpirit) {
    this.clearMoveTarget();
    this.state.player.walking = false;
    this.activeWild = w;
    w.alert = 2000;
    this.allyIndex = Math.max(0, this.save.team.findIndex(m => m.hp > 0));
    const ally = this.save.team[this.allyIndex];
    this.state.scene = 'summon';
    this.state.summon = {
      phase: 'appear', t: 0,
      enemy: { species: w.species, level: w.level, x: w.x, y: w.y },
      allySpecies: ally?.species ?? 1,
      allyName: ally ? MONSTERS[ally.species].name : '精灵'
    };
    if (!this.save.pokedex.seen.includes(w.species)) this.save.pokedex.seen.push(w.species);
    this.onSaveDirty();
  }

  private updateSummon(dt: number) {
    const s = this.state.summon; if (!s) return;
    s.t += dt;
    if (s.t >= SUMMON_DUR[s.phase]) {
      s.t = 0;
      if (s.phase === 'appear') s.phase = 'throw';
      else if (s.phase === 'throw') s.phase = 'burst';
      else if (s.phase === 'burst') s.phase = 'ready';
      else this.enterBattle();
    }
  }

  /** 字幕：给 SummonUI 显示 */
  summonCaption(): string {
    const s = this.state.summon; if (!s) return '';
    const en = MONSTERS[s.enemy.species].name;
    if (s.phase === 'appear') return `野生的 ${en} 挡住了去路！`;
    if (s.phase === 'throw') return '去吧，精灵球！';
    if (s.phase === 'burst') return '';
    return `就是你了，${s.allyName}！`;
  }

  private resetBattleContext() {
    this.battleId = 'b_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
    this.battleSeed = Math.floor(Math.random() * 1e9);
    this.rounds = 0; this.herbsUsed = 0; this.settled = false;
  }

  private enterBattle() {
    const s = this.state.summon; if (!s) return;
    this.resetBattleContext();
    const base = MONSTERS[s.enemy.species], maxHp = maxHpFor(s.enemy.species, s.enemy.level);
    const enemy: Monster = {
      id: 'wild_' + Date.now(), species: s.enemy.species, level: s.enemy.level, exp: 0, iv: [8, 8, 8, 8],
      skills: [...base.skills], hp: maxHp, maxHp, gender: Math.random() < 0.5 ? 'male' : 'female', nature: '野生'
    };
    this.state.summon = null;
    this.state.scene = 'battle';
    this.state.battle = {
      enemy, ally: this.save.team[this.allyIndex], message: `野生的 ${base.name} 出现了！`,
      options: ['技能', '灵兽球', '活力草', '逃跑'], mode: 'main',
      allyFx: 'idle', enemyFx: 'idle', ballFx: null, skillFx: null, skillName: ''
    };
  }

  /** 保留：直接进战斗（调试/特殊事件用），正常地图遭遇走上面的过场 */
  startBattle(speciesId: number, level: number) {
    this.resetBattleContext();
    const base = MONSTERS[speciesId], maxHp = maxHpFor(speciesId, level);
    const enemy: Monster = {
      id: 'wild_' + Date.now(), species: speciesId, level, exp: 0, iv: [8, 8, 8, 8],
      skills: [...base.skills], hp: maxHp, maxHp, gender: Math.random() < 0.5 ? 'male' : 'female', nature: '野生'
    };
    this.allyIndex = Math.max(0, this.save.team.findIndex(m => m.hp > 0));
    this.state.scene = 'battle';
    this.state.battle = {
      enemy, ally: this.save.team[this.allyIndex], message: `野生的 ${base.name} 出现了！`,
      options: ['技能', '灵兽球', '活力草', '逃跑'], mode: 'main',
      allyFx: 'idle', enemyFx: 'idle', ballFx: null, skillFx: null, skillName: ''
    };
    if (!this.save.pokedex.seen.includes(speciesId)) this.save.pokedex.seen.push(speciesId);
    this.onSaveDirty();
  }

  // ---------- 战斗 ----------
  private damage(attacker: Monster, defender: Monster, skillId: string) {
    const sk = SKILLS[skillId];
    const atk = MONSTERS[attacker.species].base.atk + attacker.level + (attacker.iv?.[1] || 0);
    const def = MONSTERS[defender.species].base.def + defender.level;
    let dmg = Math.floor(((2 * attacker.level / 5 + 2) * sk.power * (atk / def)) / 50 + 2);
    let mult = (TYPE_CHART[sk.type]?.[MONSTERS[defender.species].type]) || 1;
    if (sk.type === MONSTERS[attacker.species].type) mult *= 1.3;
    dmg = Math.floor(dmg * mult * (0.85 + Math.random() * 0.3));
    return { dmg: Math.max(1, dmg), mult };
  }

  private setBattleMsg(msg: string) { if (this.state.battle) this.state.battle.message = msg; }

  /** 生成技能特效并挂到战斗视图上（起止点按施法方/目标站位） */
  private spawnSkillFx(skillId: string, caster: 'ally' | 'enemy') {
    const b = this.state.battle; if (!b) return;
    const sk = SKILLS[skillId];
    const from = caster === 'ally' ? BATTLE_POS.ally : BATTLE_POS.enemy;
    const to = caster === 'ally' ? BATTLE_POS.enemy : BATTLE_POS.ally;
    b.skillFx = {
      skillId, type: sk.type, kind: sk.kind, power: sk.power,
      fromX: from.x, fromY: from.y, toX: to.x, toY: to.y,
      t: 0, duration: SKILL_FX_DUR, seq: ++this.fxSeq, startAt: performance.now()
    };
  }

  battleAction(action: 'fight' | 'ball' | 'herb' | 'run' | 'back' | 'skill', skillIdx?: number) {
    const b = this.state.battle; if (!b || b.ballFx) return;
    if (action === 'skill') { if (skillIdx !== undefined) this.useSkill(skillIdx); return; }
    if (action === 'fight') { b.mode = 'skills'; return; }
    if (action === 'back') { b.mode = 'main'; return; }
    if (action === 'ball') return this.throwBall();
    if (action === 'herb') return this.useHerb();
    if (action === 'run') return this.runAway();
  }

  useSkill(idx: number) {
    const b = this.state.battle; if (!b) return;
    const sid = b.ally.skills[idx], sk = SKILLS[sid];
    this.setBattleMsg(`${MONSTERS[b.ally.species].name} 使用了 ${sk.name}！`);
    b.skillName = sk.name;
    b.allyFx = 'attack'; b.enemyFx = 'idle';
    this.spawnSkillFx(sid, 'ally');
    setTimeout(() => {
      if (!this.state.battle) return;
      b.allyFx = 'idle';
      if (sk.kind === 'heal') {
        const heal = Math.floor(b.ally.maxHp * (sk.value || 0.5));
        b.ally.hp = Math.min(b.ally.maxHp, b.ally.hp + heal);
        b.allyFx = 'heal';
        this.setBattleMsg(`${MONSTERS[b.ally.species].name} 回复了生命！`);
        setTimeout(() => { if (!this.state.battle) return; b.allyFx = 'idle'; this.enemyTurn(); }, 500);
      } else {
        const res = this.damage(b.ally, b.enemy, sid);
        b.enemy.hp -= res.dmg;
        b.enemyFx = 'hurt';
        let msg = `造成 ${res.dmg} 点伤害`;
        if (res.mult >= 2) msg += '，效果拔群！'; else if (res.mult <= 0.5) msg += '，效果不佳…'; else msg += '。';
        this.setBattleMsg(msg);
        if (b.enemy.hp <= 0) { setTimeout(() => this.win(), 700); return; }
        setTimeout(() => {
          if (!this.state.battle) return;
          b.enemyFx = 'idle';
          this.enemyTurn();
        }, 420);
      }
    }, 384);
  }

  private enemyTurn() {
    const b = this.state.battle; if (!b || b.enemy.hp <= 0) return;
    this.rounds++;
    const pool = b.enemy.skills.filter(s => SKILLS[s] && SKILLS[s].kind === 'dmg');
    const sid = pool[rnd(0, pool.length - 1)] || 'tackle';
    this.setBattleMsg(`野生 ${MONSTERS[b.enemy.species].name} 使用了 ${SKILLS[sid].name}！`);
    b.skillName = SKILLS[sid].name;
    b.enemyFx = 'attack';
    this.spawnSkillFx(sid, 'enemy');
    setTimeout(() => {
      if (!this.state.battle) return;
      b.enemyFx = 'idle';
      const res = this.damage(b.enemy, b.ally, sid);
      b.ally.hp -= res.dmg;
      b.allyFx = 'hurt';
      let msg = `受到 ${res.dmg} 点伤害`;
      if (res.mult >= 2) msg += '，效果拔群！'; else if (res.mult <= 0.5) msg += '，效果不佳…'; else msg += '。';
      this.setBattleMsg(msg);
      if (b.ally.hp <= 0) { b.ally.hp = 0; setTimeout(() => this.allyFainted(), 700); return; }
      setTimeout(() => { if (!this.state.battle) return; b.allyFx = 'idle'; b.mode = 'main'; this.onSaveDirty(); }, 420);
    }, 380);
  }

  private throwBall() {
    const b = this.state.battle; if (!b || this.settled || b.ballFx) return;
    if (!this.save.bag.ball) { this.setBattleMsg('没有灵兽球了！'); return; }
    this.setBattleMsg('掷出了灵兽球……');
    // 用同一种子本地预测捕获结果，仅用于球的摇晃/发光动画，保证流畅
    const rate = captureRate(b.enemy.hp, b.enemy.maxHp);
    const predicted = seededRandom(this.battleSeed + 707)() < rate;
    b.ballFx = { t: 0, caught: predicted };
    const dto: CaptureSettleDto = {
      battleId: this.battleId, enemySpecies: b.enemy.species, enemyLevel: b.enemy.level,
      enemyHp: b.enemy.hp, enemyMaxHp: b.enemy.maxHp, allyIndex: this.allyIndex,
      seed: this.battleSeed, clientChecksum: ''
    };
    const payload = [dto.battleId, dto.enemySpecies, dto.enemyLevel, dto.enemyHp, dto.enemyMaxHp, dto.allyIndex, dto.seed].join('|');
    dto.clientChecksum = checksum(payload);
    const enemySpecies = b.enemy.species, ally = b.ally;

    // 动画播放 1.9s，期间异步请求服务端权威判定
    const settlePromise = this.useServerSettle
      ? api.settleCapture(dto).catch(() => null)
      : Promise.resolve(null);

    setTimeout(async () => {
      if (!this.state.battle) return;
      b.ballFx = null;
      const res = await settlePromise;
      if (res && res.ok && res.result) {
        const authoritative = res.result;
        this.applyAuthoritative(authoritative);
        this.settled = true;
        if (authoritative.caught) {
          this.setBattleMsg(`啪！捕获成功！${MONSTERS[enemySpecies].name} 加入了队伍。`);
          authoritative.events.filter(e => e.type !== 'info').forEach(e => this.onDialog([e.text]));
          setTimeout(() => this.endBattle(), 1100);
        } else {
          this.setBattleMsg('可惜！它挣脱了灵兽球！');
          // 权威存档已扣球/写入，继续战斗需保持引用为权威存档里的精灵
          b.ally = this.save.team[this.allyIndex] || ally;
          setTimeout(() => this.enemyTurn(), 700);
        }
      } else {
        // 降级：网络失败时本地判定（其他字段仍本地计算，保证可玩）
        this.settled = true;
        this.save.bag.ball = Math.max(0, this.save.bag.ball - 1);
        if (predicted) {
          this.setBattleMsg(`啪！捕获成功！${MONSTERS[enemySpecies].name} 加入了队伍。`);
          if (!this.save.pokedex.caught.includes(enemySpecies)) this.save.pokedex.caught.push(enemySpecies);
          const c = newMonster(enemySpecies, b.enemy.level, { gender: b.enemy.gender, nature: b.enemy.nature });
          if (this.save.team.length < 6) this.save.team.push(c); else this.save.storage.push(c);
          this.gainExp(ally, Math.floor(b.enemy.level * 8));
          this.onSaveDirty();
          setTimeout(() => this.endBattle(), 1100);
        } else {
          this.setBattleMsg('可惜！它挣脱了灵兽球！');
          setTimeout(() => this.enemyTurn(), 700);
        }
      }
    }, 1900);
  }

  private useHerb() {
    const b = this.state.battle; if (!b) return;
    if (!this.save.bag.herb) { this.setBattleMsg('没有活力草了！'); return; }
    this.save.bag.herb--;
    this.herbsUsed++;
    const heal = Math.floor(b.ally.maxHp * 0.5);
    b.ally.hp = Math.min(b.ally.maxHp, b.ally.hp + heal);
    b.allyFx = 'heal';
    this.setBattleMsg(`${MONSTERS[b.ally.species].name} 回复了 ${heal} 点生命！`);
    // 草药消耗随战斗结算由服务端权威扣除，此处不单独提交，避免覆盖结算结果
    setTimeout(() => { if (!this.state.battle) return; b.allyFx = 'idle'; this.enemyTurn(); }, 900);
  }

  /** 用服务端返回的权威存档整体覆盖本地，并同步 version（防止旧存档回写覆盖结算） */
  private applyAuthoritative(res: SettleResult) {
    this.save = res.data;
    this.version = res.version;
    this.onAuthoritativeSave(res.data, res.version);
  }

  /** 用服务端返回的权威存档整体覆盖本地（任务领奖等非结算场景也复用） */
  applySave(save: SaveData, version: number) {
    this.save = save;
    this.version = version;
    this.onAuthoritativeSave(save, version);
  }

  /** 战斗结束结算：win/faint/run 统一走服务端，返回权威存档 */
  private settleBattleResult(result: 'win' | 'faint' | 'run', enemySpecies: number, enemyLevel: number) {
    if (this.settled) return Promise.resolve(null);
    this.settled = true;
    const dto: BattleSettleDto = {
      battleId: this.battleId, result, enemySpecies, enemyLevel,
      allyIndex: this.allyIndex, rounds: this.rounds, herbsUsed: this.herbsUsed,
      seed: this.battleSeed, clientChecksum: ''
    };
    const payload = [dto.battleId, dto.result, dto.enemySpecies, dto.enemyLevel, dto.allyIndex, dto.rounds, dto.herbsUsed, dto.seed].join('|');
    dto.clientChecksum = checksum(payload);
    if (!this.useServerSettle) return Promise.resolve(null);
    return api.settleBattle(dto).catch(() => null);
  }

  private runAway() {
    const b = this.state.battle; if (!b) return;
    if (Math.random() < 0.7) {
      this.setBattleMsg('成功逃跑了！');
      const settle = this.settleBattleResult('run', b.enemy.species, b.enemy.level);
      setTimeout(async () => {
        const res = await settle;
        if (res && res.ok && res.result) this.applyAuthoritative(res.result);
        else { this.save.bag.herb = Math.max(0, this.save.bag.herb - this.herbsUsed); this.onSaveDirty(); }
        this.endBattle();
      }, 700);
    } else { this.setBattleMsg('没能逃走！'); setTimeout(() => this.enemyTurn(), 600); }
  }

  private win() {
    const b = this.state.battle; if (!b) return;
    const enemySpecies = b.enemy.species, enemyLevel = b.enemy.level, ally = b.ally;
    // 金币数按种子预估展示（与服务端同公式），最终以服务端返回为准
    const coinsPreview = 10 + Math.floor(seededRandom(this.battleSeed + 101)() * 16) + enemyLevel * 2;
    this.setBattleMsg(`获胜！获得 ${coinsPreview} 灵石。`);
    const settle = this.settleBattleResult('win', enemySpecies, enemyLevel);
    setTimeout(async () => {
      const res = await settle;
      if (res && res.ok && res.result) {
        const authoritative = res.result;
        this.setBattleMsg(`获胜！获得 ${authoritative.coinsGained} 灵石。`);
        this.applyAuthoritative(authoritative);
        authoritative.events.forEach(e => this.onDialog([e.text]));
        // 战斗画面精灵引用切到权威存档对象
        if (this.state.battle) this.state.battle.ally = this.save.team[this.allyIndex] || ally;
      } else {
        // 降级本地结算
        this.save.profile.battles++; this.save.profile.wins++;
        this.save.resources.coins += coinsPreview;
        this.save.bag.herb = Math.max(0, this.save.bag.herb - this.herbsUsed);
        this.gainExp(ally, Math.floor(enemyLevel * 12));
        this.onSaveDirty();
      }
      this.endBattle();
    }, 1100);
  }

  private gainExp(m: Monster, amount: number) {
    m.exp += amount;
    while (m.exp >= m.level * 22 && m.level < 50) {
      m.exp -= m.level * 22; m.level++;
      const old = m.maxHp; m.maxHp = maxHpFor(m.species, m.level); m.hp += (m.maxHp - old);
      const evo = MONSTERS[m.species].evolve;
      if (evo && m.level >= evo.lv) {
        const before = MONSTERS[m.species].name;
        m.species = evo.to; m.skills = [...MONSTERS[m.species].skills];
        const old2 = m.maxHp; m.maxHp = maxHpFor(m.species, m.level); m.hp += (m.maxHp - old2);
        if (!this.save.pokedex.seen.includes(m.species)) this.save.pokedex.seen.push(m.species);
        this.onDialog([`✨ ${before} 进化成了 ${MONSTERS[m.species].name}！`]);
      } else {
        this.onDialog([`${MONSTERS[m.species].name} 升到了 Lv.${m.level}！`]);
      }
    }
  }

  private allyFainted() {
    const alive = this.save.team.some(m => m.hp > 0);
    if (!alive) {
      this.setBattleMsg('全队都失去了战斗能力……');
      const enemy = this.state.battle?.enemy;
      const settle = enemy ? this.settleBattleResult('faint', enemy.species, enemy.level) : Promise.resolve(null);
      setTimeout(async () => {
        const res = await settle;
        if (res && res.ok && res.result) {
          this.applyAuthoritative(res.result);
        } else {
          this.save.team.forEach(m => m.hp = m.maxHp);
          this.save.bag.herb = Math.max(0, this.save.bag.herb - this.herbsUsed);
          this.onSaveDirty();
        }
        this.state.scene = 'world'; this.state.battle = null;
        const st = this.save.lastHeal.x ? this.save.lastHeal : this.findStart();
        this.state.player.x = st.x * TILE + TILE / 2; this.state.player.y = st.y * TILE + TILE / 2 - 4;
        this.cooldown = 1600; this.respawnWild();
        this.onDialog(['你在昏迷中被送回了石碑旁……', '精灵们已恢复体力，继续冒险吧！']);
      }, 1000);
    } else {
      const next = this.save.team.findIndex(m => m.hp > 0);
      this.allyIndex = next;
      if (this.state.battle) { this.state.battle.ally = this.save.team[next]; this.state.battle.allyFx = 'idle'; }
      this.setBattleMsg('选择下一只出战精灵。');
    }
  }

  switchAlly(idx: number) {
    if (!this.save.team[idx] || this.save.team[idx].hp <= 0) return;
    this.allyIndex = idx;
    if (this.state.battle) { this.state.battle.ally = this.save.team[idx]; this.state.battle.allyFx = 'idle'; }
    this.setBattleMsg(`上吧，${MONSTERS[this.save.team[idx].species].name}！`);
  }

  private endBattle() {
    this.state.scene = 'world'; this.state.battle = null;
    this.cooldown = 1600; this.respawnWild();
    this.onSaveDirty();
  }
}
