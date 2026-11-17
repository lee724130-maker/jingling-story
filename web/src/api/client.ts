/* API 客户端：登录 + 存档（对接 NestJS 后端） */
import type { ApiResponse, LoginResult, SaveData, SaveResult, BattleSettleDto, CaptureSettleDto, SettleResult, QuestClaimDto, QuestClaimResult, ChooseStarterDto, ChooseStarterResult, ShopBuyDto, ShopBuyResult } from '@shared/types';

const TOKEN_KEY = 'jingling_token';
const API_BASE = ''; // 同源，Vite 代理到后端

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 401) throw new Error('登录已过期，请重新登录');
  return res.json();
}

export const api = {
  isLoggedIn() { return !!localStorage.getItem(TOKEN_KEY); },
  async login(username: string): Promise<LoginResult> {
    const r = await request<LoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username }) });
    if (r.code !== 0) throw new Error(r.message);
    localStorage.setItem(TOKEN_KEY, r.data.token);
    return r.data;
  },
  logout() { localStorage.removeItem(TOKEN_KEY); },
  async getSave(): Promise<SaveResult> {
    const r = await request<SaveResult>('/api/player/save');
    if (r.code !== 0) throw new Error(r.message);
    return r.data;
  },
  async submitSave(version: number, data: SaveData): Promise<{ result: SaveResult | null; conflict: boolean; message: string }> {
    const r = await request<SaveResult>('/api/player/save', { method: 'POST', body: JSON.stringify({ version, data }) });
    return { result: r.data, conflict: r.code === 2001, message: r.message };
  },
  /** 战斗结算（服务端权威） */
  async settleBattle(dto: BattleSettleDto): Promise<{ ok: boolean; result: SettleResult | null; message: string }> {
    const r = await request<SettleResult>('/api/game/battle/settle', { method: 'POST', body: JSON.stringify(dto) });
    return { ok: r.code === 0, result: r.data, message: r.message };
  },
  /** 捕获结算（服务端权威） */
  async settleCapture(dto: CaptureSettleDto): Promise<{ ok: boolean; result: SettleResult | null; message: string }> {
    const r = await request<SettleResult>('/api/game/capture', { method: 'POST', body: JSON.stringify(dto) });
    return { ok: r.code === 0, result: r.data, message: r.message };
  },
  /** 任务奖励领取（服务端权威校验条件） */
  async claimQuest(dto: QuestClaimDto): Promise<{ ok: boolean; result: QuestClaimResult | null; message: string }> {
    const r = await request<QuestClaimResult>('/api/game/quest/claim', { method: 'POST', body: JSON.stringify(dto) });
    return { ok: r.code === 0, result: r.data, message: r.message };
  },
  /** 选择初始伙伴（服务端权威生成） */
  async chooseStarter(dto: ChooseStarterDto): Promise<{ ok: boolean; result: ChooseStarterResult | null; message: string }> {
    const r = await request<ChooseStarterResult>('/api/game/starter/choose', { method: 'POST', body: JSON.stringify(dto) });
    return { ok: r.code === 0, result: r.data, message: r.message };
  },
  /** 商店购买（服务端权威定价） */
  async shopBuy(dto: ShopBuyDto): Promise<{ ok: boolean; result: ShopBuyResult | null; message: string }> {
    const r = await request<ShopBuyResult>('/api/game/shop/buy', { method: 'POST', body: JSON.stringify(dto) });
    return { ok: r.code === 0, result: r.data, message: r.message };
  }
};
