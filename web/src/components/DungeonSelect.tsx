import React from 'react';
import type { SaveData } from '@shared/types';
import { DUNGEON_LIST, isDungeonUnlocked, type DungeonId } from '@shared/dungeons';
import { MONSTERS } from '../game/config';

/** 副本选择页：想去哪个地图抓精灵就去哪个 */
export default function DungeonSelect({ save, onPick, onBack }: {
  save: SaveData;
  onPick: (id: DungeonId) => void;
  onBack: () => void;
}) {
  return <div className="dungeon-select">
    <div className="ds-head">
      <button className="ds-back" onClick={onBack}>‹ 返回主面板</button>
      <h2>选择探索副本</h2>
      <p>每个副本栖息着不同的精灵，越深入的副本精灵越强。</p>
    </div>
    <div className="ds-list">
      {DUNGEON_LIST.map(d => {
        const unlocked = isDungeonUnlocked(d, save.progress.flags);
        const preview = d.encounters.slice(0, 5).map(e => MONSTERS[e.species]?.name).filter(Boolean).join(' · ');
        return <button key={d.id} className={'ds-card' + (unlocked ? '' : ' locked')}
          style={{ '--dc': d.accent } as React.CSSProperties}
          disabled={!unlocked}
          onClick={() => unlocked && onPick(d.id)}>
          <div className="ds-card-bg" style={{ backgroundImage: `url(${d.bg})` }} />
          <div className="ds-card-body">
            <div className="ds-card-top">
              <h3>{d.name}</h3>
              <span className="ds-lv">{d.subtitle}</span>
            </div>
            <p className="ds-desc">{d.desc}</p>
            <div className="ds-species">常见精灵：{unlocked ? preview : '？？？'}</div>
            <div className="ds-rates">
              <span>精灵 {(d.rates.monster * 100) | 0}%</span>
              <span>物品 {(d.rates.item * 100) | 0}%</span>
            </div>
            {!unlocked && <div className="ds-lock">🔒 完成前置目标后解锁</div>}
          </div>
        </button>;
      })}
    </div>
  </div>;
}
