/* 存储抽象层：local JSON 文件 / MySQL 两种实现，接口一致 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';
import { SaveData } from '../../../shared/types';

export interface UserRow {
  uid: number;
  username: string;
  password: string;
  nickname: string;
  unionid: string | null;
  createdAt: number;
}
export interface SaveRow { uid: number; version: number; data: SaveData; updatedAt: number; }

export interface Store {
  init(): Promise<void>;
  findUserByUsername(username: string): Promise<UserRow | null>;
  findUserByUnionid(unionid: string): Promise<UserRow | null>;
  createUser(u: Omit<UserRow, 'uid' | 'createdAt'>): Promise<UserRow>;
  getSave(uid: number): Promise<SaveRow | null>;
  putSave(uid: number, version: number, data: SaveData): Promise<SaveRow>;
}

/* ---------- 本地 JSON 文件实现 ---------- */
class LocalStore implements Store {
  private file = path.resolve(config.dataFile);
  private db: { users: UserRow[]; saves: SaveRow[]; seq: number } = { users: [], saves: [], seq: 1 };

  async init() {
    const dir = path.dirname(this.file);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.file)) {
      try { this.db = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* 损坏则重建 */ }
    }
    this.flush();
    console.log(`[Store] 本地文件存储已就绪: ${this.file}`);
  }
  private flush() { fs.writeFileSync(this.file, JSON.stringify(this.db, null, 2)); }
  async findUserByUsername(u: string) { return this.db.users.find(x => x.username === u) || null; }
  async findUserByUnionid(u: string) { return this.db.users.find(x => x.unionid === u) || null; }
  async createUser(u: Omit<UserRow, 'uid' | 'createdAt'>) {
    const row: UserRow = { ...u, uid: this.db.seq++, createdAt: Date.now() };
    this.db.users.push(row); this.flush(); return row;
  }
  async getSave(uid: number) { return this.db.saves.find(x => x.uid === uid) || null; }
  async putSave(uid: number, version: number, data: SaveData) {
    let row = this.db.saves.find(x => x.uid === uid);
    if (!row) { row = { uid, version, data, updatedAt: Date.now() }; this.db.saves.push(row); }
    else { row.version = version; row.data = data; row.updatedAt = Date.now(); }
    this.flush(); return row;
  }
}

/* ---------- MySQL 实现（mysql2） ---------- */
class MysqlStore implements Store {
  private pool: any;
  async init() {
    const mysql = require('mysql2/promise');
    this.pool = mysql.createPool({ ...config.mysql, waitForConnections: true, connectionLimit: 5 });
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        uid INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        password VARCHAR(128) NOT NULL DEFAULT '',
        nickname VARCHAR(64) NOT NULL,
        unionid VARCHAR(64) UNIQUE NULL,
        created_at BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS saves (
        uid INT PRIMARY KEY,
        version BIGINT NOT NULL,
        data JSON NOT NULL,
        updated_at BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[Store] MySQL 存储已就绪');
  }
  async findUserByUsername(u: string) {
    const [r]: any = await this.pool.execute('SELECT * FROM users WHERE username=?', [u]);
    return r[0] ? this.mapUser(r[0]) : null;
  }
  async findUserByUnionid(u: string) {
    const [r]: any = await this.pool.execute('SELECT * FROM users WHERE unionid=?', [u]);
    return r[0] ? this.mapUser(r[0]) : null;
  }
  private mapUser(r: any): UserRow {
    return { uid: r.uid, username: r.username, password: r.password, nickname: r.nickname, unionid: r.unionid, createdAt: Number(r.created_at) };
  }
  async createUser(u: Omit<UserRow, 'uid' | 'createdAt'>) {
    const [res]: any = await this.pool.execute(
      'INSERT INTO users (username,password,nickname,unionid,created_at) VALUES (?,?,?,?,?)',
      [u.username, u.password, u.nickname, u.unionid, Date.now()]
    );
    return { ...u, uid: res.insertId, createdAt: Date.now() };
  }
  async getSave(uid: number) {
    const [r]: any = await this.pool.execute('SELECT * FROM saves WHERE uid=?', [uid]);
    if (!r[0]) return null;
    return { uid: r[0].uid, version: Number(r[0].version), data: typeof r[0].data === 'string' ? JSON.parse(r[0].data) : r[0].data, updatedAt: Number(r[0].updated_at) };
  }
  async putSave(uid: number, version: number, data: SaveData) {
    await this.pool.execute(
      'INSERT INTO saves (uid,version,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version), data=VALUES(data), updated_at=VALUES(updated_at)',
      [uid, version, JSON.stringify(data), Date.now()]
    );
    return { uid, version, data, updatedAt: Date.now() };
  }
}

export const store: Store = config.storage === 'mysql' ? new MysqlStore() : new LocalStore();
