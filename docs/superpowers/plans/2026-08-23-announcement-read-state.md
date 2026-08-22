# 公告未读弹窗与已读红点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为登录用户增加公告级别的服务端已读状态，使未读公告自动打开现有公告列表并显示红点，用户打开列表后红点消失，新公告再次触发提示。

**Architecture:** 在公告路由旁新增独立的 `AnnouncementRead` Mongoose 模型，用 `userId + announcementId` 唯一索引保存用户已读记录。`GET /api/announcements` 将当前用户可见公告映射为带 `unread` 字段的响应，`POST /api/announcements/read` 对可见公告执行幂等批量写入；客户端 `AnnouncementPopover` 以服务端 `unread` 为准，打开列表时标记当前可见公告已读，并在窗口重新获得焦点时刷新公告。

**Tech Stack:** Express、Mongoose、Jest、React 18、Ariakit Menu、Testing Library、TypeScript、现有 Tailwind 主题类。

---

## 文件结构

- Create: `api/server/routes/announcement-read.js`，定义已读记录 schema/model 和路由使用的查询、批量写入辅助函数，避免把读状态逻辑继续堆进公告排序工具。
- Modify: `api/server/routes/announcements.js`，读取当前用户已读记录、返回 `unread`，并注册 `POST /read`。
- Create: `api/server/routes/announcement-read.test.js`，覆盖已读记录查询、可见性过滤和幂等写入。
- Modify: `client/src/components/Nav/AnnouncementPopover.tsx`，增加 `unread` 类型、自动打开、打开即已读、焦点刷新和失败重试。
- Create: `client/src/components/Nav/AnnouncementPopover.spec.tsx`，使用 Testing Library 验证红点、自动弹窗、成功标记和失败重试。

## Task 1: 建立服务端已读记录的失败测试

**Files:**
- Create: `api/server/routes/announcement-read.test.js`

- [ ] **Step 1: 写出已读查询的失败测试**

在 `announcement-read.test.js` 中测试一个用户只会得到自己读过的公告 ID。测试用轻量 fake model 注入 `find({ userId })`，避免依赖 MongoDB：

```js
const { getReadAnnouncementIds, markAnnouncementsRead } = require('./announcement-read');

describe('announcement-read', () => {
  it('returns only announcement ids read by the requested user', async () => {
    const ReadModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { announcementId: 'a-1' },
          { announcementId: 'a-2' },
        ]),
      }),
    };

    await expect(getReadAnnouncementIds(ReadModel, 'user-1')).resolves.toEqual(
      new Set(['a-1', 'a-2']),
    );
    expect(ReadModel.find).toHaveBeenCalledWith({ userId: 'user-1' }, { announcementId: 1 });
  });
});
```

- [ ] **Step 2: 写出可见公告过滤和幂等批量写入的失败测试**

增加两个测试：`markAnnouncementsRead` 只为服务端传入的可见公告写入，并用 `bulkWrite(..., { ordered: false })` 携带 `upsert: true`；空列表不产生数据库写入。

```js
it('upserts one read record per visible announcement and ignores invalid ids', async () => {
  const ReadModel = { bulkWrite: jest.fn().mockResolvedValue({}) };

  await markAnnouncementsRead(ReadModel, 'user-1', ['a-1', 'a-2'], new Set(['a-1']));

  expect(ReadModel.bulkWrite).toHaveBeenCalledWith(
    [
      {
        updateOne: {
          filter: { userId: 'user-1', announcementId: 'a-1' },
          update: { $set: { readAt: expect.any(Date) } },
          upsert: true,
        },
      },
    ],
    { ordered: false },
  );
});

it('does not write when no visible announcement was supplied', async () => {
  const ReadModel = { bulkWrite: jest.fn() };

  await markAnnouncementsRead(ReadModel, 'user-1', ['missing'], new Set());

  expect(ReadModel.bulkWrite).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: 运行测试确认是预期的 RED**

Run: `npm --prefix api test -- --runInBand server/routes/announcement-read.test.js`

Expected: FAIL because `api/server/routes/announcement-read.js` does not exist yet. Fix test syntax or import errors if they appear; do not add production implementation before the tests fail for the missing module.

## Task 2: 实现服务端已读模型和公告接口

**Files:**
- Create: `api/server/routes/announcement-read.js`
- Modify: `api/server/routes/announcements.js`
- Test: `api/server/routes/announcement-read.test.js`

- [ ] **Step 1: 实现最小已读模型和纯辅助函数**

在 `announcement-read.js` 中定义 `AnnouncementRead` schema，字段类型分别为 `ObjectId`、`ObjectId`、`Date`，创建唯一复合索引 `{ userId: 1, announcementId: 1 }`。导出 `getAnnouncementReadModel(mongoose)`, `getReadAnnouncementIds(ReadModel, userId)` 和 `markAnnouncementsRead(ReadModel, userId, announcementIds, visibleIds)`；`visibleIds` 是服务端根据公告可见性算出的 Set，函数只转换为合法的 upsert 操作。

```js
const mongoose = require('mongoose');
const { isVisibleAnnouncement } = require('./announcement-utils');

const announcementReadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
announcementReadSchema.index({ userId: 1, announcementId: 1 }, { unique: true });

function getAnnouncementReadModel(mongooseInstance) {
  return mongooseInstance.models.AnnouncementRead ||
    mongooseInstance.model('AnnouncementRead', announcementReadSchema);
}

function addUnreadFlags(items, readIds, now = new Date()) {
  return items.map((item) => ({
    ...item,
    unread:
      isVisibleAnnouncement(item, now) && !readIds.has(item._id.toString()),
  }));
}

async function getReadAnnouncementIds(ReadModel, userId) {
  const rows = await ReadModel.find({ userId }, { announcementId: 1 }).lean();
  return new Set(rows.map((row) => row.announcementId.toString()));
}

async function markAnnouncementsRead(ReadModel, userId, announcementIds, visibleIds) {
  const operations = [...new Set(announcementIds)]
    .filter((id) => visibleIds.has(id))
    .map((announcementId) => ({
      updateOne: {
        filter: { userId, announcementId },
        update: { $set: { readAt: new Date() } },
        upsert: true,
      },
    }));
  if (operations.length > 0) await ReadModel.bulkWrite(operations, { ordered: false });
}

module.exports = {
  getAnnouncementReadModel,
  getReadAnnouncementIds,
  markAnnouncementsRead,
  addUnreadFlags,
};
```

The helper imports `isVisibleAnnouncement` from `./announcement-utils` so inactive and future announcements cannot become unread through a caller mistake.

- [ ] **Step 2: 运行服务端测试确认 GREEN**

Run: `npm --prefix api test -- --runInBand server/routes/announcement-read.test.js`

Expected: PASS for the query, visibility filtering and no-op cases.

- [ ] **Step 3: 为 GET 路由写出未读映射测试**

在 `announcement-read.test.js` 中增加纯数据测试，构造两条可见公告和一个已读 ID，断言只有未读公告得到 `unread: true`，停用或未来公告得到 `unread: false`。实现一个导出的 `addUnreadFlags(items, readIds)` helper 以保持路由测试不依赖网络连接：

```js
it('marks only visible announcements without a read record as unread', () => {
  const { addUnreadFlags } = require('./announcement-read');
  const items = [
    { _id: 'a-1', active: true, publishAt: new Date('2026-08-22') },
    { _id: 'a-2', active: true, publishAt: new Date('2026-08-22') },
    { _id: 'a-3', active: false, publishAt: new Date('2026-08-22') },
  ];

  expect(addUnreadFlags(items, new Set(['a-1']))).toEqual([
    expect.objectContaining({ _id: 'a-1', unread: false }),
    expect.objectContaining({ _id: 'a-2', unread: true }),
    expect.objectContaining({ _id: 'a-3', unread: false }),
  ]);
});
```

- [ ] **Step 4: 接入 GET 和 POST 路由**

在 `announcements.js` 引入三个 helper，并在 `GET /` 查询结果后取得当前用户的已读 ID。`all=true` 管理员响应仍返回所有管理员可见项，但 `unread` 只对 `isVisibleAnnouncement(item)` 为真的项计算；普通用户响应全部是可见项。注册 `router.post('/read', ...)`，放在 `router.get('/:id', ...)` 之前，读取 `{ announcementIds: [] }`，拒绝非数组输入为 `400`，重新查询当前用户可见公告后调用 `markAnnouncementsRead`，成功返回 `{ ok: true }`。

```js
const {
  getAnnouncementReadModel,
  getReadAnnouncementIds,
  markAnnouncementsRead,
  addUnreadFlags,
} = require('./announcement-read');
const AnnouncementRead = getAnnouncementReadModel(mongoose);

// GET /: list response
const readIds = await getReadAnnouncementIds(AnnouncementRead, req.user.id);
const response = addUnreadFlags(visible.map(publicAnnouncement), readIds);
res.json(sortAnnouncements(response));

