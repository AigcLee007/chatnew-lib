import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ComposerFormatting from '../ComposerFormatting';

function Harness() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('hello world');
  return (
    <>
      <textarea
        aria-label="Draft"
        ref={textAreaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <ComposerFormatting textAreaRef={textAreaRef} onChange={setText} />
    </>
  );
}

describe('ComposerFormatting', () => {
  it('wraps the selection while preserving the rest of the draft and focus', () => {
    render(<Harness />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(0, 5);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Bold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(textarea).toHaveValue('**hello** world');
    expect(textarea).toHaveFocus();
  });

  it('numbers selected lines consecutively', () => {
    render(<Harness />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'first\nsecond' } });
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Numbered list' }));
    expect(textarea).toHaveValue('1. first\n2. second');
  });
});
