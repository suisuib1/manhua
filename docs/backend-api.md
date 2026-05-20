# 《日记生成漫画后端已完成 API 文档》

## 基础信息

- 本地开发地址：`http://127.0.0.1:3000`
- 统一响应格式：`{ code, message, data }`
- 鉴权方式：`Authorization: Bearer <token>`

## 统一响应格式

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 401,
  "message": "错误信息",
  "data": null
}
```

## 接口清单

### 一、健康检查

**GET** `/api/health`

说明：检查后端服务是否正常。  
是否需要登录：否。

返回示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "ok",
    "service": "manhua-api"
  }
}
```

### 二、微信登录

**POST** `/api/auth/wechat/login`

说明：小程序端通过 `wx.login` 获取 `code` 后，调用该接口换取业务 token。  
是否需要登录：否。

请求示例：

```json
{
  "code": "wx_login_code",
  "profile": {
    "nickname": "用户昵称",
    "avatarUrl": "头像地址"
  }
}
```

返回示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "user_id",
      "nickname": "用户昵称",
      "avatarUrl": "头像地址"
    },
    "isNewUser": true
  }
}
```

注意：
- 前端只保存 `token`，不要保存 `openid`。
- 后端不会返回 `openid`、`unionid`、`session_key`。
- 开发环境可使用 `WECHAT_LOGIN_MOCK=true`。

### 三、获取当前用户信息

**GET** `/api/users/me`

是否需要登录：是。  
Header：`Authorization: Bearer <token>`

返回示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user": {
      "id": "user_id",
      "status": "active",
      "lastLoginAt": "2026-05-20T00:00:00.000Z"
    },
    "profile": {
      "nickname": "用户昵称",
      "avatarUrl": "头像地址",
      "bio": ""
    },
    "settings": {
      "autoSaveDraft": true,
      "keepPhotoMood": true,
      "privateMode": true,
      "diaryReminder": false,
      "generationReminder": true
    },
    "comicBook": {
      "id": "comic_book_id",
      "title": "我的漫画日记",
      "description": null,
      "coverImageUrl": null,
      "visibility": "private"
    },
    "quota": {
      "totalQuota": 0,
      "usedQuota": 0,
      "remainingQuota": 0
    }
  }
}
```

### 四、更新用户资料

**PUT** `/api/users/me/profile`

是否需要登录：是。  
Header：`Authorization: Bearer <token>`

请求示例：

```json
{
  "nickname": "新的昵称",
  "avatarUrl": "新的头像地址",
  "bio": "简介"
}
```

允许更新字段：
- `nickname`
- `avatarUrl`
- `bio`

返回：更新后的 `profile`。

注意：
- 不允许更新 `userId`、`status`、`openid`、`quota` 等字段。
- 多余字段会被忽略或拒绝，不能生效。

### 五、获取用户设置

**GET** `/api/users/me/settings`

是否需要登录：是。  
Header：`Authorization: Bearer <token>`

返回示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "autoSaveDraft": true,
    "keepPhotoMood": true,
    "privateMode": true,
    "diaryReminder": false,
    "generationReminder": true
  }
}
```

### 六、更新用户设置

**PUT** `/api/users/me/settings`

是否需要登录：是。  
Header：`Authorization: Bearer <token>`

请求示例：

```json
{
  "autoSaveDraft": true,
  "keepPhotoMood": true,
  "privateMode": true,
  "diaryReminder": false,
  "generationReminder": true
}
```

允许更新字段：
- `autoSaveDraft`
- `keepPhotoMood`
- `privateMode`
- `diaryReminder`
- `generationReminder`

注意：
- 字段值必须是 boolean。
- 未传字段保持原值。
- 不允许更新 `id`、`userId`、`createdAt`、`updatedAt`。

## 常见错误码

- `400`：请求参数错误
- `401`：未登录或登录失效
- `404`：接口不存在
- `500`：服务端错误

## 前端接入建议

- 登录成功后保存 `authToken`
- 调用需要登录的接口时带上 `Authorization`
- token 失效时清理 `authToken` 和 `currentUser`
- 不要清理 `draftComicChapter`、`generatedComicChapters`、`comicAppSettings`
