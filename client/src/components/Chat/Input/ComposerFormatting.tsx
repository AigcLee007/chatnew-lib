import { useLayoutEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  SquareCode,
} from 'lucide-react';
import { Button, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';

const formats = [
  { key: 'bold', icon: Bold, before: '**', after: '**' },
  { key: 'italic', icon: Italic, before: '*', after: '*' },
  { key: 'strike', icon: Strikethrough, before: '~~', after: '~~' },
  { key: 'bullet', icon: List, prefix: '- ' },
  { key: 'number', icon: ListOrdered, prefix: '1. ' },
  { key: 'task', icon: ListTodo, prefix: '- [ ] ' },
  { key: 'quote', icon: Quote, prefix: '> ' },
  { key: 'inline_code', icon: Code, before: '`', after: '`' },
  { key: 'codeblock', icon: SquareCode, before: '```\n', after: '\n```' },
] as const;

interface ComposerFormattingProps {
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (text: string) => void;
  disabled?: boolean;
}

export default function ComposerFormatting({
  textAreaRef,
  onChange,
  disabled,
}: ComposerFormattingProps) {
  const localize = useLocalize();
  const selection = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    if (selection.current && textAreaRef.current) {
      textAreaRef.current.setSelectionRange(...selection.current);
      selection.current = null;
    }
  });
  return (
    <div
      role="toolbar"
      aria-label={localize('com_ui_composer_formatting')}
      className="mx-3 flex flex-wrap gap-1 border-b border-border-light py-2"
      onClick={(event) => event.stopPropagation()}
    >
      {formats.map((format) => {
        const label = localize(`com_ui_composer_${format.key}`);
        const Icon = format.icon;
        return (
          <TooltipAnchor
            key={format.key}
            description={label}
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const textarea = textAreaRef.current;
                  if (!textarea) {
                    return;
                  }
                  const { value, selectionStart, selectionEnd } = textarea;
                  let start = selectionStart;
                  let end = selectionEnd;
                  let replacement: string;
                  if ('prefix' in format) {
                    start = value.lastIndexOf('\n', start - 1) + 1;
                    const lineEnd = value.indexOf('\n', end);
                    end = lineEnd === -1 ? value.length : lineEnd;
                    replacement = value
                      .slice(start, end)
                      .split('\n')
                      .map(
                        (line, index) =>
                          `${format.key === 'number' ? `${index + 1}. ` : format.prefix}${line}`,
                      )
                      .join('\n');
                    selection.current = [start, start + replacement.length];
                  } else {
                    replacement = `${format.before}${value.slice(start, end)}${format.after}`;
                    selection.current = [start + format.before.length, end + format.before.length];
                  }
                  onChange(value.slice(0, start) + replacement + value.slice(end));
                  textarea.focus();
                }}
              >
                <Icon className="size-4" aria-hidden="true" />
              </Button>
            }
          />
        );
      })}
    </div>
  );
}
