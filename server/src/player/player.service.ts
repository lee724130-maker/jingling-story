import { Injectable } from '@nestjs/common';
import { store } from '../common/store';
import { ERR, SaveData, SaveResult, SaveSubmitDto } from '../../../shared/types';

@Injectable()
export class PlayerService {
  async getSave(uid: number): Promise<SaveResult> {
    const row = await store.getSave(uid);
    if (!row) return { version: 0, data: null as any };
    return { version: row.version, data: row.data };
  }

  /** 乐观锁：version 与库中一致才写入并 +1，否则返回冲突码 */
  async submitSave(uid: number, dto: SaveSubmitDto): Promise<{ code: number; message: string; data: SaveResult | null }> {
    const cur = await store.getSave(uid);
    const curVersion = cur ? cur.version : 0;
    if (dto.version !== curVersion) {
      return { code: ERR.SAVE_CONFLICT, message: '存档已在其他设备更新', data: cur ? { version: cur.version, data: cur.data } : null };
    }
    const next = curVersion + 1;
    const row = await store.putSave(uid, next, dto.data);
    return { code: ERR.OK, message: 'ok', data: { version: row.version, data: row.data } };
  }
}
