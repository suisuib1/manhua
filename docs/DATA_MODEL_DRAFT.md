# 数据模型草案

本文档只描述概念模型，不创建数据库代码、不创建 migration、不创建 MyBatis mapper。

## User

用户基础身份。

- id
- openid
- nickname
- avatarUrl
- createdAt
- updatedAt
- deletedAt

## UserCharacterProfile

用户固定主角角色档案。

- id
- userId
- characterName
- relationshipLabel
- ageRange
- genderExpression
- hairstyle
- hairColor
- faceFeature
- outfit
- accessory
- personalityKeywords
- referenceImageUrl
- description
- createdAt
- updatedAt

## ComicBook

用户默认漫画书。

- id
- userId
- title
- isDefault
- createdAt
- updatedAt

## ComicChapter

日记生成的漫画章节。

- id
- userId
- comicBookId
- title
- diaryText
- diaryDate
- pageMode
- pageCount
- selectedTags
- status
- latestGenerationTaskId
- createdAt
- updatedAt
- deletedAt

## ChapterPhoto

章节照片记录。

- id
- userId
- chapterId
- imageUrl
- sortOrder
- usedForGeneration
- createdAt
- deletedAt

## GenerationTask

异步生成任务。

- id
- userId
- chapterId
- characterProfileId
- status
- promptVersion
- promptText
- providerCode
- providerTaskId
- failureReason
- retryFromTaskId
- freeRetry
- startedAt
- finishedAt
- createdAt
- updatedAt

说明：

- providerCode 初版可以为空或为适配层内部标识，不得在业务需求中绑定具体供应商。
- providerTaskId 只存储供应商侧任务 ID，不应泄漏到小程序页面。

## ComicImage

生成结果图片。

- id
- userId
- chapterId
- generationTaskId
- imageUrl
- sortOrder
- status
- createdAt

## ShareLink

章节私密分享链接。

- id
- userId
- chapterId
- shareToken
- status
- expiresAt
- createdAt
- disabledAt

说明：

- 初版只分享章节。
- shareToken 应避免可枚举。
- 分享页只能访问绑定章节，不得访问整本书或其他章节。

## FreeQuotaRecord

免费次数记录。

- id
- userId
- changeType
- changeAmount
- relatedTaskId
- reason
- createdAt

说明：

- changeType 可表示发放、消耗、返还等。
- 生成失败后的免费重试不重复消耗次数。
- 初版不进入支付、订单、充值、会员设计。

## SensitiveWord

简单敏感词配置。

- id
- word
- category
- enabled
- createdAt
- updatedAt

说明：

- 初版只做简单敏感词过滤。
- 不做复杂内容审核平台。
