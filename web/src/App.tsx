import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api/client';
import type { SaveData, Gender, ExploreDto } from '@shared/types';
import { GameEngine, type EngineState } from './game/engine';
import { createNewSave, migrateSave } from './game/model';
import { MONSTERS, TYPES } from './game/config';
import { checksum } from '@shared/rules';
import { drawBattleSpirit, drawBall, drawBeam } from './game/sprites';
import { drawSkillFx } from './game/battleFx';
import { preloadSpirits } from './game/spiritCanvas';
import { audio, type BgmScene } from './game/audio';
import { claimableCount, allQuestViews } from '@shared/quests';
import type { DungeonId } from '@shared/dungeons';
import TitleScreen from './components/TitleScreen';
import Hud from './components/Hud';
import BattleUI from './components/BattleUI';
import Panel from './components/Panel';
import QuestPanel from './components/QuestPanel';
import StarterPanel from './components/StarterPanel';
import ShopPanel from './components/ShopPanel';
import Dialog from './components/Dialog';
import Toast from './components/Toast';
import HomePanel from './components/HomePanel';
import DungeonSelect from './components/DungeonSelect';
import DungeonScene from './components/DungeonScene';
import { portraitOf } from './components/TrainerPortrait';

/**
 * 手游式主流程（v2）：
 *   title → home（主面板）→ dungeons（副本选择）→ dungeon（静态场景 + 探索按钮）
 *   探索命中精灵 → engine.startBattle() → 战斗画面（engine.scene='battle'）
 *   战斗结束（scene 回 'world'）→ 自动回到当前副本继续探索。
 * 已移除第三人称 3D 世界（WASD / 可见野怪 / 点地面寻路）。
 */
