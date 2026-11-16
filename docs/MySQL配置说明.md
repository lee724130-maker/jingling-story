# 精灵物语 · MySQL 配置说明

你的本机已安装 MySQL（`C:\mysql\`，端口 3306，服务正在运行），但用 `root / 123456` 连接被拒绝（Access denied）。可能原因：root 密码不是 123456、或 root 只允许特定主机登录。后端代码已完整支持 MySQL，按下面步骤切换即可。

## 1. 确认 root 密码

用 MySQL 客户端验证（客户端在 `C:\mysql\bin\mysql.exe`）：

```powershell
& "C:\mysql\bin\mysql.exe" -uroot -p
# 提示时输入你的真实密码
```

如果能进入，说明密码正确。若忘记密码，需要重置（可另行协助）。

## 2. 创建数据库

进入 mysql 后执行：

```sql
CREATE DATABASE IF NOT EXISTS jingling_story DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

建表由后端启动时自动完成（`users`、`saves` 两张表），无需手动建。

## 3. 切换后端到 MySQL

在 `server\` 目录创建 `.env` 文件（复制 `.env.example` 修改）：

```
STORAGE_MODE=mysql
PORT=3000
JWT_SECRET=换成一串随机字符串
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的真实密码
MYSQL_DATABASE=jingling_story
```

然后重启后端即可。表结构会自动创建。

## 4. 当前默认模式

未配置 `.env` 时默认 `STORAGE_MODE=local`，存档写在 `server/data/local-store.json`，零依赖即可跑通前后端联调。等 MySQL 密码确认后再切换，数据可用存档码导出导入迁移。
