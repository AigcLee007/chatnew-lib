# Announcement Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the new repository's announcement experience so unread announcements show a red dot, open a readable detail dialog, and are marked read immediately when the announcement entry is opened.

**Architecture:** Keep the existing `AnnouncementPopover` as the single owner of announcement fetching, admin actions, and read-state coordination. Add a focused detail dialog inside the component with explicit close/acknowledge behavior, while preserving the existing `/api/announcements` and `/api/announcements/read` contracts. Protect state with request versions and snapshot IDs so stale responses or older read requests cannot clear newer announcements.

**Tech Stack:** React, TypeScript, Ariakit Menu, Tailwind CSS, Jest, Testing Library, Node API routes.

---

### Task 1: Add failing detail-dialog behavior tests

**Files:**
- Modify: `client/src/components/Nav/AnnouncementPopover.spec.tsx`
- Modify: `client/src/components/Nav/AnnouncementPopover.tsx`

- [ ] **Step 1: Write tests for the required user-visible behavior**

Add tests that render a single unread announcement and assert:

```tsx
it('opens an announcement detail dialog for a newly unread item', async () => {
  fetchMock.mockImplementation((url: string) =>
    url === '/api/announcements/read'
      ? jsonResponse({ ok: true })
      : jsonResponse([{ _id: 'a-1', title: 'Release', content: 'Details', unread: true }]),
  );

  render(<AnnouncementPopover compact />);

  expect(await screen.findByRole('dialog', { name: 'Release' })).toBeInTheDocument();
  expect(screen.getByText('Details')).toBeInTheDocument();
});

it('closes the detail dialog and keeps the entry without a red dot after acknowledgement', async () => {
  fetchMock.mockImplementation((url: string) =>
    url === '/api/announcements/read'
      ? jsonResponse({ ok: true })
      : jsonResponse([{ _id: 'a-1', title: 'Release', content: 'Details', unread: true }]),
  );

  render(<AnnouncementPopover compact />);
  expect(await screen.findByRole('dialog', { name: 'Release' })).toBeInTheDocument();

  await userEvent.setup().click(screen.getByRole('button', { name: '我知道了' }));

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Release' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused test to confirm the new assertions fail**

Run: `npm run test:client -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`

Expected: the new dialog assertions fail because the current component only renders the menu popover.

- [ ] **Step 3: Commit the red tests**

```bash
git add client/src/components/Nav/AnnouncementPopover.spec.tsx
git commit -m "test: define announcement detail dialog behavior"
```

### Task 2: Implement the announcement detail dialog

**Files:**
- Modify: `client/src/components/Nav/AnnouncementPopover.tsx`

- [ ] **Step 1: Add dialog state and focus references**

Track the currently displayed unread announcement, the announcement trigger element, and a dialog ref. Derive the first unread item from the latest `items` state. Keep the existing `seenUnreadIdsRef` behavior so the dialog opens only when an unread ID newly appears.

- [ ] **Step 2: Render an accessible responsive dialog**

Render a portal dialog when an unread item is newly detected:

```tsx
<div role="presentation" className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4">
  <section
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="announcement-detail-title"
    className="max-h-[min(80vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl bg-surface-primary p-6 shadow-xl"
  >
    <h2 id="announcement-detail-title">{announcement.title}</h2>
    <p className="whitespace-pre-wrap">{announcement.content}</p>
    <button type="button" onClick={acknowledge}>我知道了</button>
  </section>
