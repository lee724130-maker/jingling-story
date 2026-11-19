import React from 'react';
import type { Gender } from '@shared/types';
import { ART } from '../game/config';

/** 二次元训练师默认立绘（无球男主 v2 / 女主），用于标题/对话/选宠/名片 */
export function portraitOf(gender: Gender): string {
  return gender === 'female' ? ART.trainerFemaleAnime : ART.trainerMaleAnime;
}

export default function TrainerPortrait({ gender, size = 96, className = '', title }: {
  gender: Gender; size?: number; className?: string; title?: string;
}) {
  return <img
    className={'trainer-portrait ' + className}
    src={portraitOf(gender)}
    alt={gender === 'female' ? '女训练师' : '男训练师'}
    title={title}
    style={{ width: size, height: size }}
    draggable={false}
  />;
}
