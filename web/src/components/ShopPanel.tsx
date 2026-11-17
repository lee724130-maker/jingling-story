import React, { useState } from 'react';
import type { SaveData } from '@shared/types';
import { SHOP_ITEMS } from '@shared/maps';

export default function ShopPanel({ save, onBuy, buying, onClose }: {
  save: SaveData;
  onBuy: (item: string, count: number) => void;
  buying: boolean;
  onClose: () => void;
}) {
  const [count, setCount] = useState(1);
  return <div className="overlay panel">
    <div className="panel-box">
      <div className="panel-head"><h2>青芽村商店 <span style={{fontSize:12,color:'var(--accent2)',fontWeight:400}}>◈ {save.resources.coins}</span></h2>
        <button className="iconbtn" onClick={onClose}>×</button></div>
      <div className="panel-body">
        <p className="shop-lead">「欢迎光临！挑点补给再出发吧。」—— 商店老板 阿布</p>
        <div className="shop-count">
          <span>购买数量：</span>
          {[1, 5, 10].map(n => <button key={n} className={'shop-qty' + (count === n ? ' on' : '')} onClick={() => setCount(n)}>×{n}</button>)}
        </div>
        <div className="shop-list">
          {Object.entries(SHOP_ITEMS).map(([id, item]) => {
            const cost = item.price * count, owned = save.bag[id] || 0;
            return <div key={id} className="shop-item">
              <div className="shop-icon">{id === 'ball' ? '◉' : '✿'}</div>
              <div className="shop-info">
                <div className="shop-name">{item.name} <span className="shop-owned">持有 {owned}</span></div>
                <div className="shop-price">单价 ◈{item.price}</div>
              </div>
              <button className="shop-buy" disabled={buying || save.resources.coins < cost}
                onClick={() => onBuy(id, count)}>
                {buying ? '…' : `购买 ◈${cost}`}
              </button>
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
}
