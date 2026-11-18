import React from 'react';
import type { Gender } from '@shared/types';
import { ART } from '../game/config';

/** 写实训练师立绘（AI 图生方案 ③：用作对话头像/选宠/训练师名片，游戏内第三人称仍用 Soldier 3D 模型） */
export function portraitOf(gender: Gender): string {
  return gender === 'female' ? ART.trainerFemaleHd : ART.trainerMaleHd;
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
