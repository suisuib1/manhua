# 《日记生成漫画后端已完成 API 文档》

## 一、基础信息

- 本地开发地址：`http://127.0.0.1:3000`
- 统一响应格式：`{ code, message, data }`
- 鉴权方式：`Authorization: Bearer <token>`
- 前端 token storage key：`authToken`
- 当前用户 storage key：`currentUser`
- 设置本地兜底 key：`comicAppSettings`

## 二、统一响应格式

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

## 三、接口清单

### 1. GET /api/health

说明：健康检查。

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

### 2. POST /api/auth/wechat/login

说明：小程序端通过 `wx.login` 获取 `code` 后，换取业务 JWT token。

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

- 前端只保存 token，不保存 openid。
- 后端不返回 openid、unionid、session_key。
- 开发环境可使用 `WECHAT_LOGIN_MOCK=true`。

### 3. GET /api/users/me

说明：获取当前登录用户聚合信息。

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

### 4. PUT /api/users/me/profile

说明：更新当前用户资料。

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

允许字段：

- `nickname`
- `avatarUrl`
- `bio`

返回：更新后的 `profile`。

注意：

- 不允许更新 `userId`、`status`、`openid`、`quota` 等字段。
- 多余字段不能生效。

### 5. GET /api/users/me/settings

说明：获取当前用户设置。

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

### 6. PUT /api/users/me/settings

说明：更新当前用户设置。

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

允许字段：

- `autoSaveDraft`
- `keepPhotoMood`
- `privateMode`
- `diaryReminder`
- `generationReminder`

注意：

- 字段值必须是 boolean。
- 未传字段保持原值。
- 不允许更新 `id`、`userId`、`createdAt`、`updatedAt`。

### 7. POST /api/diary-entries

说明：创建当前用户的日记草稿，可同时保存照片元数据。

是否需要登录：是。

Header：`Authorization: Bearer <token>`

请求示例：

```json
{
  "chapterTitle": "今天的小确幸",
  "diaryDate": "2026-05-20",
  "diaryText": "今天和朋友一起散步。",
  "pageCount": 4,
  "pageMode": "continuous",
  "selectedTags": ["开心", "日常"],
  "photos": [
    {
      "imageUrl": "wxfile://tmp_xxx.jpg",
      "originalName": "photo.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 123456,
      "sortOrder": 0
    }
  ]
}
```

返回：创建后的日记草稿，包含 `selectedTags` 数组和 `photos`。

注意：不做真实文件上传，`ownerUserId` 只来自当前登录用户。

### 8. GET /api/diary-entries

说明：获取当前用户的日记草稿列表。

是否需要登录：是。

Query：`status` 默认 `draft`，`page` 默认 `1`，`pageSize` 默认 `20` 且最大 `50`。

返回示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  }
}
```

### 9. GET /api/diary-entries/:id

说明：获取当前用户的单个日记草稿详情。

是否需要登录：是。

返回：日记草稿详情和照片元数据。不存在、已删除、或不属于当前用户时返回 `404`。

### 10. PUT /api/diary-entries/:id

说明：更新当前用户的日记草稿。

是否需要登录：是。

允许字段：`chapterTitle`、`diaryDate`、`diaryText`、`pageCount`、`pageMode`、`selectedTags`、`photos`。

注意：`photos` 传入时采用整体替换策略；旧照片元数据会软删除，新照片元数据会重新创建。

### 11. DELETE /api/diary-entries/:id

说明：软删除当前用户的日记草稿。

是否需要登录：是。

返回示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "deleted": true
  }
}
```

注意：删除会设置 `DiaryEntry.deletedAt`，并同步软删除关联 `DiaryPhoto`。

## 四、常见错误码

- `400`：请求参数错误
- `401`：未登录或登录失效
- `404`：接口不存在
- `500`：服务端错误

## 五、前端接入建议

- 登录成功后保存 `authToken`。
- 调用需要登录的接口时带 `Authorization`。
- token 失效时只清理 `authToken` 和 `currentUser`。
- 不要清理 `draftComicChapter`、`generatedComicChapters`、`comicAppSettings`。
- 设置页登录失败或接口失败时继续使用 `comicAppSettings` 本地兜底。
