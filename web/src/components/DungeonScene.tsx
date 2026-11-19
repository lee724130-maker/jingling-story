import React, { useState } from 'react';
import type { SaveData } from '@shared/types';
import { DUNGEONS, type DungeonId } from '@shared/dungeons';
import { MONSTERS, ART } from '../game/config';

/** 探索中的动态反馈阶段 */
type ExploreFx = 'idle' | 'searching' | 'monster' | 'item' | 'nothing';

/** 副本场景：主题场景图背景 + 右下角探索按钮 + 探索结果反馈 */
export default function DungeonScene({ dungeon, save, onExplore, onBack, onBattle }: {
  dungeon: DungeonId;
  save: SaveData;
  onExplore: () => Promise<{ kind: 'monster' | 'item' | 'nothing'; text: string; rewardName?: string } | null>;
  onBack: () => void;
  onBattle: () => void;
}) {
  const def = DUNGEONS[dungeon];
  const [fx, setFx] = useState<ExploreFx>('idle');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const lead = save.team[0];
  const leadMon = lead ? MONSTERS[lead.species] : null;

  const doExplore = async () => {
    if (busy) return;
    setBusy(true); setFx('searching'); setText('正在搜寻附近的动静……');
    const r = await onExplore();
    setBusy(false);
    if (!r) { setFx('idle'); setText('探索失败，请重试'); return; }
    setText(r.text);
    if (r.kind === 'monster') {
      setFx('monster');
      setTimeout(() => onBattle(), 1200); // 短暂停留后进入战斗
    } else if (r.kind === 'item') { setFx('item'); setTimeout(() => setFx('idle'), 1800); }
    else { setFx('nothing'); setTimeout(() => setFx('idle'), 1800); }
  };

  return <div className="dungeon-scene" style={{ '--dc': def.accent } as React.CSSProperties}>
    <div className="dungeon-bg" style={{ backgroundImage: `url(${def.bg})` }} />
    <div className="dungeon-vignette" />
    <button className="ds-back dungeon-back" onClick={onBack}>‹ 离开副本</button>
    <div className="dungeon-title">
      <h2>{def.name}</h2>
      <span>{def.subtitle} · {def.encounters.length} 种精灵栖息</span>
    </div>
    <div className="dungeon-scene-info">
      <p>{def.desc}</p>
      <div className="dsi-partner">
        {lead && leadMon ? <>
          <span className="dsi-label">同行伙伴</span>
          <span className="dsi-name">{leadMon.name}</span>
          <span className="dsi-lv">Lv.{lead.level}</span>
          <span className="dsi-hint">点「探索」发现这里的精灵与道具</span>
        </> : <span className="dsi-hint">先回村庄挑选一只初始伙伴，再来探索</span>}
      </div>
    </div>

    {fx !== 'idle' && <div className={'explore-fx ' + fx}>
      <div className="fx-orb">{fx === 'searching' ? '◎' : fx === 'monster' ? '!' : fx === 'item' ? '✦' : '·'}</div>
      <div className="fx-text">{text}</div>
    </div>}

    <button className="explore-btn" onClick={doExplore} disabled={busy}>
      <span className="explore-btn-icon">{busy ? '◎' : '⌕'}</span>
      <span>{busy ? '探索中…' : '探索'}</span>
    </button>
  </div>;
}
