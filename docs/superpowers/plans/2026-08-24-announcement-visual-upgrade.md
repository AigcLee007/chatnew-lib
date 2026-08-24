# 公告视觉与交互升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有公告升级为参考图中的自动详情弹窗、右上角公告中心、红点提醒和明确确认已读流程。

**Architecture:** 保留现有公告 API、`Notice` 类型和 Zustand slice。由 `createNoticeSlice` 统一维护公告列表、最新未读公告和已读动作；`App` 只负责在最新未读公告变化时触发一次自动详情弹窗；`NoticePopover` 负责入口、红点和列表；`NoticeModal` 负责遮罩、详情和确认关闭。已读继续使用 `localStorage.lastReadNoticeId`，并在加载时保留已有列表，避免请求失败造成界面闪烁。

**Tech Stack:** React 19、TypeScript、Zustand、Tailwind CSS、Lucide React、Vitest、Testing Library、Vite。

---

### Task 1: 建立公告状态行为的失败测试

**Files:**
- Create: `tests/store/createNoticeSlice.test.ts`
- Test fixture: `types.ts`, `store/index.ts`, `store/slices/createNoticeSlice.ts`

- [ ] **Step 1: 写出 fetchNotices 的未读状态测试**

使用 `createStore` 创建真实 `createNoticeSlice`，mock `global.fetch` 返回一个按最新到最旧排序的公告列表，并设置 `localStorage.lastReadNoticeId` 为旧公告 ID。断言 `notices` 只包含 active 公告，`latestNotice` 和 `hasUnreadNotice` 指向最新公告。

```ts
it('keeps active notices and reports a newer notice as unread', async () => {
  localStorage.setItem('lastReadNoticeId', 'old');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      total: 2,
      page: 1,
      pageSize: 8,
      items: [
        { id: 'new', title: '新公告', content: '内容', date: '2026-08-24', active: true, pinned: true },
        { id: 'old', title: '旧公告', content: '内容', date: '2026-08-23', active: true, pinned: false },
      ],
    }),
  }));

  const store = createTestNoticeStore();
  await store.getState().fetchNotices();

  expect(store.getState().notices).toHaveLength(2);
  expect(store.getState().latestNotice?.id).toBe('new');
  expect(store.getState().hasUnreadNotice).toBe(true);
});
```

`createTestNoticeStore` 使用 `create<StoreState>()` 组合现有 slices，测试只需调用公告 action，不复制生产逻辑。

- [ ] **Step 2: 写出已读 action 的失败测试**

增加两个测试：打开详情不清除红点；确认关闭当前公告后写入 `lastReadNoticeId` 并清除红点；点击“标注已读”时同样写入最新公告 ID并清除红点。测试先手动将 store 状态设置为有未读公告，再调用 action。

```ts
it('marks the confirmed notice read only when the detail is closed', () => {
  const store = createTestNoticeStore();
  const notice = makeNotice('new');
  store.setState({ notices: [notice], latestNotice: notice, hasUnreadNotice: true });

  store.getState().setNoticeModalOpen(true, notice);
  expect(store.getState().hasUnreadNotice).toBe(true);

  store.getState().setNoticeModalOpen(false, notice);
  expect(localStorage.getItem('lastReadNoticeId')).toBe('new');
  expect(store.getState().hasUnreadNotice).toBe(false);
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
npx vitest run tests/store/createNoticeSlice.test.ts
```

Expected: the test file fails because the test harness and the required confirmed-read semantics are not yet implemented or exposed by the current behavior. Fix only test setup errors before proceeding; do not weaken assertions.

- [ ] **Step 4: 提交失败测试**

```bash
git add tests/store/createNoticeSlice.test.ts
git commit -m "test: specify announcement read state behavior"
```

### Task 2: 统一公告状态与自动弹窗触发条件

**Files:**
- Modify: `store/slices/createNoticeSlice.ts`
- Modify: `App.tsx`
- Test: `tests/store/createNoticeSlice.test.ts`

