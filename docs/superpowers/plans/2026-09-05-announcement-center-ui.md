# Announcement Center UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped announcement text popover with a clickable announcement list and an adjacent full-detail view.

**Architecture:** Keep `AnnouncementPopover` as the owner of loading, read-state, admin actions, and selection state. Render the menu as a two-column responsive panel: a scannable list on the left and the selected announcement detail on the right, while preserving the existing automatic unread dialog behavior for newly arrived announcements.

**Tech Stack:** React, TypeScript, Ariakit Menu, Tailwind utility classes, Jest, Testing Library.

---

### Task 1: Define manual announcement selection behavior

**Files:**
- Modify: `client/src/components/Nav/AnnouncementPopover.spec.tsx`

- [ ] Add a test that opens the announcement menu, clicks a specific announcement row, and asserts its full content is visible in the detail panel.
- [ ] Add a test that clicking another row replaces the detail content without closing the menu.
- [ ] Run the focused test and confirm the new assertions fail against the current article-only menu.

### Task 2: Implement the announcement center layout

**Files:**
- Modify: `client/src/components/Nav/AnnouncementPopover.tsx`

- [ ] Add selected-announcement state, defaulting to the first loaded announcement and keeping selection valid when refreshed data changes.
- [ ] Make each announcement row a keyboard-accessible button with title, date, summary, pinned marker, unread marker, and selected styling.
- [ ] Replace the narrow single-column announcement body with a two-column panel on desktop and a stacked layout on small screens.
- [ ] Render complete selected content in the detail area with a close button and an explicit read action, while preserving admin enable/disable/delete/publish controls.
- [ ] Keep the existing automatic unread detail dialog, focus restore, Escape handling, and read-state request coordination unchanged.

### Task 3: Verify behavior and build

**Files:**
- Inspect: `api/server/routes/announcements.js`
- Inspect: `api/server/routes/announcement-read.js`

- [ ] Run `npm run test:client -- --runInBand src/components/Nav/AnnouncementPopover.spec.tsx`.
- [ ] Run `npx prettier --check client/src/components/Nav/AnnouncementPopover.tsx client/src/components/Nav/AnnouncementPopover.spec.tsx`.
- [ ] Run `git diff --check`.
- [ ] Run `npm run build:client` and report any unrelated pre-existing failures separately.
