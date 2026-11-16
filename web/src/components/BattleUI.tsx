import React from 'react';
import type { SaveData, Monster } from '@shared/types';
import type { BattleView } from '../game/engine';
import { MONSTERS, TYPES, SKILLS } from '../game/config';
import SpiritArt from './SpiritArt';

const hpPct = (m: Monster) => Math.max(0, m.hp / m.maxHp * 100);

export default function BattleUI({ battle, onAction, onSwitch, save }: {
  battle: BattleView;
  onAction: (a: any, idx?: number) => void;
  onSwitch: (idx: number) => void;
  save: SaveData;
}) {
  const ally = battle.ally, enemy = battle.enemy;
  return (
    <div className="overlay battle">
      <div className="battle-scene">
        {battle.skillFx && battle.skillName && (
          <div key={battle.skillFx.seq} className="skill-banner" style={{
            borderColor: TYPES[battle.skillFx.type].color,
            color: TYPES[battle.skillFx.type].light
          }}>{battle.skillName}</div>
        )}
        <div className="battle-info enemy-info">
          <div className="bname"><SpiritArt species={enemy.species} size={30} /><span style={{flex:1}}>{MONSTERS[enemy.species].name} <span style={{color:TYPES[MONSTERS[enemy.species].type].color}}>[{TYPES[MONSTERS[enemy.species].type].name}]</span></span><span className="lv">Lv.{enemy.level} {enemy.gender==='male'?'♂':'♀'}</span></div>
          <div className="hpbar"><div className="hpfill" style={{width:hpPct(enemy)+'%', background: hpPct(enemy)<25?'#e2604c':hpPct(enemy)<50?'#e8c34a':'#4fd18b'}} /></div>
          <div className="hptext">{Math.max(0,enemy.hp)}/{enemy.maxHp}</div>
        </div>
        <div className="battle-info ally-info">
          <div className="bname"><SpiritArt species={ally.species} size={30} /><span style={{flex:1}}>{MONSTERS[ally.species].name} <span style={{color:TYPES[MONSTERS[ally.species].type].color}}>[{TYPES[MONSTERS[ally.species].type].name}]</span></span><span className="lv">Lv.{ally.level} {ally.gender==='male'?'♂':'♀'}</span></div>
          <div className="hpbar"><div className="hpfill" style={{width:hpPct(ally)+'%', background: hpPct(ally)<25?'#e2604c':hpPct(ally)<50?'#e8c34a':'#4fd18b'}} /></div>
          <div className="hptext">{Math.max(0,ally.hp)}/{ally.maxHp}</div>
        </div>
      </div>
      <div className="battle-msgbox">{battle.message}</div>
      <div className="battle-actions">
        {battle.mode === 'main' ? (
          <>
            <button className="actbtn" onClick={() => onAction('fight')}>技能</button>
            <button className="actbtn" onClick={() => onAction('ball')}>灵兽球<small>×{save.bag.ball||0}</small></button>
            <button className="actbtn" onClick={() => onAction('herb')}>活力草<small>×{save.bag.herb||0}</small></button>
            <button className="actbtn" onClick={() => onAction('run')}>逃跑</button>
          </>
        ) : (
          <>
            {ally.skills.map((sid, i) => <button key={i} className="actbtn" onClick={() => onAction('skill', i)}>
              {SKILLS[sid].name}<small>{TYPES[SKILLS[sid].type].name} · 威力{SKILLS[sid].power||'-'}</small>
            </button>)}
            <button className="actbtn" onClick={() => onAction('back')}>返回</button>
          </>
        )}
      </div>
    </div>
  );
}
