# ChatVIP Version Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-end, responsive version-selection page at `https://chatvip.aittco.com` that prominently routes users to the new ChatVIP experience at `https://chat.aittco.com` and keeps the classic experience available at `https://chatvvip.aittco.com`.

**Architecture:** Add an isolated static portal under `portal/` in the classic project repository. It contains only HTML, CSS, and browser JavaScript, so it does not share runtime state, cookies, API routes, or build output with either chat application. Nginx (or the hosting panel's equivalent) serves the portal at the root domain and reverse-proxies the two target domains to their existing services.

**Tech Stack:** Semantic HTML5, vanilla JavaScript, CSS custom properties/grid, Playwright smoke checks, Nginx HTTPS/reverse proxy.

---

## File map

- Create: `portal/index.html` — semantic page structure, product copy, navigation targets, metadata.
- Create: `portal/styles.css` — dark high-end visual system, responsive grid, focus states, reduced-motion rules.
- Create: `portal/app.js` — safe same-tab navigation, external-link analytics hook, no persistence or chat state.
- Create: `portal/README.md` — local preview, deployment, and rollback instructions.
- Create: `portal/tests/portal.spec.js` — Playwright smoke tests for content, hierarchy, responsive order, and exact destinations.
- Create: `deploy/nginx/chatvip-portal.conf.example` — reference virtual-host configuration for the root portal and both target domains.

The existing chat source files remain unchanged. The working tree already contains unrelated modifications; implementation must stage only the portal and deployment files listed above.

### Task 1: Create the static portal shell

**Files:**
- Create: `portal/index.html`
- Create: `portal/app.js`

- [ ] **Step 1: Create semantic HTML with exact production destinations**

Add a document with `lang="zh-CN"`, a descriptive title, a viewport meta tag, and canonical URL `https://chatvip.aittco.com/`. The main content must include:

```html
<main class="portal-shell">
  <header class="brand-bar">
    <a class="brand" href="https://chatvip.aittco.com/" aria-label="AITTCO 首页">AITTCO</a>
    <a class="help-link" href="https://aittco.com" rel="noopener">AITTCO 官网</a>
  </header>
  <section class="hero" aria-labelledby="portal-title">
    <p class="eyebrow">AITTCO AI WORKSPACE</p>
    <h1 id="portal-title">选择你的 AI 工作空间</h1>
    <p class="hero-copy">从快速对话到专业智能体工作流，选择适合你的体验。</p>
  </section>
  <section class="version-grid" aria-label="网站版本选择">
    <article class="version-card version-card--new" data-version="new">
      <div class="card-topline"><span class="badge badge--recommended">推荐使用 · 全功能版</span><span class="card-index">01</span></div>
      <h2>ChatVIP 新版</h2>
      <p class="card-description">为复杂任务打造的 AI 工作空间。</p>
      <ul class="feature-list">
        <li>登录账号，对话记录跨设备保留</li>
        <li>GPT、Claude、Gemini、Grok 多模型</li>
        <li>AI 智能体、MCP 与 Skills</li>
        <li>联网搜索、文件分析与代码执行</li>
      </ul>
      <a class="card-cta card-cta--primary" data-target="new" href="https://chat.aittco.com">进入新版 <span aria-hidden="true">→</span></a>
    </article>
    <article class="version-card version-card--classic" data-version="classic">
      <div class="card-topline"><span class="badge">经典体验</span><span class="card-index">02</span></div>
      <h2>ChatVIP 经典版</h2>
      <p class="card-description">简洁、熟悉的 AI 对话体验。</p>
      <ul class="feature-list">
        <li>操作直接，上手简单</li>
        <li>支持常用 AI 模型</li>
        <li>支持文件处理和内容导出</li>
        <li>对话记录保存在当前浏览器</li>
      </ul>
      <a class="card-cta" data-target="classic" href="https://chatvvip.aittco.com">进入经典版 <span aria-hidden="true">→</span></a>
    </article>
  </section>
</main>
<footer class="site-footer"><span>© AITTCO</span><span>选择后可随时通过浏览器返回本页</span></footer>
```

Use absolute HTTPS URLs exactly as shown. Keep the links as normal anchors so keyboard users and browser history work without JavaScript.

- [ ] **Step 2: Add progressive-enhancement navigation behavior**

In `portal/app.js`, add a delegated click listener that emits a `portal_version_select` event to `window.dataLayer` only when that array already exists, then allows the anchor's native navigation:

```js
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-target]');
  if (!link) return;
  const target = link.dataset.target;
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: 'portal_version_select', version: target });
  }
});
```

Do not add cookies, localStorage, automatic redirects, iframe embeds, or API calls.

- [ ] **Step 3: Verify the shell manually**

Run `Get-Content portal/index.html` and confirm both target URLs occur exactly once and the page contains one `h1`, two `h2` headings, and two `data-target` links.

### Task 2: Implement the high-end visual system

**Files:**
- Create: `portal/styles.css`
- Modify: `portal/index.html` — add `<link rel="stylesheet" href="/styles.css">` and `<script defer src="/app.js"></script>`.

- [ ] **Step 1: Define the dark visual tokens and layout**

Implement CSS custom properties for `#070A12`, `#F4F6FB`, `#9CA6BA`, and a blue-violet accent. Use a fixed low-contrast grid background with radial gradients, a centered shell capped at 1180px, and a two-column grid with `grid-template-columns: minmax(0, 1.65fr) minmax(280px, 0.9fr)`.

- [ ] **Step 2: Style the recommended card as the visual primary**

Give `.version-card--new` the brighter border, larger internal spacing, accent glow, and primary gradient button. Give `.version-card--classic` a muted border and neutral button. Ensure the recommended badge is visually distinct and the new card appears first in source order.

- [ ] **Step 3: Add restrained interaction and accessibility states**

Add transitions limited to `transform`, `opacity`, `border-color`, `box-shadow`, and `background`. On hover, cards translate upward 5px. Add a visible `:focus-visible` outline with at least 3px contrast. Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 4: Add responsive rules**

At widths below 760px, change `.version-grid` to one column, keep the new card first, reduce headline size, preserve 44px minimum CTA height, and prevent horizontal overflow at 320px.

- [ ] **Step 5: Check visual output locally**

Run `npx serve portal -l 4173` from the repository root, open `http://127.0.0.1:4173`, and inspect desktop plus a 320px-wide viewport. Confirm no console errors and that both cards remain readable.

### Task 3: Add deployment and rollback documentation

**Files:**
- Create: `portal/README.md`
- Create: `deploy/nginx/chatvip-portal.conf.example`

- [ ] **Step 1: Document the three-domain mapping and hosting assumptions**

`portal/README.md` must document:

```text
chatvip.aittco.com          -> portal/ static files
chat.aittco.com              -> D:\chat-libre\LibreChat (new)
chatvvip.aittco.com          -> D:\chatvip.aittco.com\chatvip-ai-chat-main (classic)
```

Include local preview, the DNS A-record requirement, certificate coverage for all three names, and a pre-cutover checklist that verifies both target domains before changing the root domain.

- [ ] **Step 2: Add a reference Nginx configuration**

Create three HTTPS server blocks. The root block serves `portal/` with `try_files $uri $uri/ /index.html`; the new and classic blocks proxy to configurable upstream placeholders documented as `127.0.0.1:3080` and `127.0.0.1:3000`. The new block must forward `Upgrade` and `Connection` headers for streaming/WebSocket support. Include HTTP-to-HTTPS redirects and do not place API keys in the file.

- [ ] **Step 3: Document rollback**

State that rollback means restoring the previous root-domain document root or server block while leaving `chat.aittco.com` and `chatvvip.aittco.com` running independently.

### Task 4: Add automated smoke coverage

**Files:**
- Create: `portal/tests/portal.spec.js`

- [ ] **Step 1: Add Playwright tests for required content and hierarchy**

Tests must navigate to a configurable `PORTAL_URL` (default `http://127.0.0.1:4173`) and assert:

```js
await expect(page.locator('h1')).toHaveText('选择你的 AI 工作空间');
await expect(page.locator('[data-version="new"] .badge--recommended')).toContainText('推荐使用');
await expect(page.locator('[data-version="new"]')).toContainText('跨设备保留');
await expect(page.locator('[data-version="classic"]')).toContainText('当前浏览器');
```

- [ ] **Step 2: Add exact-destination and mobile-order tests**

Assert the new CTA `href` equals `https://chat.aittco.com`, the classic CTA `href` equals `https://chatvvip.aittco.com`, and at a 320px viewport the first `.version-card` has `data-version="new"`.

- [ ] **Step 3: Run the smoke suite**

Run `npx playwright test portal/tests/portal.spec.js`. Expected result: all portal smoke tests pass. If Playwright browsers are not installed, run `npx playwright install chromium` once, then rerun the same command.

### Task 5: Final verification and commit

**Files:**
- Verify: `portal/index.html`, `portal/styles.css`, `portal/app.js`, `portal/README.md`, `portal/tests/portal.spec.js`, `deploy/nginx/chatvip-portal.conf.example`

- [ ] **Step 1: Run static checks**

Run:

```powershell
rg -n "TBD|TODO|FIXME|localhost|http://" portal deploy/nginx
```

Expected: no placeholders and no insecure production destination URLs; localhost may appear only in local-preview documentation and must not appear in `portal/index.html` or the production server names.

- [ ] **Step 2: Run the existing project build without staging unrelated changes**

Run `npm run build` from `D:\chatvip.aittco.com\chatvip-ai-chat-main`. Expected: the existing classic project build succeeds. The portal is static and must not be imported into the chat bundle.

- [ ] **Step 3: Review the diff and stage only portal work**

Run:

```powershell
git diff --check
git status --short
git add portal deploy/nginx/chatvip-portal.conf.example
git diff --cached --stat
```

Confirm no existing modified chat files are staged.

- [ ] **Step 4: Commit the implementation**

```powershell
git commit -m "feat: add ChatVIP version selection portal"
```

- [ ] **Step 5: Perform production cutover only after target checks**

Verify both target domains, DNS resolution, SSL certificates, login, streaming, and cross-device conversations on the new site. Then point `chatvip.aittco.com` to the portal document root, purge only the portal CDN cache if applicable, and verify the two CTA destinations from an external browser.
