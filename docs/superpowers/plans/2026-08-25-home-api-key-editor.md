# Home API Key Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-aligned homepage API Key button that lets an authenticated user replace the existing `aittco_shared` key without exposing the old value.

**Architecture:** Create a focused `ApiKeyButton` component that owns the button, dialog, input state, mutation callbacks, and localized feedback. It will reuse the existing `useUserKeyQuery`, `useUpdateUserKeysMutation`, `AITTCO_SHARED_KEY_NAME`, and toast infrastructure; `Header.tsx` will only mount the component beside the existing theme toggle. The first-time `/setup-key` route remains unchanged.

**Tech Stack:** React, TypeScript, React Hook-free controlled form state, React Query hooks from `librechat-data-provider`, `@librechat/client` dialog/button primitives, lucide-react, Jest, Testing Library, ESLint, TypeScript, Vite.

---

### Task 1: Specify API Key button behavior with a failing test

**Files:**
- Create: `client/src/components/Chat/__tests__/ApiKeyButton.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create a focused component test with the project render helper. Mock `useUserKeyQuery`, `useUpdateUserKeysMutation`, `useLocalize`, and the dialog primitives only where needed to keep the test focused on behavior. Use a fake mutation object whose `mutate` captures both variables and callbacks.

The test cases must assert:

```tsx
it('opens an API Key dialog from the header button', async () => {
  render(<ApiKeyButton />);
  await userEvent.click(screen.getByRole('button', { name: 'Manage API key' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'API Key' })).toHaveAttribute('type', 'password');
});

it('shows configured status without rendering the stored key', async () => {
  mockKeyQuery.mockReturnValue({ data: { expiresAt: 'never' }, isLoading: false });
  render(<ApiKeyButton />);
  expect(screen.getByText('Current key: configured')).toBeInTheDocument();
  expect(screen.queryByText('secret-key-value')).not.toBeInTheDocument();
});

it('trims and replaces the shared key after submission', async () => {
  render(<ApiKeyButton />);
  await userEvent.click(screen.getByRole('button', { name: 'Manage API key' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'API Key' }), '  replacement-key  ');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(mockMutate).toHaveBeenCalledWith(
    { name: AITTCO_SHARED_KEY_NAME, value: 'replacement-key', expiresAt: '' },
    expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
  );
});

it('does not submit whitespace-only input', async () => {
  render(<ApiKeyButton />);
  await userEvent.click(screen.getByRole('button', { name: 'Manage API key' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'API Key' }), '   ');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(mockMutate).not.toHaveBeenCalled();
});

it('keeps the dialog open when saving fails', async () => {
  render(<ApiKeyButton />);
  await userEvent.click(screen.getByRole('button', { name: 'Manage API key' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'API Key' }), 'replacement-key');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  act(() => mockMutate.mock.calls[0][1].onError(new Error('save failed')));

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'API Key' })).toHaveValue('replacement-key');
});
```

Use a real value such as `secret-key-value` only in the mocked query fixture; never render it from production code.

- [ ] **Step 2: Run the test to verify it fails**

Run from the client package directory:

```powershell
cd client
npm exec jest -- --runInBand src/components/Chat/__tests__/ApiKeyButton.spec.tsx
```

Expected: FAIL because `ApiKeyButton` does not exist yet. If Jest reports a mock or test-environment error instead, fix the test harness before adding production code.

- [ ] **Step 3: Commit the failing specification**

```powershell
git add client/src/components/Chat/__tests__/ApiKeyButton.spec.tsx
git commit -m "test: specify home api key editor behavior"
```

### Task 2: Implement the isolated API Key button and dialog

**Files:**
- Create: `client/src/components/Chat/ApiKeyButton.tsx`

- [ ] **Step 1: Implement the smallest component that satisfies Task 1**

Use the shared key constant and existing hooks:

```tsx
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { AITTCO_SHARED_KEY_NAME } from 'librechat-data-provider';
import { useUserKeyQuery, useUpdateUserKeysMutation } from 'librechat-data-provider/react-query';
import {
  Button,
  Input,
  Label,
  OGDialog,
  OGDialogContent,
  OGDialogFooter,
  OGDialogHeader,
  OGDialogTitle,
  Spinner,
  TooltipAnchor,
  useToastContext,
} from '@librechat/client';
import { NotificationSeverity } from '~/common';
import { useLocalize } from '~/hooks';

