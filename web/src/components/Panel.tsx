import React from 'react';
import type { SaveData } from '@shared/types';
import { MONSTERS, TYPES, ITEMS } from '../game/config';
import SpiritArt from './SpiritArt';
import TrainerPortrait from './TrainerPortrait';

function MonThumb({ species, size = 56 }: { species: number; size?: number }) {
  return <SpiritArt species={species} size={size} />;
}

export default function Panel({ name, save, onClose, onNavigate }: {
  name: string; save: SaveData; onClose: () => void; onNavigate: (n: string) => void;
}) {
  const titles: Record<string,string> = { menu:'菜单', profile:'训练师名片', team:'队伍与仓库', bag:'背包', dex:'精灵图鉴', save:'存档管理', help:'玩法说明' };
  const content = () => {
    if (name === 'menu') return <div className="menu-list">
      {[['profile','训练师名片','形象 · 战绩 · 冒险进度'],['team','队伍','查看与切换出战精灵'],['bag','背包','灵兽球 · 活力草'],['dex','精灵图鉴','已见 / 已捕获'],['quest','冒险任务','完成任务领奖励'],['save','存档管理','云端存档信息'],['help','玩法说明','']].map(([k,t,s]) =>
        <button key={k} className="menu-item" onClick={() => onNavigate(k)}>{t}<small>{s}</small></button>)}
    </div>;
    if (name === 'profile') {
      const caught = save.pokedex.caught.length, seen = save.pokedex.seen.length;
      const total = Object.keys(MONSTERS).length;
      const lead = save.team[0];
      const wins = save.profile.wins || 0;
      // 冒险等级由胜场推导：每胜 3 场升 1 级，当前级内进度用于进度条
      const rank = Math.floor(wins / 3) + 1;
      const rankPct = ((wins % 3) / 3) * 100;
      const winRate = save.profile.battles > 0 ? Math.round(wins / save.profile.battles * 100) : 0;
      const dexPct = total > 0 ? Math.round(caught / total * 100) : 0;
      const title = rank >= 10 ? '传奇训练师' : rank >= 6 ? '精英训练师' : rank >= 3 ? '资深训练师' : '见习训练师';
      return <div className="profile-card-v2">
        <div className="profile-hero">
          <div className="profile-portrait-wrap">
            <TrainerPortrait gender={save.profile.gender} size={92} title="你的训练师形象" />
            <div className="profile-badge">{save.profile.gender === 'female' ? '♀ 女训练师' : '♂ 男训练师'}</div>
          </div>
          <div className="profile-identity">
            <div className="profile-ribbon">{title}</div>
            <h3>{save.profile.name}</h3>
            <div className="profile-sub">精灵物语 · 第 {rank} 级冒险者</div>
            <div className="profile-rankbar"><i style={{ width: rankPct + '%' }} /></div>
            <div className="profile-rankhint">距下一级还需 {3 - (wins % 3)} 场胜利</div>
          </div>
        </div>
        <div className="profile-section-title">冒险战绩</div>
        <div className="profile-stats">
          <div><span>⚔ 胜场</span><b>{wins}</b></div>
          <div><span>⚑ 对战</span><b>{save.profile.battles}</b></div>
          <div><span>✦ 胜率</span><b>{winRate}%</b></div>
          <div><span>◈ 灵石</span><b>{save.resources.coins}</b></div>
          <div><span>▤ 图鉴捕获</span><b>{caught}/{total}</b></div>
          <div><span>◉ 图鉴完成度</span><b>{dexPct}%</b></div>
        </div>
        <div className="profile-section-title">出战伙伴</div>
        <div className="profile-lead">
          {lead ? <><MonThumb species={lead.species} size={56} />
            <div className="profile-lead-meta"><b>{MONSTERS[lead.species].name}</b><span>Lv.{lead.level} · {lead.nature} · {lead.gender === 'male' ? '♂' : '♀'}</span></div>
            <span className="profile-lead-hp">HP {Math.max(0, lead.hp)}/{lead.maxHp}</span></>
            : <span>尚未选择初始伙伴</span>}
        </div>
      </div>;
    }
    if (name === 'team') {
      const all = [...save.team, ...save.storage];
      return <div className="card-grid">{all.map((m, i) => {
        const def = MONSTERS[m.species], pct = Math.max(0, m.hp/m.maxHp*100);
        return <div key={m.id} className={'mon-card' + (i===0?' active':'')} style={{opacity: m.hp<=0?0.5:1}}>
          <MonThumb species={m.species} />
          <div className="mon-meta">
            <div className="nm">{def.name} <span style={{color:TYPES[def.type].color}}>[{TYPES[def.type].name}]</span></div>
            <div className="sb">Lv.{m.level} · {m.gender==='male'?'♂':'♀'} · {m.nature} · {i<save.team.length?'队伍':'仓库'}{i===0?' · 出战':''}</div>
            <div className="sb">HP {Math.max(0,m.hp)}/{m.maxHp}</div>
            <div className="bar" style={{height:6,background:'#2a3749',borderRadius:4,marginTop:5,overflow:'hidden'}}>
              <i style={{display:'block',height:'100%',width:pct+'%',background:pct<25?'#e2604c':'#4fd18b'}} /></div>
          </div>
        </div>;
      })}</div>;
    }
    if (name === 'bag') return <>
      <div style={{padding:'10px 4px',borderBottom:'1px solid var(--line)'}}>◉ {ITEMS.ball.name} — {ITEMS.ball.desc} <span style={{float:'right',color:'var(--accent2)'}}>×{save.bag.ball||0}</span></div>
      <div style={{padding:'10px 4px',borderBottom:'1px solid var(--line)'}}>✿ {ITEMS.herb.name} — {ITEMS.herb.desc} <span style={{float:'right',color:'var(--accent2)'}}>×{save.bag.herb||0}</span></div>
      <div style={{padding:'10px 4px'}}>◈ 灵石 <span style={{float:'right',color:'var(--accent2)'}}>{save.resources.coins}</span></div>
    </>;
    if (name === 'dex') return <div className="dex-grid">{Object.values(MONSTERS).map(m => {
      const seen = save.pokedex.seen.includes(m.id), caught = save.pokedex.caught.includes(m.id);
      return <div key={m.id} className={'dex-card'+(seen?'':' locked')}>
        {seen ? <MonThumb species={m.id} size={72}/> : <div style={{width:72,height:72,borderRadius:10,background:'#2a3749',display:'grid',placeItems:'center',margin:'0 auto',fontSize:28,color:'#5a6b80'}}>?</div>}
        <div className="dn">{seen?m.name:'？？？'}</div>
        <div className="dt">{seen?`${TYPES[m.type].name}属性 · No.${String(m.id).padStart(2,'0')}`:'未发现'}</div>
        <div className="dt" style={{color:caught?'#5fd0a6':'#9fb0c6'}}>{caught?'已捕获':seen?'已遇见':'-'}</div>
      </div>;
    })}</div>;
    if (name === 'save') return <div className="center-note">
      <p>存档经 API 保存在服务端 MySQL 独立库（jingling_story）。</p>
      <p>当前账号：<b style={{color:'var(--accent)'}}>{save.profile.name}</b></p>
      <p>登录方式：本地测试账号（微信登录待资质就绪）</p>
      <p style={{color:'var(--accent)'}}>数据库与主项目 ai_anime 完全隔离，互不干扰。</p>
    </div>;
    if (name === 'help') return <div className="center-note">
      <p>1. 方向键/WASD 移动，走上野怪即投球出战（不再随机遇敌）。</p>
      <p>2. 战斗用技能削弱对方，或用灵兽球捕获。</p>
      <p>3. 战斗得经验，升级进化；精灵性别与性格捕获时随机。</p>
      <p>4. 右上角「任务」里有冒险目标，完成后点领取拿金币和道具。</p>
      <p>5. 走到地图右下角疗伤石碑恢复全队。</p>
    </div>;
    return null;
  };

  return <div className="overlay panel">
    <div className="panel-box">
      <div className="panel-head"><h2>{titles[name]||name}</h2><button className="iconbtn" onClick={onClose}>×</button></div>
      <div className="panel-body">{content()}</div>
    </div>
  </div>;
}
