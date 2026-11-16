import React from 'react';

export default function Dialog({ lines, onNext }: { lines: string[]; onNext: () => void }) {
  if (!lines.length) return null;
  return <div className="dialog" onClick={onNext}>
    <div className="dialog-box"><p>{lines[0]}</p><span className="dialog-next">点击继续 ▾</span></div>
  </div>;
}
