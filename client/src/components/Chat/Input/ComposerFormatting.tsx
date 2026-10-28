import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Markdown } from '@tiptap/markdown';
import { Mathematics } from '@tiptap/extension-mathematics';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions/placeholder';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Sigma,
  SquareCode,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { Button, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import type { KeyboardEvent, RefObject } from 'react';
import type { Editor } from '@tiptap/core';

type ComposerEditor = Editor;
type FormatAction = {
  key: string;
  icon: typeof Bold;
  active: string;
  action: (editor: ComposerEditor) => boolean;
};

const formats = [
  {
    key: 'bold',
    icon: Bold,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleBold().run(),
    active: 'bold',
  },
  {
    key: 'italic',
    icon: Italic,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleItalic().run(),
    active: 'italic',
  },
  {
    key: 'underline',
    icon: UnderlineIcon,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleUnderline().run(),
    active: 'underline',
  },
  {
    key: 'strike',
    icon: Strikethrough,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleStrike().run(),
    active: 'strike',
  },
  {
    key: 'bullet',
    icon: List,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleBulletList().run(),
    active: 'bulletList',
  },
  {
    key: 'number',
    icon: ListOrdered,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleOrderedList().run(),
    active: 'orderedList',
  },
  {
    key: 'task',
    icon: ListTodo,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleTaskList().run(),
    active: 'taskList',
  },
  {
    key: 'quote',
    icon: Quote,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleBlockquote().run(),
    active: 'blockquote',
  },
  {
    key: 'inline_code',
    icon: Code,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleCode().run(),
    active: 'code',
  },
  {
    key: 'codeblock',
    icon: SquareCode,
    action: (editor: ComposerEditor) => editor.chain().focus().toggleCodeBlock().run(),
    active: 'codeBlock',
  },
] satisfies FormatAction[];

interface ComposerFormattingProps {
  text: string;
  onChange: (text: string) => void;
  textAreaRef?: RefObject<HTMLTextAreaElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onEditorReady?: (editor: Editor | null) => void;
  disabled?: boolean;
}

export default function ComposerFormatting({
  text,
  onChange,
  textAreaRef,
  onKeyDown,
  onKeyUp,
  onPaste,
  onFocus,
  onBlur,
  onEditorReady,
  disabled,
}: ComposerFormattingProps) {
  const localize = useLocalize();
  const [, setSelectionVersion] = useState(0);
  const lastText = useRef(text);
  const pendingEditorUpdates = useRef<string[]>([]);
  const editor = useEditor({
    immediatelyRender: false,
    content: text,
    contentType: 'markdown',
    editable: !disabled,
    extensions: [
      StarterKit,
      Markdown,
      Placeholder.configure({
        placeholder: localize('com_endpoint_message_new', {
          0: localize('com_endpoint_ai'),
        }),
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Mathematics.configure({ katexOptions: { throwOnError: false } }),
    ],
    editorProps: {
      attributes: {
        'aria-label': localize('com_ui_message_input'),
        class:
          'min-h-11 max-h-[45vh] overflow-y-auto px-5 py-[13px] text-sm text-text-primary outline-none focus-visible:outline-none [&_.is-empty::before]:pointer-events-none [&_.is-empty::before]:float-left [&_.is-empty::before]:h-0 [&_.is-empty::before]:text-text-tertiary [&_.is-empty::before]:content-[attr(data-placeholder)] [&_blockquote]:border-s-2 [&_blockquote]:border-border-medium [&_blockquote]:ps-3 [&_code]:rounded [&_code]:bg-surface-secondary [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-secondary [&_pre]:p-3 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6 [&_u]:underline [&_.ProseMirror-selectednode]:outline [&_[data-type=taskList]]:list-none [&_[data-type=taskList]]:ps-0',
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          onKeyDown?.(event as unknown as KeyboardEvent<HTMLDivElement>);
          return false;
        },
        keyup: (_view, event) => {
          if (textAreaRef?.current && editor) {
            textAreaRef.current.value = editor.getMarkdown();
            onKeyUp?.(event as unknown as KeyboardEvent<HTMLDivElement>);
          }
          return false;
        },
        paste: (_view, event) => {
          if (onPaste) {
            onPaste(event as unknown as React.ClipboardEvent<HTMLDivElement>);
          }
          return false;
        },
        focus: () => {
          onFocus?.();
          return false;
        },
        blur: () => {
          onBlur?.();
          return false;
        },
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown();
      pendingEditorUpdates.current.push(markdown);
      if (textAreaRef?.current) {
        textAreaRef.current.value = markdown;
      }
      onChange(markdown);
    },
    onSelectionUpdate: () => setSelectionVersion((version) => version + 1),
    onTransaction: () => setSelectionVersion((version) => version + 1),
  });

  useEffect(() => {
    if (text === lastText.current) {
      return;
    }
    lastText.current = text;
    const pendingIndex = pendingEditorUpdates.current.indexOf(text);
    if (pendingIndex !== -1) {
      pendingEditorUpdates.current.splice(0, pendingIndex + 1);
      return;
    }
    pendingEditorUpdates.current = [];
    if (editor && editor.getMarkdown() !== text) {
      editor.commands.setContent(text, { contentType: 'markdown', emitUpdate: false });
    }
  }, [editor, text]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border-b border-border-light">
      <div
        role="toolbar"
        aria-label={localize('com_ui_composer_formatting')}
        className="mx-3 flex flex-wrap gap-1 py-2"
        onClick={(event) => event.stopPropagation()}
      >
        {formats.map((format) => {
          const label = localize(`com_ui_composer_${format.key}` as never);
          const Icon = format.icon;
          const active = editor.isActive(format.active);
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
                  aria-pressed={active}
                  className={active ? 'bg-surface-active-alt text-text-primary' : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => format.action(editor)}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </Button>
              }
            />
          );
        })}
        <TooltipAnchor
          description={localize('com_ui_composer_math' as never)}
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={localize('com_ui_composer_math' as never)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().insertInlineMath({ latex: 'x^2' }).run()}
            >
              <Sigma className="size-4" aria-hidden="true" />
            </Button>
          }
        />
      </div>
      <EditorContent editor={editor} className="px-3.5 pb-2" />
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
    </div>
  );
}
