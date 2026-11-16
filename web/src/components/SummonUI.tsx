import React from 'react';
import type { SaveData } from '@shared/types';
import type { SummonView } from '../game/engine';
import { MONSTERS, TYPES } from '../game/config';
import SpiritArt from './SpiritArt';

/** 投球出战过场的字幕与信息条（画面主体由 Canvas 绘制） */
export default function SummonUI({ summon, caption, save }: {
  summon: SummonView;
  caption: string;
  save: SaveData;
}) {
  const enemy = MONSTERS[summon.enemy.species];
  const phaseLabel: Record<string, string> = {
    appear: '遭遇野生精灵', throw: '投掷精灵球', burst: '精灵出场', ready: '准备战斗'
  };
  return (
    <div className="overlay summon-ui">
      <div className="summon-top">
        <div className="summon-badge">
          <SpiritArt species={summon.enemy.species} size={34} />
          <div>
            <div className="summon-enemy-name">野生 {enemy.name} <span style={{ color: TYPES[enemy.type].color }}>[{TYPES[enemy.type].name}]</span></div>
            <div className="summon-enemy-lv">Lv.{summon.enemy.level}</div>
          </div>
        </div>
        <div className="summon-step">{phaseLabel[summon.phase] || ''}</div>
      </div>
      <div className="summon-bottom">
        {caption && <div className="summon-caption">{caption}</div>}
        <div className="summon-progress">
          {(['appear', 'throw', 'burst', 'ready'] as const).map((p, i) => {
            const order = ['appear', 'throw', 'burst', 'ready'];
            const active = order.indexOf(summon.phase) >= i;
            return <span key={p} className={'summon-dot' + (active ? ' on' : '')} />;
          })}
        </div>
      </div>
    </div>
  );
}
