# Home Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact light/dark theme toggle to the chat header's top-right action group while preserving the existing three-option theme selector in Settings.

**Architecture:** Create a focused `ThemeToggleButton` under the existing Appearance components. It reads `ThemeContext`, uses the shared `isDark` resolver for explicit and system themes, and delegates persistence and DOM updates to `ThemeProvider`. `Chat/Header.tsx` only mounts the button in the existing right-side control group.

**Tech Stack:** React 18, TypeScript, `@librechat/client` theme primitives, lucide-react icons, Tailwind semantic theme utilities, Jest + Testing Library, Vite.

---

## File map

- Create `client/src/components/Appearance/ThemeToggleButton.tsx`: compact accessible button that derives the next explicit theme and calls `setTheme`.
- Create `client/src/components/Appearance/ThemeToggleButton.spec.tsx`: behavior tests for light, dark, and system theme states.
- Modify `client/src/components/Appearance/index.ts`: export the new Appearance component through the existing barrel.
- Modify `client/src/components/Chat/Header.tsx`: import and render the button as the rightmost control in the header's right action group.

### Task 1: Add failing ThemeToggleButton tests

**Files:**
- Create: `client/src/components/Appearance/ThemeToggleButton.spec.tsx`

- [ ] **Step 1: Write the tests for explicit theme toggling and accessible output**

Create a test harness that renders `ThemeToggleButton` inside `ThemeContext.Provider` with a mocked `setTheme`. Use the existing `test/matchMedia.mock` setup and `@testing-library/react`. Cover these cases:

```tsx
import 'test/matchMedia.mock';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { ThemeContext } from '@librechat/client';
import ThemeToggleButton from './ThemeToggleButton';

const renderToggle = (theme: 'light' | 'dark' | 'system', setTheme = jest.fn()) =>
  render(
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        setThemeRGB: jest.fn(),
        setThemeDefinition: jest.fn(),
        setThemeName: jest.fn(),
        resetTheme: jest.fn(),
      }}
    >
      <ThemeToggleButton />
    </ThemeContext.Provider>,
  );

describe('ThemeToggleButton', () => {
  it('switches from dark to light and exposes a toggle label', () => {
    const setTheme = jest.fn();
    const { getByRole } = renderToggle('dark', setTheme);

    const button = getByRole('button', { name: 'Toggle theme' });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('switches from light to dark', () => {
    const setTheme = jest.fn();
    const { getByRole } = renderToggle('light', setTheme);

    fireEvent.click(getByRole('button', { name: 'Toggle theme' }));

    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('switches from system mode to the opposite explicit mode', () => {
    const setTheme = jest.fn();
    const { getByRole } = renderToggle('system', setTheme);

    fireEvent.click(getByRole('button', { name: 'Toggle theme' }));

    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
```

The system-mode expectation follows the repository's default `matchMedia` mock. If that mock reports light mode, change only the expected explicit next mode or locally set the media query match to make the system branch deterministic; do not bypass `isDark` in the production component.

- [ ] **Step 2: Run the focused test and verify it fails for the missing component**

Run from `D:\chat-libre\LibreChat`:

```powershell
cd client
npm run test:ci -- src/components/Appearance/ThemeToggleButton.spec.tsx --runInBand
```

Expected: FAIL because `./ThemeToggleButton` does not exist yet.

- [ ] **Step 3: Commit the red test**

```powershell
git add -- client/src/components/Appearance/ThemeToggleButton.spec.tsx
git commit -m "test: specify home theme toggle behavior"
```

### Task 2: Implement the compact theme toggle

**Files:**
- Create: `client/src/components/Appearance/ThemeToggleButton.tsx`

- [ ] **Step 1: Implement the minimal component against the existing theme API**

Use the shared context and resolver; do not read `localStorage`, call `matchMedia` directly, or modify `document` in this component. Use the existing semantic button and tooltip patterns:

