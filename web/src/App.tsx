import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api/client';
import type { SaveData, Gender } from '@shared/types';
import { GameEngine, type EngineState } from './game/engine';
import { createNewSave, migrateSave } from './game/model';
import { MAP, MONSTERS, TYPES, TILE, ART } from './game/config';
import { drawBattleSpirit, drawBall, drawBeam } from './game/sprites';
import { drawSkillFx } from './game/battleFx';
import { preloadSpirits } from './game/spiritCanvas';
import { claimableCount, allQuestViews } from '@shared/quests';
import { MAPS, type MapId, type NpcDef } from '@shared/maps';
import Scene3D from './game/world3d/Scene3D';
import TitleScreen from './components/TitleScreen';
import Hud from './components/Hud';
import BattleUI from './components/BattleUI';
import Panel from './components/Panel';
import QuestPanel from './components/QuestPanel';
import StarterPanel from './components/StarterPanel';
import ShopPanel from './components/ShopPanel';
import Dialog from './components/Dialog';
import Toast from './components/Toast';
import SummonUI from './components/SummonUI';

type Stage = 'loading' | 'title' | 'game';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const saveRef = useRef<SaveData | null>(null);
  const versionRef = useRef(0);
  const saveTimer = useRef<number | null>(null);

  const [stage, setStage] = useState<Stage>('loading');
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [dialog, setDialog] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [version, setVersion] = useState(0);
  const [summonCaption, setSummonCaption] = useState('');
  const [questOpen, setQuestOpen] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [nearNpc, setNearNpc] = useState<NpcDef | null>(null);
  const [mapName, setMapName] = useState('青芽村 · 新手村');
  const [dialogDone, setDialogDone] = useState<(() => void) | null>(null);
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
    setMapName(MAPS[save.progress.map as MapId]?.name || '青芽村 · 新手村');
    eng.onUpdate = (s) => {
      setEngineState({ ...s });
      if (s.scene === 'summon') setSummonCaption(eng.summonCaption());
      setNearNpc(s.scene === 'world' ? eng.npcNearby() : null);
      // 新手引导：任务刚完成时提示领取（每帧检测，用 ref 去重，避免重复弹）
      for (const v of allQuestViews(eng.save)) {
        if (v.complete && !v.claimed && !questNotified.current.has(v.id)) {
          questNotified.current.add(v.id);
          showToast(`任务完成：${v.title}！点右上角「任务」领奖`);
        }
      }
    };
    eng.onSaveDirty = () => markDirty();
    eng.onDialog = (lines) => setDialog(lines);
    // 场景切换：更新地图名 + 提示
    eng.onSceneChange = (to, name) => {
      setMapName(name);
      showToast(`已抵达：${name}`);
    };
    // NPC 交互：按角色分派对话/商店/任务板/选宠
    eng.onNpcInteract = (npc) => {
      if (npc.role === 'shop') { setShopOpen(true); return; }
      if (npc.role === 'questboard') { setQuestOpen(true); return; }
      const needStarter = eng.save.progress.flags.includes('story:need_starter');
      if (npc.role === 'elder' && needStarter) {
        setDialog([...npc.lines, '来吧，从这三只里挑一只作为你的伙伴。']);
        setDialogDone(() => () => setStarterOpen(true));
      } else {
        setDialog(npc.lines);
        setDialogDone(null);
      }
    };
    // 服务端权威结算后：取消待提交的旧存档防抖，同步新的版本号与存档引用
    eng.onAuthoritativeSave = (save, ver) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveRef.current = save;
      versionRef.current = ver;
      setVersion(ver);
    };
    eng.start();
    preloadSpirits();  // 后台预加载 AI 精灵贴图，战斗中自动启用
    // 开发调试钩子：便于自动化测试读取引擎状态（不影响正常玩法）
    (window as any).__game = eng;
    setStage('game');
    setVersion(ver);
  }, [markDirty]);

  useEffect(() => {
    if (api.isLoggedIn()) {
      api.getSave().then(r => {
        if (r.data) launch(r.data, r.version);
        else setStage('title');
      }).catch(() => setStage('title'));
    } else setStage('title');
    return () => { engineRef.current?.stop(); };
  }, [launch]);

  // Canvas 渲染
  useEffect(() => {
    const cv = canvasRef.current, eng = engineRef.current;
    if (!cv || !eng || stage !== 'game') return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const render = () => {
      const st = eng.state;
      // 透明叠加层：world 场景由 3D 负责，这里只画战斗/投球的 2D 特效
      ctx.clearRect(0, 0, cv.width, cv.height);

      const p = st.player;

      // 投球出战过场
      if (st.scene === 'summon' && st.summon) {
        const s = st.summon;
        const now = performance.now();
        if (s.phase === 'appear') {
          // 野怪警戒已在上面绘制；这里画一个聚焦光圈
          const pulse = 1 + Math.sin(s.t * 0.012) * 0.08;
          ctx.save(); ctx.strokeStyle = 'rgba(255,211,74,.75)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(s.enemy.x, s.enemy.y + 6, 20 * pulse, 9 * pulse, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        } else if (s.phase === 'throw') {
          // 球从训练师手中沿抛物线飞向场地中心
          const k = Math.min(1, s.t / 620);
          const sx = p.x + p.dir * 10, sy = p.y - 6;
          const tx = 320, ty = 250;
          const bx = sx + (tx - sx) * k;
          const by = sy + (ty - sy) * k - Math.sin(k * Math.PI) * 70;
          drawBall(ctx, bx, by, 7, { rot: k * Math.PI * 4 });
        } else if (s.phase === 'burst') {
          // 球落地开启 + 光柱 + 己方精灵跃出
          const k = Math.min(1, s.t / 700);
          drawBeam(ctx, 320, 292, k, '#7fe3ff');
          if (k < 0.35) drawBall(ctx, 320, 288, 8, { open: k > 0.18, rot: 0 });
          else {
            const jump = Math.sin(Math.min(1, (k - 0.35) / 0.65) * Math.PI) * 26;
            drawBattleSpirit(ctx, s.allySpecies, 320, 292 - 6 - jump, 1.05, 1, undefined, { bob: -jump * 0.3 });
          }
        } else if (s.phase === 'ready') {
          // 己方精灵落地待机、轻微浮动
          const bob = Math.sin(now * 0.01) * 2;
          drawBattleSpirit(ctx, s.allySpecies, 320, 286, 1.1, 1, undefined, { bob });
        }
      }

      // 战斗画面：两只精灵 + 动作
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

        // 技能特效（属性专属粒子动画），画在精灵之上；进度用绝对时间避免节流导致卡顿
        if (b.skillFx) drawSkillFx(ctx, { ...b.skillFx, t: now - b.skillFx.startAt });

        // 捕捉球动画
        if (b.ballFx) {
          const k = Math.min(1, b.ballFx.t / 1900);
          if (k < 0.3) {
            // 飞行
            const fk = k / 0.3;
            const bx = 165 + (470 - 165) * fk;
            const by = 300 + (130 - 300) * fk - Math.sin(fk * Math.PI) * 60;
            drawBall(ctx, bx, by, 9, { rot: fk * Math.PI * 3 });
          } else {
            // 落地摇晃：成功则收进，失败弹出
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
      requestAnimationFrame(render);
    };
    const id = requestAnimationFrame(render);
    return () => cancelAnimationFrame(id);
  }, [stage, engineState?.scene]);

  // 键盘
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || stage !== 'game') return;
    const set = (e: KeyboardEvent, v: boolean) => {
      const k = e.key.toLowerCase();
      const map: Record<string, string> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
      if (map[k]) { eng.setKey(map[k], v); e.preventDefault(); }
    };
    const advanceDialog = () => {
      if (dialog.length <= 1) dialogDone?.();
      setDialog(d => d.slice(1));
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPanel(p => p ? null : 'menu'); return; }
      if ((e.key === 'Enter' || e.key === ' ') && dialog.length) { e.preventDefault(); advanceDialog(); return; }
      if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        // 面板/对话打开时不触发世界交互
        if (panel || questOpen || starterOpen || shopOpen || dialog.length) return;
        e.preventDefault();
        eng.interact();
        return;
      }
      set(e, true);
    };
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [stage, dialog.length, dialogDone, panel, questOpen, starterOpen, shopOpen]);

  const handleLogin = async (username: string, gender: Gender) => {
    try {
      await api.login(username);
      const r = await api.getSave();
      const isNew = !r.data;
      const save = isNew ? createNewSave(username, gender) : r.data!;
      launch(save, isNew ? 0 : r.version);
      showToast('欢迎来到精灵物语，' + username + '！');
      if (isNew || save.progress.flags.includes('story:need_starter')) {
        setDialog(['欢迎来到青芽村，年轻的冒险家！',
          '这里是新手村，很安全，没有野生精灵。',
          '先去找村长木老（地图上他的标记），选一只初始伙伴，再踏上旅途吧！',
          '提示：走到 NPC 或出口附近，按 空格键 交互。']);
        setDialogDone(null);
      } else {
        setDialog(['欢迎回到青芽村！', '走向地图上方的出口可前往大草原捕捉精灵；走近 NPC 按空格键对话。']);
        setDialogDone(null);
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

  // 选择初始伙伴：服务端权威生成精灵，成功后同步存档、关闭选宠面板、进入主线下一步
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
      setDialog([`${name} 回应了你的召唤！`, '主线已完成：挑选初始伙伴。', '现在可以向村长打听更多冒险线索，或前往大草原捕捉新精灵了。']);
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

  return (
    <div id="app">
      <header className="topbar">
        <div className="brand"><div className="logo">灵</div><div>
          <div className="brand-title">精灵物语</div>
          <div className="brand-sub">怪物收集养成 · Web + NestJS 联调版</div>
        </div></div>
        <div className="topbar-right">
          {stage === 'game' && <span className="badge">存档 v{version} · MySQL</span>}
          {stage === 'game' && <button className="tbtn" onClick={() => { setPanel('save'); }}>存档</button>}
        </div>
      </header>

      <div className="stage">
        <div className="frame">
          {/* 3D 第三人称世界层：world/summon/battle 常驻作为背景 */}
          {stage === 'game' && engineRef.current && (
            <div className={'world3d' + (engineState?.scene === 'battle' ? ' dimmed' : '')}>
              <Scene3D engine={engineRef.current} wildTick={engineState?.wilds.length || 0} />
            </div>
          )}
          {/* 2D 特效叠加层：投球/战斗精灵与球动画 */}
          <canvas ref={canvasRef} width={640} height={448} className="fx-canvas" />

          {stage === 'game' && engineState && <Hud save={engineRef.current!.save} mapName={mapName}
            claimable={claimableCount(engineRef.current!.save)} onOpenQuest={() => setQuestOpen(true)} />}
          {stage === 'game' && engineState?.scene === 'world' && !panel && !dialog.length && !nearNpc && !starterOpen && !shopOpen &&
            <div className="hint">WASD 移动 · 走到 NPC/出口旁按 空格 交互 · Esc 菜单</div>}
          {stage === 'game' && engineState?.scene === 'world' && nearNpc && !dialog.length && !panel && !starterOpen && !shopOpen &&
            <div className="npc-hint">按 <kbd>空格</kbd> 与 <b>{nearNpc.name}</b> 交互</div>}

          {stage === 'title' && <TitleScreen onLogin={handleLogin} />}

          {stage === 'game' && engineState?.scene === 'summon' && engineState.summon &&
            <SummonUI summon={engineState.summon} caption={summonCaption} save={engineRef.current!.save} />}

          {stage === 'game' && engineState?.scene === 'battle' && engineState.battle &&
            <BattleUI battle={engineState.battle} onAction={battleAction} onSwitch={switchAlly} save={engineRef.current!.save} />}

          {panel && stage === 'game' && <Panel name={panel} save={engineRef.current!.save}
            onClose={() => setPanel(null)} onNavigate={(n) => {
              if (n === 'quest') { setPanel(null); setQuestOpen(true); }
              else setPanel(n);
            }} />}

          {questOpen && stage === 'game' && <QuestPanel save={engineRef.current!.save}
            onClose={() => setQuestOpen(false)} onClaim={handleClaim} claiming={claiming} />}

          {starterOpen && stage === 'game' && <StarterPanel gender={engineRef.current!.save.profile.gender}
            onChoose={handleChooseStarter} choosing={choosing} />}

          {shopOpen && stage === 'game' && <ShopPanel save={engineRef.current!.save}
            onBuy={handleBuy} buying={buying} onClose={() => setShopOpen(false)} />}

          {dialog.length > 0 && <Dialog lines={dialog} onNext={() => setDialog(d => d.slice(1))}
            onDone={() => { dialogDone?.(); setDialogDone(null); }} />}
          {toast && <Toast text={toast} />}
        </div>

        <div className="controls-help">
          <div className="help-title">操作说明</div>
          <div className="help-grid">
            <div><kbd>↑↓←→</kbd>/<kbd>WASD</kbd><span>移动</span></div>
            <div><kbd>空格</kbd>/<kbd>E</kbd><span>与 NPC / 出口交互</span></div>
            <div><kbd>回车</kbd><span>确认对话</span></div>
            <div><kbd>Esc</kbd><span>菜单</span></div>
          </div>
          <div className="help-foot">新手村（青芽村）：安全无野怪，有村长、商店、任务板与疗伤石碑。走向地图上方出口可进入「大草原」副本，那里才有野生精灵，走近即投球出战。</div>
        </div>
      </div>
    </div>
  );
}
