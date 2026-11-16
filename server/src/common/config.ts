/* 后端配置：环境变量优先 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'jingling-story-dev-secret-change-me',
  // 存储模式：local（JSON 文件，默认，零依赖） | mysql
  storage: (process.env.STORAGE_MODE || 'local') as 'local' | 'mysql',
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'jingling_story'
  },
  dataFile: process.env.DATA_FILE || './data/local-store.json'
};