type Stage = 'loading' | 'title' | 'home' | 'dungeons' | 'dungeon';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const saveRef = useRef<SaveData | null>(null);
  const versionRef = useRef(0);
  const saveTimer = useRef<number | null>(null);
  // 记录上帧 scene，用于检测战斗结束回到副本
  const prevScene = useRef<string>('');
  // 等待进入战斗的遭遇（探索命中精灵后暂存，DungeonScene 延时回调 onBattle 使用）
  const pendingBattle = useRef<{ species: number; level: number } | null>(null);
  // 当前副本
  const currentDungeon = useRef<DungeonId>('meadow');

  const [stage, setStage] = useState<Stage>('loading');
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [dialog, setDialog] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [version, setVersion] = useState(0);
  const [questOpen, setQuestOpen] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [dialogDone, setDialogDone] = useState<(() => void) | null>(null);
  const [sceneTick, setSceneTick] = useState(0); // 战斗结束回副本后强制刷新 DungeonScene
  const questNotified = useRef<Set<string>>(new Set());

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 1800);
  }, []);

  // 防抖提交存档到后端
  const markDirty = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const eng = engineRef.current;
      if (!eng) return;
      try {
        const r = await api.submitSave(eng.version, eng.save);
        if (r.conflict && r.result) {
          eng.version = r.result.version;
          showToast('存档已在其他设备更新，已同步最新版本');
        } else if (r.result) {
          eng.version = r.result.version;
        }
        versionRef.current = eng.version;
        setVersion(eng.version);
      } catch (e: any) { showToast('存档保存失败: ' + e.message); }
    }, 600);
  }, [showToast]);

  const launch = useCallback((rawSave: SaveData, ver: number) => {
    const save = migrateSave(rawSave);
    saveRef.current = save; versionRef.current = ver;
    const eng = new GameEngine(save, ver);
    engineRef.current = eng;
    eng.onUpdate = (s) => {
      setEngineState({ ...s });
      // 检测战斗结束：scene 从 battle → world，回到当前副本
      if (prevScene.current === 'battle' && s.scene === 'world') {
        showToast('战斗结束，返回副本继续探索');
        setSceneTick(t => t + 1);
        audio.setBgm('village');
      }
      prevScene.current = s.scene;
      // 新手引导：任务刚完成时提示领取（每帧检测，用 ref 去重，避免重复弹）
      for (const v of allQuestViews(eng.save)) {
        if (v.complete && !v.claimed && !questNotified.current.has(v.id)) {
          questNotified.current.add(v.id);
          showToast(`任务完成：${v.title}！点导航「任务」领奖`);
        }
      }
    };
    eng.onSaveDirty = () => markDirty();
    eng.onDialog = (lines) => setDialog(lines);
    eng.onSfx = (name) => audio.play(name);
    eng.onSceneChange = () => {}; // 新玩法不再切换 3D 世界地图
    // 服务端权威结算后：取消待提交的旧存档防抖，同步新的版本号与存档引用
    eng.onAuthoritativeSave = (save, ver) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveRef.current = save;
      versionRef.current = ver;
      setVersion(ver);
    };
    eng.start();
    preloadSpirits();  // 后台预加载 AI 精灵贴图，战斗中自动启用
    // 开发调试钩子：便于自动化测试读取引擎状态与音频状态（不影响正常玩法）
    (window as any).__game = eng;
    (window as any).__audio = audio;
    setStage('home');
    setVersion(ver);
    audio.setBgm('village');
  }, [markDirty, showToast]);

  // 浏览器自动播放策略：首次用户手势时解锁 AudioContext（全局一次性）
  useEffect(() => {
    const unlock = () => { audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  // BGM 随场景切换：战斗用紧张曲，其余主界面用村庄曲
  useEffect(() => {
    if (stage === 'loading' || stage === 'title') return;
    const scene = engineState?.scene;
    const bgm: BgmScene = scene === 'battle' || scene === 'summon' ? 'battle' : 'village';
    audio.setBgm(bgm);
  }, [stage, engineState?.scene]);

  useEffect(() => {
    if (api.isLoggedIn()) {
      api.getSave().then(r => {
        if (r.data) launch(r.data, r.version);
        else setStage('title');
      }).catch(() => setStage('title'));
    } else setStage('title');
    return () => { engineRef.current?.stop(); };
  }, [launch]);

  // Canvas 战斗渲染：仅战斗场景绘制精灵/技能/球（静态副本场景无 2D 绘制）
  // 依赖 stage：登录后才创建引擎，stage 从 loading→home 时重新挂载渲染循环
  useEffect(() => {
    const cv = canvasRef.current, eng = engineRef.current;
    if (!cv || !eng) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    let raf = 0;
    const render = () => {
      const st = eng.state;
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (st.scene === 'battle' && st.battle) {
        const b = st.battle;
        const now = performance.now();
        const idle = Math.sin(now * 0.008) * 2.2;
        const enemyLunge = b.enemyFx === 'attack' ? -30 : 0;
        const enemyShake = b.enemyFx === 'hurt' ? Math.sin(now * 0.06) * 5 : 0;
        const enemyScale = b.enemyFx === 'hurt' ? 1 - Math.abs(Math.sin(now * 0.06)) * 0.08 : 1;
        drawBattleSpirit(ctx, b.enemy.species, 470, 130, 1.2, -1, b.enemy.gender,
          { bob: idle, lunge: enemyLunge, shake: enemyShake, scale: enemyScale });
        const allyLunge = b.allyFx === 'attack' ? 30 : 0;
        const allyShake = b.allyFx === 'hurt' ? Math.sin(now * 0.06) * 5 : 0;
        const healScale = b.allyFx === 'heal' ? 1 + Math.sin(now * 0.02) * 0.1 : 1;
        drawBattleSpirit(ctx, b.ally.species, 165, 300, 1.2, 1, b.ally.gender,
          { bob: -idle, lunge: allyLunge, shake: allyShake, scale: healScale });
        if (b.skillFx) drawSkillFx(ctx, { ...b.skillFx, t: now - b.skillFx.startAt });
        if (b.ballFx) {
          const k = Math.min(1, b.ballFx.t / 1900);
          if (k < 0.3) {
            const fk = k / 0.3;
            const bx = 165 + (470 - 165) * fk;
            const by = 300 + (130 - 300) * fk - Math.sin(fk * Math.PI) * 60;
            drawBall(ctx, bx, by, 9, { rot: fk * Math.PI * 3 });
          } else {
            const shake = Math.sin(b.ballFx.t * 0.02) * 0.28;
            const glow = b.ballFx.caught && k > 0.8;
            if (glow) {
              ctx.save(); ctx.fillStyle = 'rgba(120,255,190,.35)';
              ctx.beginPath(); ctx.arc(470, 150, 26, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
            drawBall(ctx, 470, 150, 11, { shake });
          }
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  // 键盘：仅保留对话推进 + Esc 关面板（战斗操作走 BattleUI 按钮）
  useEffect(() => {
    const advanceDialog = () => {
      if (dialog.length <= 1) dialogDone?.();
      setDialog(d => d.slice(1));
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPanel(p => p ? null : 'menu'); return; }
      if ((e.key === 'Enter' || e.key === ' ') && dialog.length) { e.preventDefault(); advanceDialog(); return; }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [dialog.length, dialogDone]);

  const handleLogin = async (username: string, gender: Gender) => {
    try {
      await api.login(username);
      const r = await api.getSave();
      const isNew = !r.data;
      const save = isNew ? createNewSave(username, gender) : r.data!;
      // 新用户先落库初始存档：后续选宠/探索等权威接口都依赖后端已有存档记录
      let saveVer = isNew ? 0 : r.version;
      if (isNew) {
        const init = await api.submitSave(0, save);
        if (init.result) saveVer = init.result.version;
      }
      launch(save, saveVer);
      showToast('欢迎来到精灵物语，' + username + '！');
      // 新用户（或尚未选初始伙伴）先用对话引导完成三选一，再开放探索
      if (isNew || save.progress.flags.includes('story:need_starter')) {
        setDialog(['欢迎来到精灵物语，年轻的冒险家！',
          '在出发冒险前，先挑一只初始伙伴吧——它会陪你走遍每一个副本。',
          '选好伙伴后，点主面板「探索」进入副本，找到更多精灵！']);
        setDialogDone(() => () => setStarterOpen(true));
      }
    } catch (e: any) { showToast('登录失败: ' + e.message); }
  };

  const battleAction = (action: any, idx?: number) => engineRef.current?.battleAction(action, idx);
  const switchAlly = (idx: number) => engineRef.current?.switchAlly(idx);

  // 领取任务奖励：服务端权威校验并发奖，成功后整体同步存档
  const handleClaim = async (questId: string) => {
    const eng = engineRef.current;
    if (!eng || claiming) return;
    setClaiming(questId);
    try {
      const r = await api.claimQuest({ questId });
      if (!r.ok || !r.result) { showToast(r.message || '领取失败'); setClaiming(null); return; }
      eng.applySave(r.result.data, r.result.version);
      const rw = r.result.reward, parts: string[] = [];
      if (rw.coins) parts.push(`◈${rw.coins}`);
      if (rw.ball) parts.push(`灵兽球×${rw.ball}`);
      if (rw.herb) parts.push(`活力草×${rw.herb}`);
      showToast('任务奖励已领取：' + parts.join(' '));
    } catch (e: any) {
      showToast('领取失败: ' + e.message);
    } finally {
      setClaiming(null);
    }
  };

  // 选择初始伙伴（老流程兼容：服务端权威生成，同步存档）
  const handleChooseStarter = async (species: number, g: Gender) => {
    const eng = engineRef.current;
    if (!eng || choosing) return;
    setChoosing(true);
    try {
      const r = await api.chooseStarter({ species, gender: g });
      if (!r.ok || !r.result) { showToast(r.message || '选择失败'); return; }
      eng.applySave(r.result.data, r.result.version);
      setStarterOpen(false);
      const name = MONSTERS[species]?.name || '精灵';
      showToast(`“就决定是你了！” ${name} 加入了队伍！`);
      setDialog([`${name} 回应了你的召唤！`, '现在可以去副本探索，捕捉更多精灵了。']);
      setDialogDone(null);
    } catch (e: any) { showToast('选择失败: ' + e.message); }
    finally { setChoosing(false); }
  };

  // 商店购买：服务端权威定价与扣款，成功后同步存档
  const handleBuy = async (item: string, count: number) => {
    const eng = engineRef.current;
    if (!eng || buying) return;
    setBuying(true);
    try {
      const r = await api.shopBuy({ item, count });
      if (!r.ok || !r.result) { showToast(r.message || '购买失败'); return; }
      eng.applySave(r.result.data, r.result.version);
      const nm = item === 'ball' ? '灵兽球' : '活力草';
      showToast(`购买成功：${nm} ×${count}（◈${r.result.cost}）`);
    } catch (e: any) { showToast('购买失败: ' + e.message); }
    finally { setBuying(false); }
  };

  // 副本探索：生成种子与校验和，交服务端权威判定；命中精灵则暂存遭遇并同步存档
  const handleExplore = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return null;
    const exploreId = `ex_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const seed = Math.floor(Math.random() * 2_000_000_000);
    const dto: ExploreDto = { exploreId, dungeonId: currentDungeon.current, seed, clientChecksum: '' };
    const payload = [dto.exploreId, dto.dungeonId, dto.seed].join('|');
    dto.clientChecksum = checksum(payload);
    const r = await api.explore(dto);
    if (!r.ok || !r.result) { showToast(r.message || '探索失败'); return null; }
    const res = r.result;
    eng.applySave(res.data, res.version);
    if (res.kind === 'monster' && res.encounter) {
      pendingBattle.current = { species: res.encounter.species, level: res.encounter.level };
    }
    const rewardName = res.reward ? `${res.reward.name}×${res.reward.amount}` : undefined;
    return { kind: res.kind, text: res.text, rewardName };
  }, [showToast]);

  // 探索命中精灵后进入战斗（DungeonScene 延时回调）
  const handleExploreBattle = useCallback(() => {
    const eng = engineRef.current;
    const enc = pendingBattle.current;
    pendingBattle.current = null;
    if (!eng || !enc) return;
    if (!eng.save.team.some(m => m.hp > 0)) {
      showToast('你还没有可出战的伙伴，请先选择初始精灵！');
      setStage('home');
      return;
    }
    eng.startBattle(enc.species, enc.level);
    prevScene.current = 'battle'; // 避免 onUpdate 首帧误判为战斗结束
    audio.setBgm('battle');
  }, [showToast]);

  // 战斗显示只依赖引擎场景（真实玩法从副本探索触发；调试钩子从任意界面触发也能显示）
  const inBattle = engineState?.scene === 'battle' || engineState?.scene === 'summon';
  const engSave = engineRef.current?.save;

  return (
    <div id="app">
      <header className="topbar">
        <div className="brand"><div className="logo">灵</div><div>
          <div className="brand-title">精灵物语</div>
          <div className="brand-sub">怪物收集养成 · 手游式主面板版</div>
        </div></div>
        <div className="topbar-right">
          {(stage === 'home' || stage === 'dungeons' || stage === 'dungeon') && <span className="badge">存档 v{version} · MySQL</span>}
          {(stage === 'dungeons' || stage === 'dungeon') && <button className="tbtn" onClick={() => { setPanel('save'); }}>存档</button>}
        </div>
      </header>

      <div className="stage">
        <div className={'frame' + (stage === 'home' ? ' home' : '') + (stage === 'dungeons' ? ' dungeons' : '') + (inBattle ? ' battle-bg-wrap' : '')}>
          {/* 战斗背景：复用副本 AI 场景图 */}
          {inBattle && <div className="battle-bg" style={{ backgroundImage: 'url(/art/scene_grass.png)' }} />}

          {stage === 'loading' && <div className="overlay center"><div className="center-note">正在连接冒险世界……</div></div>}

          {stage === 'title' && <TitleScreen onLogin={handleLogin} />}

          {stage === 'home' && !inBattle && engSave && <HomePanel save={engSave} claimable={claimableCount(engSave)}
            onExplore={() => setStage('dungeons')}
            onNavigate={(n) => {
              if (n === 'quest') { setQuestOpen(true); return; }
              setPanel(n);
            }} />}

          {stage === 'dungeons' && !inBattle && engSave && <DungeonSelect save={engSave}
            onBack={() => setStage('home')}
            onPick={(id) => { currentDungeon.current = id; setStage('dungeon'); setSceneTick(t => t + 1); }} />}

          {stage === 'dungeon' && engSave && !inBattle && <DungeonScene key={sceneTick} dungeon={currentDungeon.current}
            save={engSave} onExplore={handleExplore} onBattle={handleExploreBattle}
            onBack={() => setStage('dungeons')} />}

          {/* 2D 战斗特效层（平时透明不吃事件） */}
          <canvas ref={canvasRef} width={640} height={448} className="fx-canvas" />

          {(stage === 'dungeons' || stage === 'dungeon') && !inBattle && engSave && engineState &&
            <Hud save={engSave} mapName={stage === 'dungeon' ? undefined : '精灵物语'}
              claimable={claimableCount(engSave)} onOpenQuest={() => setQuestOpen(true)} />}

          {inBattle && engineState?.battle && <BattleUI battle={engineState.battle} onAction={battleAction}
            onSwitch={switchAlly} save={engSave!} />}

          {panel && (stage === 'home' || stage === 'dungeons' || stage === 'dungeon') && engSave &&
            <Panel name={panel} save={engSave} onClose={() => setPanel(null)} onNavigate={(n) => {
              if (n === 'quest') { setPanel(null); setQuestOpen(true); }
              else setPanel(n);
            }} />}

          {questOpen && engSave && <QuestPanel save={engSave}
            onClose={() => setQuestOpen(false)} onClaim={handleClaim} claiming={claiming} />}

          {starterOpen && engSave && <StarterPanel gender={engSave.profile.gender}
            onChoose={handleChooseStarter} choosing={choosing} />}

          {shopOpen && engSave && <ShopPanel save={engSave}
            onBuy={handleBuy} buying={buying} onClose={() => setShopOpen(false)} />}

          {dialog.length > 0 && <Dialog lines={dialog} onNext={() => setDialog(d => d.slice(1))}
            portrait={portraitOf(engSave?.profile.gender || 'male')}
            onDone={() => { dialogDone?.(); setDialogDone(null); }} />}
          {toast && <Toast text={toast} />}
        </div>

        <div className="controls-help">
          <div className="help-title">玩法说明</div>
          <div className="help-grid">
            <div><kbd>探索</kbd><span>主面板进入副本选择</span></div>
            <div><kbd>探索按钮</kbd><span>副本内概率遇精灵/物品</span></div>
            <div><kbd>战斗</kbd><span>遇精灵后进入回合制对战</span></div>
            <div><kbd>捕捉</kbd><span>战斗内掷球收服伙伴</span></div>
            <div><kbd>Esc</kbd><span>关闭面板</span></div>
          </div>
          <div className="help-foot">主面板点「探索」→ 选副本（微风草原 / 潺潺溪谷 / 回声岩洞）→ 右下角「探索」按钮搜寻精灵或道具 → 遇到精灵进入对战，获胜或捕捉即可收入队伍。免费无限探索，副本越深精灵越强。</div>
        </div>
      </div>
    </div>
  );
}
