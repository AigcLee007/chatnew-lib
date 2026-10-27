import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ComposerMenu from '../ComposerMenu';

const items = [{ label: 'Upload image', onClick: jest.fn() }];
const tools = [
  { label: 'File search', onClick: jest.fn(), hideOnClick: false, ariaChecked: false },
];

function Harness() {
  const [formatting, setFormatting] = useState(false);
  return (
    <ComposerMenu
      attachmentItems={items}
      toolItems={tools}
      formatting={formatting}
      onFormattingChange={setFormatting}
      onOpenParameters={jest.fn()}
    />
  );
}

describe('ComposerMenu', () => {
  it('offers grouped attachments, tools, formatting and advanced parameters', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add attachments and tools' }));
    expect(await screen.findByRole('menuitem', { name: 'Attachments' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Tools' })).toBeVisible();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Formatting tools' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Formatting tools' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Advanced parameters' })).toBeVisible();
  });

  it('keeps mobile groups inline and mutually exclusive', async () => {
    const original = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    try {
      render(<Harness />);
      fireEvent.click(screen.getByRole('button', { name: 'Add attachments and tools' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Attachments' }));
      expect(screen.getByRole('menuitem', { name: 'Upload image' })).toBeVisible();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Tools' }));
      expect(screen.queryByRole('menuitem', { name: 'Upload image' })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitemcheckbox', { name: 'File search' })).toBeVisible();
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'File search' }));
      expect(tools[0].onClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('menuitemcheckbox', { name: 'File search' })).toBeVisible();
    } finally {
      window.matchMedia = original;
    }
  });
});