- [ ] **Step 1: 实现最新公告和失败保留逻辑**

在 `fetchNotices` 成功后将 active 列表按 API 返回顺序保存，并将第一条保存到 `latestNotice`；用户请求失败时只记录错误，不把已有 `notices` 清空。管理员列表仍保存完整 `adminNotices`，普通用户只保存 active 公告。

将重复的未读计算收敛为：

```ts
const newestVisible = visibleNotices[0] ?? null;
const lastReadId = localStorage.getItem('lastReadNoticeId');
const hasUnreadNotice = Boolean(newestVisible && newestVisible.id !== lastReadId);
```

`setNoticeModalOpen(true, notice)` 只设置当前详情；只有 `setNoticeModalOpen(false, notice)` 才写入 `lastReadNoticeId` 和清除红点。`markAllAsRead` 使用 `latestNotice ?? notices[0]`，避免列表为空时错误写入。

- [ ] **Step 2: 防止同一公告在当前会话重复自动弹出**

在 `App.tsx` 增加 `autoOpenedNoticeIdRef`。自动弹窗 effect 只在 `hasUnreadNotice && latestNotice && autoOpenedNoticeIdRef.current !== latestNotice.id` 时调用 `setNoticeModalOpen(true, latestNotice)`，然后记录 ID。用户手动从列表打开公告不改变该 ref。

```tsx
useEffect(() => {
  if (!hasUnreadNotice || !latestNotice || autoOpenedNoticeIdRef.current === latestNotice.id) return;
  autoOpenedNoticeIdRef.current = latestNotice.id;
  setNoticeModalOpen(true, latestNotice);
}, [hasUnreadNotice, latestNotice, setNoticeModalOpen]);
```

- [ ] **Step 3: 运行状态测试确认 GREEN**

Run:

```bash
npx vitest run tests/store/createNoticeSlice.test.ts
```

Expected: all store tests pass.

- [ ] **Step 4: 提交状态实现**

```bash
git add store/slices/createNoticeSlice.ts App.tsx tests/store/createNoticeSlice.test.ts
git commit -m "feat: centralize announcement read state"
```

### Task 3: 重做详情弹窗以匹配参考图

**Files:**
- Modify: `components/NoticeModal.tsx`
- Create: `tests/components/NoticeModal.test.tsx`

- [ ] **Step 1: 写出详情弹窗失败测试**

mock `useStore` 返回打开状态和一条公告，断言弹窗有 dialog 语义、标题、发布时间、正文、关闭按钮和“我知道了”按钮；点击两种关闭控件都调用正确的 store action。

```tsx
it('renders announcement details and confirms it from the primary action', async () => {
  const setNoticeModalOpen = vi.fn();
  mockNoticeStore({
    isNoticeModalOpen: true,
    currentNoticeDetail: makeNotice('new'),
    setNoticeModalOpen,
  });

  render(<NoticeModal />);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '新公告' })).toBeInTheDocument();
  expect(screen.getByText('正文内容')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '我知道了' }));
  expect(setNoticeModalOpen).toHaveBeenCalledWith(false, expect.objectContaining({ id: 'new' }));
});
```

- [ ] **Step 2: 实现参考图视觉层级**

详情根节点使用 `fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md`；内容面板使用 `w-full max-w-[450px] rounded-3xl bg-card`。保留 `Megaphone` 图标，增加 `aria-label="关闭公告"`、`role="dialog"`、`aria-modal="true"`，底部按钮保持至少 `min-h-11` 并使用全宽主色按钮。

正文容器使用独立边框和背景，`whitespace-pre-wrap` 保留公告换行。弹窗在窄屏使用 `max-h-[calc(100vh-2rem)] overflow-y-auto`，按钮和关闭控件保持触控尺寸。

- [ ] **Step 3: 运行详情弹窗测试确认 GREEN**

Run:

