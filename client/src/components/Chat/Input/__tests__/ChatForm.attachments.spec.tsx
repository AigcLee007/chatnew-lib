import React, { Profiler, useMemo, useState } from 'react';
import '@testing-library/jest-dom';
import { DndProvider } from 'react-dnd';
import { useForm } from 'react-hook-form';
import { RecoilRoot, useRecoilState } from 'recoil';
import userEvent from '@testing-library/user-event';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { BrowserRouter as Router } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QueryKeys, FileSources, EModelEndpoint } from 'librechat-data-provider';
import type { TFile, TFileUpload, TConversation } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import {
  ChatContext,
  AddedChatContext,
  ChatFormProvider,
  ActivePanelProvider,
  useActivePanel,
} from '~/Providers';
import { AuthContextProvider } from '~/hooks/AuthContext';
import ChatForm from '../ChatForm';
import store from '~/store';

const mockUpload = jest.fn();

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    dataService: {
      ...actual.dataService,
      uploadImage: (...args: unknown[]) => mockUpload(...args),
      uploadFile: (...args: unknown[]) => mockUpload(...args),
    },
  };
});

const conversation = {
  conversationId: 'new',
  endpoint: EModelEndpoint.openAI,
  model: 'gpt-4o',
  title: 'New Chat',
} as TConversation;

const uploadResponse = {
  message: 'File uploaded',
  file_id: 'server-file-id',
  temp_file_id: 'temp-file-id',
  filename: 'cat.png',
  filepath: '/images/cat.png',
  type: 'image/png',
  bytes: 2048,
  height: 100,
  width: 100,
  source: FileSources.local,
  embedded: false,
} as unknown as TFileUpload;

/** jsdom never decodes images; `decodes` mirrors a browser that can or cannot. */
let decodes = true;

class StubImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 100;
  height = 100;
  set src(_value: string) {
    setTimeout(() => (decodes ? this.onload?.() : this.onerror?.()), 0);
  }
}

let commits = 0;

