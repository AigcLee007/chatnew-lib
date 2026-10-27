import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { PermissionTypes } from 'librechat-data-provider';
import ToolsDropdown from '../ToolsDropdown';
import ComposerMenu from '../ComposerMenu';

const mockDenied = new Set<string>();
let mockCapabilities = {
  codeEnabled: true,
  memoryEnabled: true,
  artifactsEnabled: false,
  fileSearchEnabled: true,
  skillsEnabled: true,
};
const mockContext = {
  skills: {
    toggleState: false,
    isPinned: false,
    debouncedChange: jest.fn(),
    setIsPinned: jest.fn(),
  },
  memory: {
    toggleState: false,
    isPinned: false,
    debouncedChange: jest.fn(),
    setIsPinned: jest.fn(),
  },
  fileSearch: {
    toggleState: false,
    isPinned: false,
    debouncedChange: jest.fn(),
    setIsPinned: jest.fn(),
  },
  codeInterpreter: {
    toggleState: false,
    isPinned: false,
    debouncedChange: jest.fn(),
    setIsPinned: jest.fn(),
  },
};

jest.mock('~/Providers', () => ({ useBadgeRowContext: () => mockContext }));
jest.mock('~/hooks', () => ({
  useLocalize: jest.requireActual('~/hooks/useLocalize').default,
  useAuthContext: () => ({ user: { personalization: { memories: true } } }),
  useHasAccess: ({ permissionType }: { permissionType: string }) => !mockDenied.has(permissionType),
  useHasMemoryAccess: () => true,
  useAgentCapabilities: () => mockCapabilities,
}));
jest.mock('~/data-provider', () => ({ useGetStartupConfig: () => ({ data: {} }) }));

function Harness() {
  const [formatting, setFormatting] = useState(false);
  return (
    <ToolsDropdown
      renderMenu={(toolItems) => (
        <ComposerMenu
          attachmentItems={[]}
          toolItems={toolItems}
          formatting={formatting}
          onFormattingChange={setFormatting}
        />
      )}
    />
  );
}

describe('ToolsDropdown inside the composer menu', () => {
  beforeEach(() => {
    mockDenied.clear();
    mockCapabilities = {
      codeEnabled: true,
      memoryEnabled: true,
      artifactsEnabled: false,
      fileSearchEnabled: true,
      skillsEnabled: true,
    };
  });

  it('keeps the menu open when toggling or pinning and distinguishes both actions', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Add attachments and tools' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Tools' }));
    const skill = await screen.findByRole('menuitemcheckbox', { name: 'Skills' });
    await user.click(skill);
    expect(mockContext.skills.debouncedChange).toHaveBeenCalledWith({ value: true });
    await user.click(within(skill).getByRole('button', { name: 'Pin' }));
    expect(mockContext.skills.setIsPinned).toHaveBeenCalledWith(true);
    expect(mockContext.skills.debouncedChange).toHaveBeenCalledTimes(1);
    expect(skill).toBeVisible();
  });

  it('preserves permission and capability filtering inside the group', async () => {
    mockDenied.add(PermissionTypes.SKILLS);
    mockCapabilities.codeEnabled = false;
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Add attachments and tools' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Tools' }));
    expect(await screen.findByRole('menuitemcheckbox', { name: 'File Search' })).toBeVisible();
    expect(screen.queryByTestId('tools-menu-skills')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemcheckbox', { name: /Run code/i })).not.toBeInTheDocument();
  });
});
