# 本地开发

1. 进入 `server`
2. 复制 `.env.example` 为 `.env`
3. 本地开发保持 `WECHAT_LOGIN_MOCK=true`
4. 执行 `npm install`
5. 执行 `npx prisma generate`
6. 执行 `npm start`
7. 访问 `http://127.0.0.1:3000/api/health`
8. 前端 `baseUrl` 当前是 `http://127.0.0.1:3000`

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
node scripts/createAdmin.js --username admin --password your-password --displayName 超级管理员
```

The script never uses a hard-coded password. If the username already exists, it updates `passwordHash`, `displayName`, and sets `status` back to `active`.
