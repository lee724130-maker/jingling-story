import React from 'react';

export default function Dialog({ lines, onNext, onDone }: { lines: string[]; onNext: () => void; onDone?: () => void }) {
  if (!lines.length) return null;
  const advance = () => { if (lines.length <= 1) onDone?.(); onNext(); };
  return <div className="dialog" onClick={advance}>
    <div className="dialog-box"><p>{lines[0]}</p><span className="dialog-next">{lines.length <= 1 ? '完成 ▾' : '点击继续 ▾'}</span></div>
  </div>;
}
