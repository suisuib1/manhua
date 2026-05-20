# 本地开发

1. 进入 `server`
2. 复制 `.env.example` 为 `.env`
3. 本地开发保持 `WECHAT_LOGIN_MOCK=true`
4. 执行 `npm install`
5. 执行 `npx prisma generate`
6. 执行 `npm start`
7. 访问 `http://127.0.0.1:3000/api/health`
8. 前端 `baseUrl` 当前是 `http://127.0.0.1:3000`
