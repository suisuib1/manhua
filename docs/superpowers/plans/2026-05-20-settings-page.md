# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight settings page for local comic diary preferences and connect it from the Mine page.

**Architecture:** Reuse the existing `pages/settings/settings` route and keep all state local in `wx` storage. Keep UI in the same warm cream/pink card language used by the rest of the app, and only touch the Mine page menu, shared storage key constants, and the new Settings page files.

**Tech Stack:** WeChat Mini Program, plain JS/WXML/WXSS, `wx` storage APIs, existing node test files.

---

### Task 1: Add local settings storage

**Files:**
- Modify: `manhua-xcx/utils/mock.js`
- Test: `manhua-xcx/pages/settings/settings.test.js`

- [x] **Step 1: Write the failing test**

```js
assert.equal(storage.comicAppSettings.autoSaveDraft, false)
```

- [x] **Step 2: Run test to verify it fails**

Run: `node manhua-xcx/pages/settings/settings.test.js`
Expected: fail until the new storage key exists and settings persistence is implemented.

- [x] **Step 3: Write minimal implementation**

```js
const storageKeys = {
  generatedComicChapters: 'generatedComicChapters',
  draftComicChapter: 'draftComicChapter',
  comicAppSettings: 'comicAppSettings',
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node manhua-xcx/pages/settings/settings.test.js`
Expected: pass.

### Task 2: Build the settings page UI and interactions

**Files:**
- Modify: `manhua-xcx/pages/settings/settings.json`
- Modify: `manhua-xcx/pages/settings/settings.js`
- Modify: `manhua-xcx/pages/settings/settings.wxml`
- Modify: `manhua-xcx/pages/settings/settings.wxss`

- [x] **Step 1: Write the failing test**

```js
assert.equal(wxml.includes('logout-button'), true)
```

- [x] **Step 2: Run test to verify it fails**

Run: `node manhua-xcx/pages/settings/settings.test.js`
Expected: fail before the page contains account, preference, privacy, reminder, help, and logout sections.

- [x] **Step 3: Write minimal implementation**

```js
const defaultSettings = {
  autoSaveDraft: true,
  keepPhotoMood: true,
  privateMode: true,
  diaryReminder: false,
  generationReminder: true,
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node manhua-xcx/pages/settings/settings.test.js`
Expected: pass.

### Task 3: Connect settings from Mine

**Files:**
- Modify: `manhua-xcx/pages/mine/mine.js`
- Test: `manhua-xcx/pages/mine/mine.test.js`

- [x] **Step 1: Write the failing test**

```js
assert.deepEqual(navigateCalls, [{ url: '/pages/settings/settings' }])
```

- [x] **Step 2: Run test to verify it fails**

Run: `node manhua-xcx/pages/mine/mine.test.js`
Expected: fail until the settings menu action navigates to the settings page.

- [x] **Step 3: Write minimal implementation**

```js
if (action === 'privacy' || action === 'about' || action === 'settings') {
  wx.navigateTo({ url: pageRoutes[action] })
  return
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node manhua-xcx/pages/mine/mine.test.js`
Expected: pass.

### Task 4: Verify safety and scope

**Files:**
- Review only

- [x] **Step 1: Check page path exists**

Run: `Test-Path manhua-xcx/pages/settings/settings.js`

- [x] **Step 2: Check diff hygiene**

Run: `git diff --check`

- [x] **Step 3: Run the relevant tests**

Run:
`node manhua-xcx/pages/settings/settings.test.js`
`node manhua-xcx/pages/mine/mine.test.js`
`node manhua-xcx/pages/index/index.test.js`
`node manhua-xcx/pages/generating/generating.test.js`

