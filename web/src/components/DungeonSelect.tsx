import React from 'react';
import type { SaveData } from '@shared/types';
import { DUNGEON_LIST, isDungeonUnlocked, type DungeonId } from '@shared/dungeons';
import { MONSTERS, ART } from '../game/config';

/** 副本选择页：想去哪个地图抓精灵就去哪个（场景化入口） */
export default function DungeonSelect({ save, onPick, onBack }: {
  save: SaveData;
  onPick: (id: DungeonId) => void;
  onBack: () => void;
}) {
  return <div className="dungeon-select">
    <div className="ds-banner" style={{ backgroundImage: `url(${ART.sceneVillage})` }}>
      <button className="ds-back" onClick={onBack}>‹ 返回村庄</button>
      <div className="ds-banner-text">
        <h2>选择探索副本</h2>
        <p>每个秘境栖息着不同的精灵，越深入越强。</p>
      </div>
    </div>
    <div className="ds-list">
      {DUNGEON_LIST.map((d, i) => {
        const unlocked = isDungeonUnlocked(d, save.progress.flags);
        const preview = d.encounters.slice(0, 5).map(e => MONSTERS[e.species]?.name).filter(Boolean).join(' · ');
        return <button key={d.id} className={'ds-card' + (unlocked ? '' : ' locked')}
          style={{ '--dc': d.accent } as React.CSSProperties}
          disabled={!unlocked}
          onClick={() => unlocked && onPick(d.id)}>
          <div className="ds-card-bg" style={{ backgroundImage: `url(${d.bg})` }} />
          <div className="ds-card-shade" />
          <div className="ds-card-body">
            <div className="ds-card-top">
              <span className="ds-index">0{i + 1}</span>
              <h3>{d.name}</h3>
              <span className="ds-lv">{d.subtitle}</span>
            </div>
            <p className="ds-desc">{d.desc}</p>
            <div className="ds-species">{unlocked ? '常见精灵：' + preview : '？？？ 探索后揭晓'}</div>
            <div className="ds-rates">
              <span>精灵 {(d.rates.monster * 100) | 0}%</span>
              <span>物品 {(d.rates.item * 100) | 0}%</span>
              <span>空手 {(d.rates.nothing * 100) | 0}%</span>
            </div>
            {!unlocked && <div className="ds-lock">🔒 完成前置目标后解锁</div>}
          </div>
          <span className="ds-go">{unlocked ? '进入 ›' : '未解锁'}</span>
        </button>;
      })}
    </div>
  </div>;
}
