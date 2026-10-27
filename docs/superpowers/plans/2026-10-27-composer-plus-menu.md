# Composer plus menu implementation plan

**Goal:** Implement the approved prototype with attachment/tool groups, Markdown formatting, expanded editing and existing advanced parameters.

**Architecture:** Share one BadgeRowProvider between menu and chips. Reuse upload components through an optional menu render prop so uploads and SharePoint dialogs stay mounted. Reuse ToolsDropdown items and permission filtering. Desktop groups use portaled Ariakit menus; mobile groups expand inline and are mutually exclusive. Expanded editing retains one textarea and form state.

## Tasks
- [x] Add failing tests for the menu, formatting selection and expanded draft preservation.
- [x] Expose attachment/tool items without duplicating upload or permission logic.
- [x] Implement responsive plus menu with enabled/pinned state and keyboard access.
- [x] Add Markdown formatting, expanded editor and existing parameter sidebar navigation.
- [x] Verify targeted Jest suites, typecheck, lint and desktop/mobile UI.

**Verification:** Run Jest from client with --runInBand --coverage=false for composer, attachment, reasoning, MCP and theme suites; npm run typecheck; ESLint for edited files; production frontend build and browser checks where available.
