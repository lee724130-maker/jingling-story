import React from 'react';
import type { SaveData } from '@shared/types';
import { claimableCount } from '@shared/quests';
import { MONSTERS, TYPES } from '../game/config';
import TrainerPortrait from './TrainerPortrait';

/** 手游式主面板：角色立绘 + 功能导航（火影忍者手游式的入口结构） */
export default function HomePanel({ save, onExplore, onNavigate, claimable }: {
  save: SaveData;
  onExplore: () => void;
  onNavigate: (name: string) => void;
  claimable: number;
}) {
  const lead = save.team[0];
  const nav = [
    { key: 'explore', icon: '⚔', label: '探索', sub: '前往副本抓精灵', primary: true, action: onExplore },
    { key: 'team', icon: '✦', label: '队伍', sub: '查看出战精灵', action: () => onNavigate('team') },
    { key: 'dex', icon: '▤', label: '图鉴', sub: `${save.pokedex.caught.length}/${Object.keys(MONSTERS).length} 已捕获`, action: () => onNavigate('dex') },
    { key: 'quest', icon: '⚑', label: '任务', sub: claimable > 0 ? `${claimable} 个可领奖` : '冒险目标', action: () => onNavigate('quest'), dot: claimable > 0 },
    { key: 'shop', icon: '◈', label: '商店', sub: '灵兽球 · 活力草', action: () => onNavigate('shop') },
    { key: 'save', icon: '▣', label: '存档', sub: '云端存档信息', action: () => onNavigate('save') }
  ];
  return <div className="home-panel">
    <div className="home-hero">
      <div className="home-portrait"><TrainerPortrait gender={save.profile.gender} size={230} title="你的训练师" /></div>
      <div className="home-greeting">
        <div className="home-hi">欢迎回来，{save.profile.name}！</div>
        <div className="home-line">今天的冒险，要从哪里开始呢？</div>
      </div>
    </div>
    <div className="home-body">
      <div className="home-stats">
        <span>◈ {save.resources.coins}</span>
        <span>♂♀ Lv.{lead?.level || 1}</span>
        <span>⚑ {save.profile.wins} 胜</span>
      </div>
      <div className="home-nav">
        {nav.map(n => <button key={n.key}
          className={'home-nav-btn' + (n.primary ? ' primary' : '')}
          onClick={n.action}>
          <span className="nav-icon">{n.icon}</span>
          <span className="nav-label">{n.label}{n.dot && <i className="quest-dot" />}</span>
          <span className="nav-sub">{n.sub}</span>
        </button>)}
      </div>
      <div className="home-lead">
        {lead ? <>
          <span className="home-lead-tag">出战伙伴</span>
          <b>{MONSTERS[lead.species].name}</b>
          <span style={{ color: TYPES[MONSTERS[lead.species].type].color }}>[{TYPES[MONSTERS[lead.species].type].name}]</span>
          <span className="home-lead-lv">Lv.{lead.level}</span>
        </> : <span className="home-lead-tag">尚无伙伴，去探索找到第一只精灵吧！</span>}
      </div>
    </div>
  </div>;
}