export default function ApiKeyButton() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const keyQuery = useUserKeyQuery(AITTCO_SHARED_KEY_NAME);
  const updateKey = useUpdateUserKeysMutation();
  const label = localize('com_ui_manage_api_key');
  const configured = Boolean(keyQuery.data?.expiresAt);

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setValue('');
  };

  const submit = () => {
    const trimmedKey = value.trim();
    if (!trimmedKey || updateKey.isLoading) return;

    updateKey.mutate(
      { name: AITTCO_SHARED_KEY_NAME, value: trimmedKey, expiresAt: '' },
      {
        onSuccess: () => {
          showToast({
            message: localize('com_ui_save_key_success'),
            status: NotificationSeverity.SUCCESS,
          });
          onOpenChange(false);
        },
        onError: () => {
          showToast({
            message: localize('com_ui_save_key_error'),
            status: NotificationSeverity.ERROR,
          });
        },
      },
    );
  };

  return (
    <>
      <TooltipAnchor
        description={label}
        render={
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-9 flex-shrink-0 rounded-xl bg-presentation hover:bg-surface-active-alt"
            aria-label={label}
            onClick={() => setOpen(true)}
          >
            <KeyRound className="icon-md" aria-hidden="true" />
          </Button>
        }
      />
      <OGDialog open={open} onOpenChange={onOpenChange}>
        <OGDialogContent className="w-11/12 max-w-lg">
          <OGDialogHeader>
            <OGDialogTitle>{localize('com_ui_edit_shared_key_title')}</OGDialogTitle>
          </OGDialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-text-secondary">
              {configured
                ? localize('com_ui_shared_key_configured')
                : localize('com_ui_shared_key_not_configured')}
            </p>
            <Label htmlFor="shared-api-key">{localize('com_ui_api_key')}</Label>
            <Input
              id="shared-api-key"
              type="password"
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={localize('com_ui_shared_key_placeholder')}
            />
          </div>
          <OGDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {localize('com_ui_cancel')}
            </Button>
            <Button variant="submit" onClick={submit} disabled={!value.trim() || updateKey.isLoading}>
              {updateKey.isLoading ? <Spinner /> : localize('com_ui_save')}
            </Button>
          </OGDialogFooter>
        </OGDialogContent>
      </OGDialog>
    </>
  );
}
```

The button must never render `keyQuery.data` or any key value. Use only its `expiresAt` presence for status. Keep failure behavior inside the dialog and leave the entered value intact when `onError` runs.

- [ ] **Step 2: Run the focused test to verify it passes**

Run from the `client` package directory:

```powershell
npm exec jest -- --runInBand src/components/Chat/__tests__/ApiKeyButton.spec.tsx
```

Expected: all five API Key button tests pass.

- [ ] **Step 3: Commit the component**

```powershell
git add client/src/components/Chat/ApiKeyButton.tsx
git commit -m "feat: add home api key editor"
```

### Task 3: Mount the button in Header and add localized labels

**Files:**
- Modify: `client/src/components/Chat/Header.tsx`
- Modify: `client/src/locales/en/translation.json`
- Modify: `client/src/locales/zh-Hans/translation.json`
- Modify: `client/src/locales/zh-Hant/translation.json`

- [ ] **Step 1: Add the localized strings**

Add the following keys without changing existing translations:

```json
{
  "com_ui_manage_api_key": "Manage API key",
  "com_ui_edit_shared_key_title": "Update your AittcoChat API key",
  "com_ui_shared_key_configured": "Current key: configured",
  "com_ui_shared_key_not_configured": "Current key: not configured"
}
```

Use these Chinese translations in `zh-Hans`:

```json
{
  "com_ui_manage_api_key": "管理 API Key",
  "com_ui_edit_shared_key_title": "修改 AittcoChat API Key",
  "com_ui_shared_key_configured": "当前 Key：已配置",
  "com_ui_shared_key_not_configured": "当前 Key：未配置"
}
```

Use the equivalent Traditional Chinese wording in `zh-Hant`: “管理 API 金鑰”、“修改 AittcoChat API 金鑰”、“目前金鑰：已設定”、“目前金鑰：尚未設定”。

- [ ] **Step 2: Mount the button at the right edge**

Import `ApiKeyButton` from `~/components/Chat/ApiKeyButton` and render it immediately after the existing `ThemeToggleButton` in the compact right action group. Do not move or remove existing actions:

```tsx
<ContactSupport compact />
<ThemeToggleButton />
<ApiKeyButton />
```

- [ ] **Step 3: Run the focused integration checks**

Run:

```powershell
npm exec eslint -- client/src/components/Chat/ApiKeyButton.tsx client/src/components/Chat/Header.tsx client/src/components/Chat/__tests__/ApiKeyButton.spec.tsx
npm run typecheck --workspace @librechat/frontend
```

Expected: ESLint exits 0 and TypeScript exits 0.

- [ ] **Step 4: Commit the integration and translations**

```powershell
git add client/src/components/Chat/Header.tsx client/src/locales/en/translation.json client/src/locales/zh-Hans/translation.json client/src/locales/zh-Hant/translation.json
git commit -m "feat: expose api key editor in chat header"
```

### Task 4: Verify the merged feature

**Files:**
- No source changes expected.

- [ ] **Step 1: Run the focused regression suite**

Run from the `client` package directory:

```powershell
npm exec jest -- --runInBand src/components/Chat/__tests__/ApiKeyButton.spec.tsx
```

Expected: all five tests pass.

- [ ] **Step 2: Run lint and typecheck over all changed TypeScript**

```powershell
npm exec eslint -- client/src/components/Chat/ApiKeyButton.tsx client/src/components/Chat/Header.tsx client/src/components/Chat/__tests__/ApiKeyButton.spec.tsx
npm run typecheck --workspace @librechat/frontend
```

Expected: both commands exit 0.

- [ ] **Step 3: Build the client**

```powershell
npm run build:client
```

Expected: Vite completes with exit code 0. Existing bundle-size/PWA warnings may remain.

- [ ] **Step 4: Inspect the final diff**

```powershell
git diff --check HEAD~3..HEAD
git status --short
```

Expected: no whitespace errors; only the documented feature files are changed, while pre-existing untracked directories remain untouched.
