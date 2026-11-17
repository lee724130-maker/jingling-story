import React from 'react';
import type { SaveData } from '@shared/types';

export default function Hud({ save, claimable = 0, onOpenQuest }: {
  save: SaveData; claimable?: number; onOpenQuest?: () => void;
}) {
  return (
    <div className="hud">
      <div className="hud-left"><span className="chip">青芽草原</span></div>
      <div className="hud-right">
        <span className="chip coin">◈ {save.resources.coins}</span>
        <span className="chip">{save.profile.name} · Lv.{save.team[0]?.level || 1}</span>
        {onOpenQuest && <button className="chip hud-quest" onClick={onOpenQuest} title="冒险任务">
          任务{claimable > 0 && <span className="quest-dot" />}
        </button>}
      </div>
    </div>
  );
}
