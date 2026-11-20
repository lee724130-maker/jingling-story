import React from 'react';
import { SPIRIT_SHEETS, SPIRIT_CELL } from '../game/config';

/** 从精灵群像图集中裁出指定物种的头像，纯 CSS 无依赖。
 *  图集 0 = 初代群像，图集 1 = 第二世代群像（均为 3列×2行）。 */
export default function SpiritArt({ species, size = 56, className = '' }: { species: number; size?: number; className?: string }) {
  const cell = SPIRIT_CELL[species] || [0, 0, 0];
  const [col, row, sheet = 0] = cell;
  return (
    <div className={'spirit-art ' + className} title={'No.'+species} style={{
      width: size, height: size, flex: 'none', borderRadius: 10,
      backgroundImage: `url(${SPIRIT_SHEETS[sheet] || SPIRIT_SHEETS[0]})`,
      backgroundSize: '300% 200%',
      backgroundPosition: `${col * 50}% ${row * 100}%`,
      backgroundColor: '#f2f7f2'
    }} />
  );
}
