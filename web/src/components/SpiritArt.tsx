import React from 'react';
import { ART, SPIRIT_CELL } from '../game/config';

/** 从精灵群像（3列×2行）中裁出指定物种的头像，纯 CSS 无依赖 */
export default function SpiritArt({ species, size = 56, className = '' }: { species: number; size?: number; className?: string }) {
  const cell = SPIRIT_CELL[species] || [0, 0];
  const [col, row] = cell;
  return (
    <div className={'spirit-art ' + className} title={'No.'+species} style={{
      width: size, height: size, flex: 'none', borderRadius: 10,
      backgroundImage: `url(${ART.spirits})`,
      backgroundSize: '300% 200%',
      backgroundPosition: `${col * 50}% ${row * 100}%`,
      backgroundColor: '#f2f7f2'
    }} />
  );
}