</div>
```

Close on the close button, Escape, and acknowledgement. Restore focus to the saved announcement trigger after close.

- [ ] **Step 3: Run the focused tests and existing announcement tests**

Run: `npm run test:client -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`

Expected: all announcement component tests pass.

- [ ] **Step 4: Commit the dialog implementation**

```bash
git add client/src/components/Nav/AnnouncementPopover.tsx client/src/components/Nav/AnnouncementPopover.spec.tsx
git commit -m "feat: add announcement detail dialog"
```

### Task 3: Harden read-state coordination against stale responses

**Files:**
- Modify: `client/src/components/Nav/AnnouncementPopover.tsx`
- Modify: `client/src/components/Nav/AnnouncementPopover.spec.tsx`

- [ ] **Step 1: Add regression tests for snapshot-safe marking**

Cover these cases:

```tsx
it('does not clear a newer unread announcement when an older read request resolves', async () => {
  // Resolve the first read request after a focus refresh returns a second unread ID.
  // Assert the second ID remains in the next read request and its red dot remains visible.
});

it('does not let an older announcement list response replace the newest response', async () => {
  // Resolve the second load first, then resolve the first load with stale data.
  // Assert the newest title remains rendered and the newest unread flag remains.
});
```

- [ ] **Step 2: Run the regression tests and observe the failure if the current guards are insufficient**

Run: `npm run test:client -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`

- [ ] **Step 3: Implement snapshot-safe request handling**

Use a monotonically increasing load version and a read snapshot of announcement IDs. After a successful read response, update only IDs that were part of the request and still have the same unread state; leave newer IDs untouched. Queue a follow-up read when a new unread snapshot arrives while a read request is in flight.

- [ ] **Step 4: Run all announcement tests**

Run: `npm run test:client -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`

Expected: all announcement tests pass with no unhandled promise warnings.

- [ ] **Step 5: Commit the coordination fix**

```bash
git add client/src/components/Nav/AnnouncementPopover.tsx client/src/components/Nav/AnnouncementPopover.spec.tsx
git commit -m "fix: preserve newer unread announcements"
```

### Task 4: Verify API compatibility and client build

**Files:**
- Inspect: `api/server/routes/announcement-read.js`
- Inspect: `api/server/routes/announcements.js`
- Inspect: `client/src/components/Nav/AnnouncementPopover.tsx`

- [ ] **Step 1: Run announcement API tests**

Run: `npm run test:api -- --runInBand server/routes/announcement-read.test.js server/routes/announcement-utils.test.js`

Expected: all announcement API tests pass.

- [ ] **Step 2: Run the client announcement tests again**

Run: `npm run test:client -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`

Expected: all component tests pass.

- [ ] **Step 3: Run formatting and whitespace checks**

Run: `npx prettier --check client/src/components/Nav/AnnouncementPopover.tsx client/src/components/Nav/AnnouncementPopover.spec.tsx`

Run: `git diff --check`

Expected: both commands exit successfully.

- [ ] **Step 4: Build the affected frontend**

Run: `npm run build:client`

Expected: the client build exits with code 0.

- [ ] **Step 5: Commit any formatting-only changes and record verification**

```bash
git status --short
git log --oneline -5
```

Do not commit generated build output. If formatting changed source files, commit them with:

```bash
git add client/src/components/Nav/AnnouncementPopover.tsx client/src/components/Nav/AnnouncementPopover.spec.tsx
git commit -m "chore: format announcement upgrade"
```

### Task 5: Push branch and merge into main

**Files:**
- Git metadata only.

- [ ] **Step 1: Verify the feature worktree is clean and based on current origin/main**

Run: `git status --short --branch`

Run: `git fetch origin`

Run: `git log --oneline --decorate -5`

- [ ] **Step 2: Push the feature branch**

```bash
git push -u origin feature/chatnew-announcement
```

- [ ] **Step 3: Fast-forward the local main in a clean checkout**

Use a clean worktree or checkout tracking `origin/main`; do not touch the user's existing dirty checkout. Merge with:

```bash
git fetch origin
git merge --ff-only feature/chatnew-announcement
git push origin main
```

- [ ] **Step 4: Verify remote refs**

Run: `git ls-remote origin refs/heads/main refs/heads/feature/chatnew-announcement`

Expected: `main` points to the tested announcement commit or its fast-forward descendant, and the feature branch points to the same tested history.
