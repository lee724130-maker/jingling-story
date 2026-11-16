/* 前端配置入口：数据统一来自 shared/gamedata，前后端结算共用一份，避免规则漂移。
 * 原有 import 路径（from './config'）保持不变，这里做透明转发。 */
export * from '@shared/gamedata';