router.post('/read', async (req, res, next) => {
  try {
    if (!Array.isArray(req.body?.announcementIds)) {
      return res.status(400).json({ error: 'announcementIds must be an array' });
    }
    const visibleItems = await Announcement.find({ active: true, publishAt: { $lte: new Date() } })
      .select({ _id: 1, active: 1, publishAt: 1 })
      .lean();
    const visibleIds = new Set(
      visibleItems.filter((item) => isVisibleAnnouncement(item)).map((item) => item._id.toString()),
    );
    await markAnnouncementsRead(
      AnnouncementRead,
      req.user.id,
      req.body.announcementIds.map(String),
      visibleIds,
    );
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
```

The implementing worker must preserve the existing `all=true` filtering and `publicAnnouncement` behavior, and must avoid returning `createdBy`.

- [ ] **Step 5: Run service tests and lint the changed server files**

Run: `npm --prefix api test -- --runInBand server/routes/announcement-read.test.js server/routes/announcement-utils.test.js`

Expected: PASS with zero failures.

Run: `npx eslint api/server/routes/announcement-read.js api/server/routes/announcements.js api/server/routes/announcement-read.test.js`

Expected: exit code `0` with no errors.

- [ ] **Step 6: Commit the server implementation**

```bash
git add api/server/routes/announcement-read.js api/server/routes/announcement-read.test.js api/server/routes/announcements.js
git commit -m "feat: persist announcement read state"
```

## Task 3: Establish client behavior with failing tests

**Files:**
- Create: `client/src/components/Nav/AnnouncementPopover.spec.tsx`

- [ ] **Step 1: Add a focused component test harness**

Mock `useAuthContext` with an authenticated regular user and mock `getTokenHeader` to return a stable token. Keep the real Ariakit menu components so the test verifies both automatic opening and a later manual reopen. Use a mutable `fetch` mock returning JSON from `GET /api/announcements` and recording `POST /api/announcements/read`.

Use this concrete harness shape so the tests exercise the component state while leaving menu behavior real:

```tsx
const fetchMock = jest.fn();

jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ user: { role: 'USER' } }),
}));
jest.mock('librechat-data-provider', () => ({ getTokenHeader: () => 'Bearer test' }));

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}
```

- [ ] **Step 2: Write the RED tests**

Cover these exact behaviors:

```tsx
it('auto-opens and shows a red dot when an announcement is unread', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse([{ _id: 'a-1', title: 'New', content: 'Body', unread: true }]));
  fetchMock.mockImplementationOnce(() => new Promise(() => {}));

  render(<AnnouncementPopover compact />);

  expect(await screen.findByText('New')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/announcements/read', expect.objectContaining({ method: 'POST' }));
  expect(screen.getByLabelText('有新公告')).toBeInTheDocument();
});

it('removes the red dot after opening and successfully marking announcements read', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse([{ _id: 'a-1', title: 'Read me', content: 'Body', unread: true }]));
  fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

  render(<AnnouncementPopover compact />);
  expect(await screen.findByText('Read me')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument());
  expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({
    body: JSON.stringify({ announcementIds: ['a-1'] }),
  }));
});

it('keeps the red dot and retries when marking announcements read fails', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse([{ _id: 'a-1', title: 'Retry', content: 'Body', unread: true }]));
  fetchMock.mockRejectedValueOnce(new Error('network'));
  fetchMock.mockResolvedValueOnce(jsonResponse([{ _id: 'a-1', title: 'Retry', content: 'Body', unread: true }]));
  fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

  render(<AnnouncementPopover compact />);
  expect(await screen.findByText('Retry')).toBeInTheDocument();
  expect(screen.getByLabelText('有新公告')).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: '公告' }));
  await waitFor(() => expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument());
});
```

The test should assert the POST body contains `announcementIds: ['a-1']`, and should use `waitFor` for effects rather than fixed sleeps.

- [ ] **Step 3: Run the client test and verify RED**

Run: `npm --prefix client test -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`

Expected: FAIL because the component does not yet use `unread`, does not auto-open, and does not call the read endpoint.

## Task 4: Implement client automatic popup and read state

**Files:**
- Modify: `client/src/components/Nav/AnnouncementPopover.tsx`
- Test: `client/src/components/Nav/AnnouncementPopover.spec.tsx`

- [ ] **Step 1: Extend the announcement type**

Add `unread?: boolean` to the local `Announcement` type:

```tsx
type Announcement = {
  _id: string;
  title: string;
  content: string;
  unread?: boolean;
  pinned?: boolean;
  active?: boolean;
};
```

Keep the existing optional admin fields so the `all=true` response remains compatible.

- [ ] **Step 2: Make loading stable and refresh on focus**

Wrap `load` in `useCallback` with `canManage` as its dependency. Keep the existing auth header behavior. Add a `window.addEventListener('focus', load)` effect with cleanup, gated by the authenticated user so unauthenticated renders do not issue requests:

```tsx
const load = useCallback(() => {
  return fetch(`/api/announcements${canManage ? '?all=true' : ''}`, { headers: authHeaders() })
    .then((response) => (response.ok ? response.json() : []))
    .then(setItems)
    .catch(() => setItems([]));
}, [canManage]);