```tsx
import { useContext } from 'react';
import { Button, isDark, ThemeContext, TooltipAnchor } from '@librechat/client';
import { Moon, Sun } from 'lucide-react';
import { useLocalize } from '~/hooks';

export default function ThemeToggleButton() {
  const localize = useLocalize();
  const { theme, setTheme } = useContext(ThemeContext);
  const dark = isDark(theme);

  return (
    <TooltipAnchor
      description={localize('com_ui_toggle_theme')}
      render={
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9 flex-shrink-0 rounded-xl bg-presentation hover:bg-surface-active-alt"
          aria-label={localize('com_ui_toggle_theme')}
          aria-pressed={dark}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          {dark ? (
            <Sun className="icon-md" aria-hidden="true" />
          ) : (
            <Moon className="icon-md" aria-hidden="true" />
          )}
        </Button>
      }
    />
  );
}
```

If the shared `TooltipAnchor` composition requires the child icon to be inside its rendered button, preserve the same accessible result and follow the exact composition already used by `HeaderMenu.tsx`; do not introduce a new tooltip implementation.

- [ ] **Step 2: Export the component through the Appearance barrel**

Update `client/src/components/Appearance/index.ts`:

```ts
export { ThemeSelector, LangSelector } from './Selectors';
export { default as ThemeToggleButton } from './ThemeToggleButton';
```

- [ ] **Step 3: Run the focused test and verify it passes**

```powershell
cd client
npm run test:ci -- src/components/Appearance/ThemeToggleButton.spec.tsx --runInBand
```

Expected: PASS for all three theme transitions and the accessible button query.

- [ ] **Step 4: Commit the component and its export**

```powershell
git add -- client/src/components/Appearance/ThemeToggleButton.tsx client/src/components/Appearance/index.ts
git commit -m "feat: add compact theme toggle button"
```

### Task 3: Mount the toggle in the chat header

**Files:**
- Modify: `client/src/components/Chat/Header.tsx`

- [ ] **Step 1: Add the Appearance import**

Add `ThemeToggleButton` to the existing local imports without changing the header's state or theme logic:

```tsx
import { ThemeToggleButton } from '~/components/Appearance';
```

- [ ] **Step 2: Render it as the rightmost top-right action**

Inside the existing right-side compact control group, after `ContactSupport compact`, render:

```tsx
<ThemeToggleButton />
```

Keep the existing `flex-shrink-0`, gap, breakpoint, and `hiddenBehindNav` classes intact. The button should remain visible in the header's desktop and mobile action groups and should not be moved into the settings menu or the mobile overflow menu.

- [ ] **Step 3: Run focused regression tests**

```powershell
cd client
npm run test:ci -- src/components/Appearance/ThemeSelector.spec.tsx src/components/Chat/__tests__/ChatView.spec.tsx --runInBand
```

Expected: PASS; the original settings selector still supports the three options and the chat view remains renderable.

- [ ] **Step 4: Commit the header integration**

```powershell
git add -- client/src/components/Chat/Header.tsx
git commit -m "feat: expose theme toggle in chat header"
```

### Task 4: Verify type safety, lint, build, and final behavior

**Files:**
- No additional source files expected.

- [ ] **Step 1: Run type checking**

```powershell
cd client
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run lint on changed files**

```powershell
cd D:\chat-libre\LibreChat
npx eslint client/src/components/Appearance/ThemeToggleButton.tsx client/src/components/Appearance/ThemeToggleButton.spec.tsx client/src/components/Appearance/index.ts client/src/components/Chat/Header.tsx
```

Expected: PASS with no warnings or errors.

- [ ] **Step 3: Build the client**

```powershell
cd D:\chat-libre\LibreChat
npm run build:client
```

Expected: Vite client build completes successfully.

- [ ] **Step 4: Review the final diff and working tree**

```powershell
git diff HEAD~3..HEAD -- client/src/components/Appearance client/src/components/Chat/Header.tsx
git status --short
```

Confirm the diff contains only the new button, its tests/export, and the header mount. Preserve unrelated existing untracked files such as `.superpowers/` and `skill/thesis-defense-coach/`.

- [ ] **Step 5: Commit any necessary verification-only fixes**

If verification reveals formatting or typing issues, fix only the changed files, rerun the failed command, and commit with:

```powershell
git add -- client/src/components/Appearance client/src/components/Chat/Header.tsx
git commit -m "fix: polish home theme toggle verification issues"
```
