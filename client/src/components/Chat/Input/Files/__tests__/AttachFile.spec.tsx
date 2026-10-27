import { fireEvent, render, screen } from '@testing-library/react';
import AttachFile from '../AttachFile';

jest.mock('@librechat/client', () => ({
  FileUpload: jest.requireActual('react').forwardRef(
    (
      {
        children,
        handleFileChange,
      }: {
        children: React.ReactNode;
        handleFileChange: React.ChangeEventHandler<HTMLInputElement>;
      },
      ref: React.Ref<HTMLInputElement>,
    ) => (
      <>
        {children}
        <input ref={ref} type="file" data-testid="file-input" onChange={handleFileChange} />
      </>
    ),
  ),
  TooltipAnchor: ({ render }: { render: React.ReactNode }) => render,
  AttachmentIcon: () => null,
}));

jest.mock('~/hooks', () => ({
  useFileHandlingNoChatContext: () => ({ handleFileChange: jest.fn() }),
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/hooks/useKeyboardShortcuts', () => ({
  useShortcutAriaKey: () => 'Ctrl+U',
  useShortcutHint: (_action: string, label: string) => label,
}));

describe('AttachFile composer shortcut', () => {
  it('keeps a direct file-picker shortcut target when rendered in the plus menu', () => {
    render(
      <AttachFile
        renderMenu={() => <button type="button" aria-label="Plus menu" />}
        disabled={false}
        files={new Map()}
        setFiles={jest.fn()}
        setFilesLoading={jest.fn()}
        conversation={null}
      />,
    );
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const clickInput = jest.spyOn(input, 'click');
    const shortcut = document.getElementById('attach-file-direct-trigger');
    expect(shortcut).toBeInTheDocument();
    if (!(shortcut instanceof HTMLButtonElement)) {
      throw new Error('Upload shortcut target must be a button');
    }
    fireEvent.click(shortcut);
    expect(clickInput).toHaveBeenCalledTimes(1);
  });
});