function Harness({ initialAddedConvo }: { initialAddedConvo: TConversation | null }) {
  const [addedConvo, setAddedConvo] = useState(initialAddedConvo);
  const [files, setFiles] = useRecoilState(store.filesByIndex(0));
  const [isSubmitting] = useRecoilState(store.isSubmittingFamily(0));
  const [, setFilesLoading] = useState(false);
  const methods = useForm<ChatFormValues>({ defaultValues: { text: '' } });

  const chatHelpers = useMemo(
    () =>
      ({
        index: 0,
        conversation,
        setConversation: () => undefined,
        files,
        setFiles,
        isSubmitting,
        setIsSubmitting: () => undefined,
        filesLoading: false,
        setFilesLoading,
        newConversation: () => undefined,
        handleStopGenerating: () => undefined,
        stopGenerating: () => undefined,
        getMessages: () => undefined,
        setMessages: () => undefined,
        ask: () => undefined,
        regenerate: () => undefined,
        setSiblingIdx: () => undefined,
        showPopover: false,
        setShowPopover: () => undefined,
        abortScroll: false,
        setAbortScroll: () => undefined,
        preset: null,
        setPreset: () => undefined,
        optionSettings: {},
        setOptionSettings: () => undefined,
        handleRegenerate: () => undefined,
        handleContinue: () => undefined,
      }) as unknown as React.ContextType<typeof ChatContext>,
    [files, setFiles, isSubmitting],
  );

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider
          value={{
            conversation: addedConvo,
            setConversation: setAddedConvo,
            generateConversation: () => undefined,
          }}
        >
          <Profiler id="composer" onRender={() => (commits += 1)}>
            <ChatForm index={0} />
          </Profiler>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

function PanelProbe() {
  const { active } = useActivePanel();
  const [expanded] = useRecoilState(store.sidebarExpanded);
  return (
    <output data-testid="sidebar-state">
      {active}:{String(expanded)}
    </output>
  );
}

function renderComposer(initialAddedConvo: TConversation | null = null, parameters = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData([QueryKeys.fileConfig], {});
  queryClient.setQueryData<TFile[]>([QueryKeys.files], []);
  queryClient.setQueryData([QueryKeys.endpoints], {
    [EModelEndpoint.openAI]: { order: 0, type: EModelEndpoint.openAI },
  });
  queryClient.setQueryData([QueryKeys.startupConfig, false, 'default'], {
    interface: { parameters },
  });
  queryClient.setQueryData([QueryKeys.startupConfig, true, 'default'], {
    interface: { parameters },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RecoilRoot initializeState={({ set }) => set(store.sidebarExpanded, false)}>
        <ActivePanelProvider>
          <PanelProbe />
        </ActivePanelProvider>
        <Router>
          <AuthContextProvider authConfig={{ loginRedirect: '', test: true }}>
            <DndProvider backend={HTML5Backend}>
              <Harness initialAddedConvo={initialAddedConvo} />
            </DndProvider>
          </AuthContextProvider>
        </Router>
      </RecoilRoot>
    </QueryClientProvider>,
  );
}

const sendButton = () => screen.getByTestId('send-button');
const attach = (container: HTMLElement, file: File) =>
  userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
const image = () => new File(['image-bytes'], 'cat.png', { type: 'image/png' });

describe('ChatForm attachments', () => {
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
      ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as DOMRectList;
  });

  test('opens advanced parameters without depending on a mounted navigation button', async () => {
    localStorage.setItem('side:active-panel', 'conversations');
    renderComposer(null, true);
    const textarea = await screen.findByTestId('text-input');
    await userEvent.type(textarea, 'Keep parameter draft');
    await userEvent.click(screen.getByRole('button', { name: 'Expand editor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add attachments and tools' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Advanced parameters' }));
    const dialog = await screen.findByRole('dialog', { name: 'Advanced parameters' });
    expect(dialog).toHaveClass('w-11/12', 'max-w-5xl');
    expect(within(dialog).getByText('Temperature')).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Expand editor' })).not.toBeInTheDocument();
    expect(textarea).toHaveValue('Keep parameter draft');
  });

  test('reserves room for expand beside comparison close and keeps both actions usable', async () => {
    renderComposer({ ...conversation, model: 'comparison-model' });
    const textarea = await screen.findByTestId('text-input');
    await userEvent.type(textarea, 'Keep comparison draft');
    const comparison = screen.getByText('+ comparison-model');
    const header = comparison.parentElement?.parentElement;
    expect(header).toHaveClass('me-12');
    expect(header).not.toHaveClass('absolute');

    await userEvent.click(screen.getByRole('button', { name: 'Expand editor' }));
    expect(screen.getByRole('dialog', { name: 'Expand editor' })).toContainElement(comparison);
    expect(textarea.closest('[class*="group/composer"]')?.parentElement).toHaveClass('flex-1');
    expect(screen.getByRole('button', { name: 'Exit expanded editor' })).not.toHaveAttribute(
      'title',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('+ comparison-model')).not.toBeInTheDocument();
    expect(textarea).toHaveValue('Keep comparison draft');
    await userEvent.click(screen.getByRole('button', { name: 'Exit expanded editor' }));
    expect(screen.queryByRole('dialog', { name: 'Expand editor' })).not.toBeInTheDocument();
    expect(textarea).toHaveValue('Keep comparison draft');
  });

  test('exposes formatting through the plus menu and preserves the draft when expanding', async () => {
    renderComposer();
    const textarea = await screen.findByTestId('text-input');
    await userEvent.type(textarea, 'Keep my draft');
    await userEvent.click(screen.getByRole('button', { name: 'Add attachments and tools' }));
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Formatting tools' }),
    );
    expect(screen.getByRole('toolbar', { name: 'Formatting tools' })).toBeVisible();
    const textareaRow = screen.getByTestId('composer-textarea-row');
    expect(textareaRow).toHaveClass('min-h-0', 'p-0');
    expect(textareaRow).not.toHaveClass('min-h-[58px]');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Expand editor' }));
    expect(screen.getByRole('dialog', { name: 'Expand editor' })).toContainElement(textarea);
    expect(textarea).toHaveValue('Keep my draft');
    await userEvent.click(screen.getByRole('button', { name: 'Exit expanded editor' }));
    expect(document.querySelector('[contenteditable="true"]')).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Expand editor' })).not.toBeInTheDocument();
    expect(textarea).toHaveValue('Keep my draft');
  });

  test('routes rich editor typing through the composer and saves Markdown in the draft', async () => {
    renderComposer();
    const textarea = await screen.findByTestId('text-input');
    await userEvent.click(screen.getByRole('button', { name: 'Add attachments and tools' }));
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Formatting tools' }),
    );
    const editor = await screen.findByRole('textbox', { name: 'Message input' });
    await userEvent.type(editor, 'hello');

    expect(editor).toHaveTextContent('hello');
    expect(textarea).toHaveValue('hello');
  });

  test('places model selection inside the composer before the send button', async () => {
    renderComposer();
    const textarea = await screen.findByTestId('text-input');
    const model = screen.getByTestId('model-selector-button');
    expect(textarea.closest('form')).toContainElement(model);
    expect(
      model.compareDocumentPosition(sendButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(model).toHaveAttribute('type', 'button');
  });

  test('keeps speech input next to the plus menu', async () => {
    renderComposer();
    await screen.findByTestId('text-input');
    const plus = screen.getByRole('button', { name: 'Add attachments and tools' });
    const microphone = screen.getByRole('button', { name: 'Use microphone' });
    expect(plus.closest('[data-composer-controls]')).toBe(
      microphone.closest('[data-composer-controls]'),
    );
  });

  beforeEach(() => {
    localStorage.clear();
    decodes = true;
    commits = 0;
    global.URL.createObjectURL = jest.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = jest.fn();
    (global as unknown as { Image: unknown }).Image = StubImage;
    mockUpload.mockReset();
    /** The server echoes the id the client sent back as `temp_file_id`. */
    mockUpload.mockImplementation((body: FormData) =>
      Promise.resolve({ ...uploadResponse, temp_file_id: body.get('file_id') as string }),
    );
  });

  test('re-enables send once an attachment finishes uploading', async () => {
    const { container } = renderComposer();

    const textarea = await screen.findByTestId('text-input');
    await userEvent.type(textarea, 'hi');
    expect(sendButton()).toBeEnabled();

    await attach(container, image());
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(textarea).toHaveValue('hi');
  }, 20000);

  test('enables send for an attachment with no composer text', async () => {
    const { container } = renderComposer();
    await screen.findByTestId('text-input');
    expect(sendButton()).toBeDisabled();

    await attach(container, image());
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());

    await waitFor(() => expect(sendButton()).toBeEnabled());
  }, 20000);

  /**
   * The upload only starts once the browser has decoded the image. A decode it
   * refuses used to leave the attachment below `progress: 1`, which reads as
   * "still uploading" and disabled the send button for the rest of the session.
   */
  test('drops an image the browser cannot decode instead of disabling send', async () => {
    decodes = false;
    const { container } = renderComposer();

    const textarea = await screen.findByTestId('text-input');
    await userEvent.type(textarea, 'hi');

    await attach(container, image());
    await waitFor(() => expect(screen.queryByLabelText('Remove file')).not.toBeInTheDocument());

    expect(mockUpload).not.toHaveBeenCalled();
    expect(sendButton()).toBeEnabled();
    expect(textarea).toHaveValue('hi');
  }, 20000);

  /**
   * The composer is the app's busiest surface: every keystroke already re-renders
   * it for the row count and the send button's enabled state, so anything that
   * multiplies that work per character is a regression worth failing on. The
   * measured cost is ~2.5 commits per character (react-scan reports one ChatForm
   * render per keystroke in a real browser); the bound leaves headroom for jsdom
   * scheduling without tolerating a doubling.
   */
  test('keeps typing render-bounded', async () => {
    renderComposer();
    const textarea = await screen.findByTestId('text-input');
    await waitFor(() => expect(sendButton()).toBeInTheDocument());

    commits = 0;
    await userEvent.type(textarea, 'hello there');

    expect(commits).toBeLessThanOrEqual('hello there'.length * 3);
  }, 20000);
});
