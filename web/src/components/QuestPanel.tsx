import React from 'react';
import type { SaveData } from '@shared/types';
import { allQuestViews, type QuestView } from '@shared/quests';

function rewardText(v: QuestView): string {
  const r = v.reward, parts: string[] = [];
  if (r.coins) parts.push(`◈ ${r.coins}`);
  if (r.ball) parts.push(`灵兽球 ×${r.ball}`);
  if (r.herb) parts.push(`活力草 ×${r.herb}`);
  return parts.join(' · ');
}

export default function QuestPanel({ save, onClose, onClaim, claiming }: {
  save: SaveData;
  onClose: () => void;
  onClaim: (questId: string) => void;
  claiming: string | null;
}) {
  const views = allQuestViews(save);
  const doneCount = views.filter(v => v.claimed).length;
  const claimable = views.filter(v => v.complete && !v.claimed).length;

  return <div className="overlay panel">
    <div className="panel-box">
      <div className="panel-head">
        <h2>冒险任务 <span style={{fontSize:12,color:'var(--muted)',fontWeight:400}}>{doneCount}/{views.length} 已完成</span></h2>
        <button className="iconbtn" onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        <div className="quest-intro">完成任务领取奖励，进度自动记录。{claimable > 0 ? `当前有 ${claimable} 项可领取！` : ''}</div>
        <div className="quest-list">
          {views.map(v => {
            const pct = Math.min(100, Math.round(v.progress / v.goal * 100));
            return <div key={v.id} className={'quest-card' + (v.claimed ? ' claimed' : v.complete ? ' ready' : '')}>
              <div className="quest-top">
                <div className="quest-stage">任务 {v.stage}</div>
                <div className="quest-title">{v.title}</div>
                {v.claimed && <span className="quest-tag done">已领取</span>}
                {!v.claimed && v.complete && <span className="quest-tag ready">可领取</span>}
              </div>
              <div className="quest-desc">{v.desc}</div>
              <div className="quest-bar"><i style={{width: pct + '%'}} /></div>
              <div className="quest-bottom">
                <span className="quest-progress">{v.progress} / {v.goal}</span>
                <span className="quest-reward">奖励：{rewardText(v)}</span>
                {!v.claimed && v.complete &&
                  <button className="quest-claim" disabled={claiming === v.id}
                    onClick={() => onClaim(v.id)}>{claiming === v.id ? '领取中…' : '领取'}</button>}
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
}
