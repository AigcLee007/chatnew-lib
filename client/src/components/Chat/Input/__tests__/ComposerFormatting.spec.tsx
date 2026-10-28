import { useEffect, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import userEvent from '@testing-library/user-event';
import ComposerFormatting from '../ComposerFormatting';

function Harness({
  initialText = 'hello world',
  onEditorReady,
}: {
  initialText?: string;
  onEditorReady?: (editor: Editor | null) => void;
}) {
  const [text, setText] = useState(initialText);
  useEffect(() => setText(initialText), [initialText]);
  return (
    <>
      <output aria-label="Markdown draft">{text}</output>
      <ComposerFormatting text={text} onChange={setText} onEditorReady={onEditorReady} />
    </>
  );
}

describe('ComposerFormatting', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => document.querySelector('[contenteditable="true"]') ?? document.body,
    });
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    HTMLElement.prototype.getClientRects = () =>
      ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as DOMRectList;
    Range.prototype.getBoundingClientRect = () =>
      HTMLElement.prototype.getBoundingClientRect.call(document.body);
    Range.prototype.getClientRects = () =>
      ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as DOMRectList;
  });

  it('keeps every typed character in the editor and Markdown draft', async () => {
    const user = userEvent.setup();
    render(<Harness initialText="" />);
    const editor = screen.getByRole('textbox', { name: 'Message input' });

    await user.type(editor, 'hello');

    expect(editor).toHaveTextContent('hello');
    expect(screen.getByLabelText('Markdown draft')).toHaveTextContent('hello');
  });

  it('shows the localized placeholder for an empty rich editor', () => {
    render(<Harness initialText="" />);
    const editor = screen.getByRole('textbox', { name: 'Message input' });
    const emptyParagraph = editor.querySelector('.is-empty');

    expect(emptyParagraph).toHaveAttribute('data-placeholder');
    expect(editor).toHaveClass('focus-visible:outline-none');
  });

  it('renders existing Markdown formatting and exposes active format state', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness initialText="**hello world**" />);
    expect(screen.getByText('hello world', { selector: 'strong' })).toBeVisible();
    rerender(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('creates a visible task list and serializes inline math as Markdown', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness initialText="remember this" />);
    await user.click(screen.getByRole('button', { name: 'Task list' }));
    await user.click(screen.getByRole('button', { name: 'Inline math' }));

    expect(container.querySelector('[data-type="taskList"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Markdown draft')).toHaveTextContent('- [ ]');
    expect(screen.getByLabelText('Markdown draft')).toHaveTextContent('remember this');
    expect(screen.getByLabelText('Markdown draft')).toHaveTextContent(/\$x\^2\$/);
  });

  it('applies formatting to selected text and serializes it into the draft', async () => {
    const user = userEvent.setup();
    let editor: Editor | null = null;
    render(
      <Harness
        initialText="hello"
        onEditorReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    act(() => editor?.commands.selectAll());
    await user.click(screen.getByRole('button', { name: 'Bold' }));

    expect(screen.getByLabelText('Markdown draft')).toHaveTextContent('**hello**');
    expect(screen.getByText('hello', { selector: 'strong' })).toBeVisible();
  });

  it('imports legacy Markdown as formatted text instead of exposing its delimiters', async () => {
    const { container, rerender } = render(<Harness />);
    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;
    editor.focus();
    rerender(<Harness initialText="**bold** and *italic*" />);
    expect(await screen.findByText('bold', { selector: 'strong' })).toBeVisible();
    expect(screen.getByText('italic', { selector: 'em' })).toBeVisible();
  });
});
