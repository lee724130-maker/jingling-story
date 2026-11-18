import React, { useState } from 'react';
import type { Gender } from '@shared/types';
import { STARTER_CHOICES } from '@shared/maps';
import { TYPES } from '../game/config';
import SpiritArt from './SpiritArt';
import TrainerPortrait from './TrainerPortrait';

export default function StarterPanel({ gender, onChoose, choosing }: {
  gender: Gender;
  onChoose: (species: number, gender: Gender) => void;
  choosing: boolean;
}) {
  const [sel, setSel] = useState<number | null>(null);
  return <div className="overlay panel">
    <div className="panel-box starter-box">
      <div className="panel-head"><h2>选择你的初始伙伴</h2></div>
      <div className="panel-body">
        <div className="starter-intro">
          <TrainerPortrait gender={gender} size={110} className="starter-trainer" title="你的训练师形象" />
          <p className="starter-lead">村长木老递来三颗精灵球——它们分别代表焰、潮、木三种属性。选一只作为冒险的起点吧。</p>
        </div>
        <div className="starter-grid">
          {STARTER_CHOICES.map(c => {
            const t = TYPES[c.type];
            return <button key={c.species} className={'starter-card' + (sel === c.species ? ' selected' : '')}
              onClick={() => setSel(c.species)}>
              <SpiritArt species={c.species} size={96} />
              <div className="starter-name">{c.name}</div>
              <div className="starter-type" style={{color: t.color}}>[{t.name}] 属性</div>
              <div className="starter-desc">{c.desc}</div>
            </button>;
          })}
        </div>
        <button className="bigbtn primary starter-confirm" disabled={sel === null || choosing}
          onClick={() => sel !== null && onChoose(sel, gender)}>
          {choosing ? '正在缔结契约…' : sel !== null ? `就决定是你了！` : '请先选择一只精灵'}
        </button>
      </div>
    </div>
  </div>;
}
