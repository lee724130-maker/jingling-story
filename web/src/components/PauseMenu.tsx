import React, { useState } from 'react';
import type { SaveData } from '@shared/types';
import { audio } from '../game/audio';

const VOL_STEPS = [0.3, 0.6, 1];

/** 右上角暂停菜单：设置 + 全部功能入口 + 退出登录 */
export default function PauseMenu({ save, onClose, onNavigate, onOpenQuest, onOpenShop, onExit }: {
  save: SaveData;
  onClose: () => void;
  onNavigate: (n: string) => void;
  onOpenQuest: () => void;
  onOpenShop: () => void;
  onExit: () => void;
}) {
  const [muted, setMuted] = useState(audio.muted);
  const [volIdx, setVolIdx] = useState(() => {
    const i = VOL_STEPS.indexOf(audio.volume);
    return i >= 0 ? i : 1;
  });

  const toggleMute = () => { audio.unlock(); setMuted(audio.toggleMute()); };
  const cycleVolume = () => {
    audio.unlock();
    const next = (volIdx + 1) % VOL_STEPS.length;
    setVolIdx(next); audio.setVolume(VOL_STEPS[next]);
    if (muted) { audio.setMuted(false); setMuted(false); }
    audio.play('click');
  };

  // 所有功能入口（点哪个就关掉菜单、打开对应面板）
  const go = (fn: () => void) => { onClose(); fn(); };
  const entries = [
    { icon: '◈', key: 'profile', label: '名片', sub: '训练师名片 · 形象战绩进度', act: () => onNavigate('profile') },
    { icon: '✦', key: 'team', label: '队伍', sub: '队伍与仓库 · 切换出战精灵', act: () => onNavigate('team') },
    { icon: '✚', key: 'bag', label: '背包', sub: '背包 · 灵兽球活力草', act: () => onNavigate('bag') },
    { icon: '▤', key: 'dex', label: '图鉴', sub: `精灵图鉴 · ${save.pokedex.caught.length} 已捕获`, act: () => onNavigate('dex') },
    { icon: '⚑', key: 'quest', label: '任务', sub: '冒险任务 · 领奖励', act: onOpenQuest },
    { icon: '◉', key: 'shop', label: '商店', sub: '商店 · 购买道具', act: onOpenShop },
    { icon: '▣', key: 'save', label: '存档', sub: '存档管理 · 云端信息', act: () => onNavigate('save') },
    { icon: '?', key: 'help', label: '说明', sub: '玩法说明 · 操作与规则', act: () => onNavigate('help') }
  ];

  return <div className="overlay pause-overlay" onClick={onClose}>
    <div className="pause-menu" onClick={e => e.stopPropagation()}>
      <div className="pause-head">
        <div>
          <h2>⏸ 暂停菜单</h2>
          <div className="pause-user">{save.profile.name} · ◈ {save.resources.coins}</div>
        </div>
        <button className="iconbtn" onClick={onClose} aria-label="关闭菜单">×</button>
      </div>

      <div className="pause-body">
        {/* 设置区：音效与音量（从底部状态条移入） */}
        <div className="pause-section-title">设置</div>
        <div className="pause-settings">
          <button className="pause-setting hud-audio" onClick={toggleMute}>
            <span className="ps-icon">{muted ? '🔇' : '🔊'}</span>
            <span className="ps-text"><b>音效</b><small>{muted ? '已静音' : '已开启'}</small></span>
            <span className="ps-value">{muted ? '关' : '开'}</span>
          </button>
          <button className="pause-setting hud-vol" onClick={cycleVolume}>
            <span className="ps-icon">🎚</span>
            <span className="ps-text"><b>音量</b><small>点击切换档位</small></span>
            <span className="ps-value">{Math.round(VOL_STEPS[volIdx] * 100)}%</span>
          </button>
        </div>

        {/* 功能入口 */}
        <div className="pause-section-title">功能</div>
        <div className="pause-grid">
          {entries.map(e => (
            <button key={e.key} className={'pause-entry hud-menu-key' + (e.key === 'quest' ? ' hud-quest' : '')} data-menu={e.key} onClick={() => go(e.act)}>
              <span className="pe-icon">{e.icon}</span>
              <span className="pe-label">{e.label}<small>{e.sub}</small></span>
            </button>
          ))}
        </div>

        {/* 退出 */}
        <button className="pause-exit" onClick={() => { onClose(); onExit(); }}>⏻ 退出登录</button>
      </div>
    </div>
  </div>;
}