useEffect(() => {
  if (!user) return undefined;
  void load();
  window.addEventListener('focus', load);
  return () => window.removeEventListener('focus', load);
}, [load, user]);
```

- [ ] **Step 3: Auto-open when unread data arrives**

Derive `hasUnread = items.some((item) => item.unread === true)`. Add an effect that calls `setOpen(true)` when `hasUnread && !open`. Do not use localStorage; the server response is the source of truth, so a newly-created announcement with a new ID can retrigger the behavior.

- [ ] **Step 4: Mark announcements read from the open state**

Add `markRead` that posts only currently visible unread IDs. On `response.ok`, update local state with `item.unread: false`; on any failure, leave items unchanged so the red dot remains. Add an effect that invokes `markRead` whenever `open` becomes true, with a ref or in-flight guard preventing duplicate concurrent POSTs for the same ID set.

```tsx
const markRead = useCallback(async () => {
  const announcementIds = items.filter((item) => item.unread).map((item) => item._id);
  if (announcementIds.length === 0 || markingRef.current) return;
  markingRef.current = true;
  try {
    const response = await fetch('/api/announcements/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ announcementIds }),
    });
    if (response.ok) {
      setItems((current) => current.map((item) =>
        announcementIds.includes(item._id) ? { ...item, unread: false } : item,
      ));
    }
  } finally {
    markingRef.current = false;
  }
}, [items]);

useEffect(() => {
  if (open) void markRead();
}, [open, markRead]);
```

The implementation must ensure a failed request leaves `unread` unchanged and that the next manual open can retry after the menu is closed. Preserve existing admin publish/update/delete actions.

- [ ] **Step 5: Run client tests and typecheck**

Run: `npm --prefix client test -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`

Expected: PASS for all announcement behavior tests.

Run: `npm --prefix client run typecheck`

Expected: exit code `0` with no TypeScript errors.

- [ ] **Step 6: Run the full client test suite and lint changed client files**

Run: `npm run test:client -- --runInBand`

Expected: PASS with zero failures.

Run: `npx eslint client/src/components/Nav/AnnouncementPopover.tsx client/src/components/Nav/AnnouncementPopover.spec.tsx`

Expected: exit code `0` with no errors.

- [ ] **Step 7: Commit the client implementation**

```bash
git add client/src/components/Nav/AnnouncementPopover.tsx client/src/components/Nav/AnnouncementPopover.spec.tsx
git commit -m "feat: show unread announcement popup"
```

## Task 5: Final verification

**Files:**
- Verify: `api/server/routes/announcement-read.js`
- Verify: `api/server/routes/announcements.js`
- Verify: `client/src/components/Nav/AnnouncementPopover.tsx`
- Verify: `docs/superpowers/specs/2026-08-23-announcement-read-state-design.md`

- [ ] **Step 1: Run focused backend and frontend tests together**

Run: `npm --prefix api test -- --runInBand server/routes/announcement-read.test.js server/routes/announcement-utils.test.js; npm --prefix client test -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`

Expected: both commands exit `0` with zero failures.

- [ ] **Step 2: Run repository status and inspect the final diff**

Run: `git status --short; git diff HEAD~2..HEAD --stat; git diff HEAD~2..HEAD --check`

Expected: only the announcement design, server read-state implementation/tests, and client announcement implementation/tests are included in the commits; `git diff --check` prints no whitespace errors. Preserve unrelated existing worktree changes.

- [ ] **Step 3: Record residual risk**

Confirm that no real MongoDB-backed route integration test was added if the local test environment lacks a database. Report that limitation explicitly; the pure helper tests and client request contract still provide deterministic coverage.
