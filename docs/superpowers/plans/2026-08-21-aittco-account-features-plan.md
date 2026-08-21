# Aittco Account Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add shared-key quota visibility, customer-service QR access, and MongoDB-backed announcements for users and administrators.

**Architecture:** Reuse existing authenticated Express/JWT and Mongo model patterns. The quota endpoint resolves the encrypted `aittco_shared` credential server-side and returns normalized, non-secret usage data. Announcements use a dedicated model and role-protected CRUD routes; the client exposes compact header popovers and settings management.

**Tech Stack:** Node.js, Express, Mongoose, React, TypeScript, React Query, Jest, existing LibreChat UI primitives.

---

### Task 1: Quota API

- [ ] Write failing tests for missing shared key, normalized provider response, and secret redaction.
- [ ] Implement `GET /api/keys/aittco/quota` with 60-second per-key cache and provider fallback endpoints.
- [ ] Add client query/types and a settings panel with totals, remaining, percentage, and refresh.
- [ ] Run focused API/client tests and commit.

### Task 2: Customer Service

- [ ] Add failing render/interaction tests.
- [ ] Add QR asset and accessible popover with enlarged preview.
- [ ] Integrate the entry point into the existing navigation/settings surface.
- [ ] Run focused client tests and commit.

### Task 3: Announcements

- [ ] Write failing route and permission tests.
- [ ] Implement MongoDB CRUD with `ADMIN` authorization and public active-list reads.
- [ ] Add user bell/list/detail UI with pinned/unread handling.
- [ ] Add admin publish/edit/disable/delete controls.
- [ ] Run focused API/client tests and commit.

### Task 4: Integration Verification

- [ ] Run lint, focused suites, and production client/API builds.
- [ ] Perform a local browser smoke test for quota, QR, and announcements.
- [ ] Request code review, fix findings, merge to `main`, verify merged tests, and push `chatnew/main`.