```bash
npx vitest run tests/components/NoticeModal.test.tsx
```

Expected: all modal tests pass.

- [ ] **Step 4: 提交详情弹窗**

```bash
git add components/NoticeModal.tsx tests/components/NoticeModal.test.tsx
git commit -m "feat: polish announcement detail modal"
```

### Task 4: 重做公告中心列表与入口状态

**Files:**
- Modify: `components/NoticePopover.tsx`
- Create: `tests/components/NoticePopover.test.tsx`

- [ ] **Step 1: 写出公告中心失败测试**

mock store 返回两条公告和 `hasUnreadNotice: true`，断言入口有公告按钮和未读红点；点击入口后出现“通知公告中心”和公告列表；点击公告项关闭列表并打开详情；点击“标注已读”调用 action。

```tsx
it('opens the announcement center and opens a selected notice', async () => {
  const setNoticeModalOpen = vi.fn();
  const markAllAsRead = vi.fn();
  mockNoticeStore({ notices: [makeNotice('new')], hasUnreadNotice: true, setNoticeModalOpen, markAllAsRead });

  render(<NoticePopover />);
  expect(screen.getByLabelText('有新公告')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '通知中心' }));
  expect(screen.getByText('通知公告中心')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /新公告/ }));
  expect(setNoticeModalOpen).toHaveBeenCalledWith(true, expect.objectContaining({ id: 'new' }));
});
```

- [ ] **Step 2: 实现入口与列表视觉细节**

入口按钮保留铃铛图标和主题样式，但移除未读时持续 bounce/pulse，只保留静态红点。红点提供 `aria-label="有新公告"`。公告中心使用右对齐 `w-80` 面板、边框、阴影、圆角和 `z-50`，列表区域使用 `max-h-[350px] overflow-y-auto`。

公告列表项显示置顶图标、标题、日期和两行摘要；使用 `type="button"`，按钮文字内容包含公告标题，保证测试和屏幕阅读器可定位。空状态和底部版权文案保留，但使用主题变量。

移动端在 `max-width` 断点下将面板设置为 `fixed left-4 right-4 top-16 w-auto`，避免右侧面板超出视口；点击外部区域仍关闭面板。

- [ ] **Step 3: 运行公告中心测试确认 GREEN**

Run:

```bash
npx vitest run tests/components/NoticePopover.test.tsx
```

Expected: all popover tests pass.

- [ ] **Step 4: 提交公告中心**

```bash
git add components/NoticePopover.tsx tests/components/NoticePopover.test.tsx
git commit -m "feat: polish announcement center"
```

### Task 5: 集成验证和视觉回归

**Files:**
- Verify: `App.tsx`
- Verify: `components/NoticeModal.tsx`
- Verify: `components/NoticePopover.tsx`
- Verify: `store/slices/createNoticeSlice.ts`

- [ ] **Step 1: 运行全部公告测试**

```bash
npx vitest run tests/store/createNoticeSlice.test.ts tests/components/NoticeModal.test.tsx tests/components/NoticePopover.test.tsx
```

Expected: all announcement tests pass with zero failures.

- [ ] **Step 2: 运行 TypeScript 构建**

```bash
npm run build
```

Expected: Vite exits with code 0 and emits the production bundle.

- [ ] **Step 3: 运行 lint**

```bash
npm run lint
```

Expected: no new lint errors. Existing warnings may be reported, but the changed announcement files must not introduce errors.

- [ ] **Step 4: 检查最终差异**

```bash
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: only the announcement plan/spec, announcement slice/app/modal/popover and their tests are included in the feature commits; pre-existing unrelated user changes remain unstaged.

- [ ] **Step 5: 提交最终验证记录**

```bash
git add docs/superpowers/specs/2026-08-24-announcement-visual-upgrade-design.md docs/superpowers/plans/2026-08-24-announcement-visual-upgrade.md
git commit -m "docs: add announcement upgrade implementation plan"
```
