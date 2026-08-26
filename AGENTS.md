See CLAUDE.md.

## Production Server Updates

The production checkout is `/opt/chatnew-lib`. For every application update, use these commands
from the server without substituting a different repository path, remote, Compose file, or build
strategy:

```bash
cd /opt/chatnew-lib
git pull --ff-only origin main
docker compose -f deploy-compose.yml build --no-cache api client
docker compose -f deploy-compose.yml up -d api client
docker ps
```

## Frontend theming and styling

For frontend work, compose existing `@librechat/client` primitives and variants before adding
feature-local styles. Use semantic theme/Tailwind roles for color and shared appearance; do not
introduce raw palette utilities, hard-coded colors, or arbitrary theme CSS. If the system cannot
express a reusable design need, deepen the shared primitive or versioned theme-token registry
instead of copying classes into a feature. Keep genuine layout and behavior local, and document
why any new custom CSS cannot be expressed by the shared system. See the detailed policy in
`CLAUDE.md` under “Theming and styling.”

When adding or changing code that mutates user documents, invalidate the auth user document cache for affected users. This includes single-user updates and bulk role/user mutations; otherwise OpenID JWT request burst caching can serve a stale `req.user` until its TTL expires.
