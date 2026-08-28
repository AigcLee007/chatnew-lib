# Local Source Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make production Compose build the application from the team's `chatnew-lib` checkout instead of upstream LibreChat application images.

**Architecture:** Keep `deploy-compose.yml` as the production stack. Build the API image locally from `Dockerfile.multi` target `api-build`, and build a local nginx client image from a new target that reuses the generated client assets. Update `AGENTS.md` and `AITTCO-DEPLOYMENT.md` with the pull, validate, build, and restart flow.

**Tech Stack:** Docker Compose, multi-stage Dockerfile, nginx, Git.

---

### Task 1: Add a local nginx image target

**Files:**
- Modify: `Dockerfile.multi`

- [ ] Add a final `nginx-client` stage based on `nginx:1.27.0-alpine`, copy `/app/client/dist` from `client-build` into `/usr/share/nginx/html`, copy `client/nginx.conf`, and run nginx in the foreground.
- [ ] Keep the stage independent of runtime secrets and verify the Dockerfile parses with `docker buildx bake`-compatible syntax.
- [ ] Commit with `git add Dockerfile.multi && git commit -m "build: add local nginx client target"`.

### Task 2: Switch production Compose to local builds

**Files:**
- Modify: `deploy-compose.yml`

- [ ] Replace `api.image` with a `build` block using `context: .`, `dockerfile: Dockerfile.multi`, and `target: api-build`; add stable local image name `chatnew-lib-api:local`.
- [ ] Replace `client.image: nginx:1.27.0-alpine` with a build block targeting `nginx-client`; add stable local image name `chatnew-lib-client:local` and remove the host nginx config bind mount because the image owns its config.
- [ ] Leave support-service images unchanged and ensure no `registry.librechat.ai/danny-avila/librechat-dev-api` reference remains in the production file.
- [ ] Validate with `docker compose -f deploy-compose.yml config --quiet` and commit with `git add deploy-compose.yml && git commit -m "build: deploy local source images"`.

### Task 3: Document the server update procedure

**Files:**
- Modify: `AGENTS.md`
- Modify: `AITTCO-DEPLOYMENT.md`

- [ ] State that `/opt/chatnew-lib` must have `origin` set to `https://github.com/AigcLee007/chatnew-lib.git` and updates must use `git pull --ff-only origin main`.
- [ ] Replace the old build/restart commands with `config --quiet`, `build --pull api client`, `up -d api client`, and `ps` checks; explain that build completion precedes restart.
- [ ] Add a source-image sanity check using `docker compose ... config` output or `docker image inspect` so upstream application image regressions are visible.
- [ ] Commit with `git add AGENTS.md AITTCO-DEPLOYMENT.md && git commit -m "docs: document local source deployment"`.

### Task 4: Verify the complete configuration

- [ ] Run `docker compose -f deploy-compose.yml config --quiet`.
- [ ] Run `docker compose -f deploy-compose.yml config | rg -n "chatnew-lib-(api|client)|registry.librechat.ai/danny-avila/librechat-dev-api|target: (api-build|nginx-client)"` and confirm both local image names and build targets are present, with no upstream API image.
- [ ] Review `git diff HEAD~3..HEAD` and `git status --short`; report any Docker daemon limitation if an actual image build cannot run in the current environment.
