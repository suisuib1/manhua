# 本地开发

## 后端

1. 进入 `server`
2. 复制 `.env.example` 为 `.env`
3. 本地开发保持 `WECHAT_LOGIN_MOCK=true`
4. 执行 `npm install`
5. 启动本地 PostgreSQL 16，并创建数据库 `manhua`
6. 配置 `DATABASE_URL`
7. 执行 `npx prisma migrate dev`
8. 执行 `npx prisma generate`
9. 执行 `npm start`
10. 访问 `http://127.0.0.1:3000/api/health`

推荐本地 PostgreSQL 连接示例：

```env
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/manhua?schema=public"
```

Windows 本地 PostgreSQL 可以使用安装时设置的 `postgres` 用户和本地开发密码。请只把真实密码写入 `server/.env`，不要提交 `.env`。

旧 SQLite 数据库 `server/prisma/dev.db` 本轮不会自动迁移，已经备份到 `server/prisma/backups/`。如需迁移旧数据，下一阶段单独编写 SQLite 到 PostgreSQL 的迁移脚本。

## WeChat login config

Local mock login:

```env
WECHAT_LOGIN_MOCK="true"
```

Real WeChat login:

```env
WECHAT_LOGIN_MOCK="false"
WECHAT_APP_ID="your WeChat Mini Program AppID"
WECHAT_APP_SECRET="your WeChat Mini Program AppSecret"
```

Notes:

- Keep `WECHAT_APP_SECRET` only in `server/.env`; do not put it in mini program frontend code and do not commit the real secret.
- The `appid` in WeChat DevTools `project.config.json` should match `WECHAT_APP_ID`.
- Device debugging and production need a valid request domain and an HTTPS backend domain.
- WeChat DevTools can temporarily disable domain verification for local debugging, but production cannot rely on that option.

## Admin user

Create or reset a local admin user from `server`:

```bash
node scripts/createAdmin.js --username admin --password 你的密码 --displayName 超级管理员
```

The script never uses a hard-coded password. If the username already exists, it updates `passwordHash`, `displayName`, and sets `status` back to `active`.
