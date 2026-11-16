import React from 'react';
import type { SaveData } from '@shared/types';

export default function Hud({ save }: { save: SaveData }) {
  return (
    <div className="hud">
      <div className="hud-left"><span className="chip">青芽草原</span></div>
      <div className="hud-right">
        <span className="chip coin">◈ {save.resources.coins}</span>
        <span className="chip">{save.profile.name} · Lv.{save.team[0]?.level || 1}</span>
      </div>
    </div>
  );
}
