import React, { useState } from 'react';
import type { SaveData } from '@shared/types';
import { audio } from '../game/audio';

const VOL_STEPS = [0.3, 0.6, 1];

export default function Hud({ save, claimable = 0, onOpenQuest, mapName, showControls = true }: {
  save: SaveData; claimable?: number; onOpenQuest?: () => void; mapName?: string; showControls?: boolean;
}) {
  const [muted, setMuted] = useState(audio.muted);
  const [volIdx, setVolIdx] = useState(() => {
    const i = VOL_STEPS.indexOf(audio.volume);
    return i >= 0 ? i : 1;
  });

  const toggleMute = () => {
    audio.unlock();
    setMuted(audio.toggleMute());
  };
  const cycleVolume = () => {
    audio.unlock();
    const next = (volIdx + 1) % VOL_STEPS.length;
    setVolIdx(next);
    audio.setVolume(VOL_STEPS[next]);
    if (muted) { audio.setMuted(false); setMuted(false); }
    audio.play('click');
  };

  return (
    <div className="hud">
      <div className="hud-left">
        <span className="chip">📍 {mapName || '青芽村'}</span>
      </div>
      <div className="hud-right">
        <span className="chip coin">◈ {save.resources.coins}</span>
        <span className="chip">{save.profile.name} · Lv.{save.team[0]?.level || 1}</span>
        {showControls && <>
          <button className="chip hud-audio" onClick={toggleMute}
            title={muted ? '开启声音' : '静音'} aria-label={muted ? '开启声音' : '静音'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="chip hud-audio hud-vol" onClick={cycleVolume}
            title={`音量 ${Math.round(VOL_STEPS[volIdx] * 100)}%（点击切换）`} aria-label="切换音量">
            {'▮'.repeat(volIdx + 1)}{'▯'.repeat(VOL_STEPS.length - volIdx - 1)}
          </button>
          {onOpenQuest && <button className="chip hud-quest" onClick={onOpenQuest} title="冒险任务">
            任务{claimable > 0 && <span className="quest-dot" />}
          </button>}
        </>}
      </div>
    </div>
  );
}
