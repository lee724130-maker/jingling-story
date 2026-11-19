import React, { useState } from 'react';
import type { SaveData } from '@shared/types';
import { claimableCount } from '@shared/quests';
import { MONSTERS, TYPES, ART } from '../game/config';

/** 场景化主面板：整张村庄场景图铺满，在对应物件上放可点击热点替代按钮列表 */
export default function HomePanel({ save, onExplore, onNavigate, claimable }: {
  save: SaveData;
  onExplore: () => void;
  onNavigate: (name: string) => void;
  claimable: number;
}) {
  const lead = save.team[0];
  const [active, setActive] = useState<string | null>(null);

  // 热点位置对齐场景图物件：小屋=商店，告示板=任务，喷泉=队伍，石碑=图鉴，右侧林间路=探索
  const spots = [
    { key: 'shop', icon: '◈', label: '商店', sub: '灵兽球 · 活力草', x: 20, y: 38, kind: 'shop', action: () => onNavigate('shop') },
    { key: 'quest', icon: '⚑', label: '任务', sub: claimable > 0 ? `${claimable} 个可领奖` : '冒险目标', x: 39, y: 50, kind: 'quest', action: () => onNavigate('quest'), dot: claimable > 0 },
    { key: 'team', icon: '✦', label: '队伍', sub: '出战精灵', x: 54, y: 60, kind: 'team', action: () => onNavigate('team') },
    { key: 'dex', icon: '▤', label: '图鉴', sub: `${save.pokedex.caught.length}/${Object.keys(MONSTERS).length} 已捕获`, x: 82, y: 46, kind: 'dex', action: () => onNavigate('dex') },
    { key: 'explore', icon: '⚔', label: '探索', sub: '前往副本抓精灵', x: 67, y: 68, kind: 'explore', action: onExplore, primary: true }
  ];

  return <div className="home-scene" style={{ backgroundImage: `url(${ART.sceneVillage})` }}>
    <div className="scene-sky-fade" />
    <div className="scene-ground-fade" />

    {/* 场景顶部：欢迎语（轻量，不遮挡画面） */}
    <div className="scene-greeting">
      <div className="scene-hi">青芽村 · {save.profile.name}</div>
      <div className="scene-line">点击场景中的物件开始冒险</div>
    </div>

    {/* 场景底部信息条：纯展示，操作按钮已移入右上角暂停菜单 */}
    <div className="scene-status">
      <span>◈ {save.resources.coins}</span>
      <span>⚑ {save.profile.wins} 胜</span>
      {lead && <span className="scene-lead">{MONSTERS[lead.species].name} Lv.{lead.level}
        <i style={{ color: TYPES[MONSTERS[lead.species].type].color }}>●</i></span>}
    </div>

    {/* 可点击热点 */}
    {spots.map(s => (
      <button key={s.key}
        className={'scene-spot' + (s.key === 'quest' ? ' hud-quest' : '') + (s.primary ? ' primary' : '') + (active === s.key ? ' active' : '')}
        style={{ left: s.x + '%', top: s.y + '%' }}
        onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(s.key)} onBlur={() => setActive(null)}
        onClick={s.action} title={`${s.label} · ${s.sub}`}>
        <span className="spot-ring" />
        <span className="spot-icon">{s.icon}{s.dot && <i className="quest-dot" />}</span>
        <span className="spot-label">{s.label}</span>
        <span className="spot-tip"><b>{s.label}</b><em>{s.sub}</em></span>
      </button>
    ))}
  </div>;
}
