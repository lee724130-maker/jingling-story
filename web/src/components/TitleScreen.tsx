import React, { useState } from 'react';
import type { Gender } from '@shared/types';
import { ART } from '../game/config';

export default function TitleScreen({ onLogin }: { onLogin: (name: string, gender: Gender) => void }) {
  const [name, setName] = useState('小训练师');
  const [gender, setGender] = useState<Gender>('male');
  const [showGender, setShowGender] = useState(false);

  return (
    <div className="overlay center title-screen">
      <div className="title-card">
        {showGender && (
          <div className="trainer-preview"><img src={gender === 'male' ? ART.trainerMale : ART.trainerFemale} alt="训练师" /></div>
        )}
        {!showGender && <div className="title-emblem">灵</div>}
        <h1>精灵物语</h1>
        <p className="tagline">捕获 · 培养 · 进化 · 探索</p>
        {!showGender ? (
          <div className="title-actions">
            <input className="login-input" value={name} maxLength={12}
              onChange={e => setName(e.target.value)} placeholder="输入训练师名字" />
            <button className="bigbtn primary" onClick={() => name.trim().length >= 2 && setShowGender(true)}>开始旅程</button>
          </div>
        ) : (
          <div className="title-actions" style={{ width: 260 }}>
            <div className="center-note">选择你的形象</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['male','female'] as Gender[]).map(g => (
                <button key={g} className={'bigbtn' + (gender===g?' primary':'')} style={{ flex: 1 }}
                  onClick={() => setGender(g)}>{g==='male'?'♂ 男生':'♀ 女生'}</button>
              ))}
            </div>
            <button className="bigbtn primary" onClick={() => onLogin(name.trim(), gender)}>进入精灵世界</button>
          </div>
        )}
        <p className="title-note">原创 IP · 男女双形象 · 捕捉精灵性别/属性随机<br />React + TypeScript + NestJS + MySQL</p>
      </div>
    </div>
  );
}
