import React from 'react';

export default function Dialog({ lines, onNext, onDone, portrait }: {
  lines: string[]; onNext: () => void; onDone?: () => void; portrait?: string;
}) {
  if (!lines.length) return null;
  const advance = () => { if (lines.length <= 1) onDone?.(); onNext(); };
  return <div className="dialog" onClick={advance}>
    <div className="dialog-box">
      {portrait && <img className="dialog-portrait" src={portrait} alt="训练师" draggable={false} />}
      <p>{lines[0]}</p>
      <span className="dialog-next">{lines.length <= 1 ? '完成 ▾' : '点击继续 ▾'}</span>
    </div>
  </div>;
}
