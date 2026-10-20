import { getDefaultStore } from 'jotai';
import { act, renderHook } from '@testing-library/react';
import { ContentTypes } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import useCompactConversation, { compactingConversationAtom } from '../useCompactConversation';

const mockAsk = jest.fn();
let mockContext: {
  index: number;
  isSubmitting: boolean;
  conversation: { conversationId: string; endpoint: string } | null;
};
let mockLatestMessage: TMessage | null;

jest.mock('~/Providers', () => ({
  useChatContext: () => ({ ...mockContext, ask: mockAsk }),
}));
jest.mock('~/hooks/Messages/useLatestMessage', () => ({
  useLatestMessage: () => mockLatestMessage,
}));

const leaf = (overrides: Partial<TMessage> = {}): TMessage =>
  ({
    messageId: 'assistant-leaf',
    parentMessageId: 'user-message',
    conversationId: 'conversation-1',
    isCreatedByUser: false,
    text: 'Answer',
    ...overrides,
  }) as TMessage;

describe('useCompactConversation', () => {
  beforeEach(() => {
    mockAsk.mockReset();
    mockAsk.mockReturnValue(undefined);
    mockContext = {
      index: 0,
      isSubmitting: false,
      conversation: { conversationId: 'conversation-1', endpoint: 'openAI' },
    };
    mockLatestMessage = leaf();
    getDefaultStore().set(compactingConversationAtom, null);
  });

  it('submits the selected leaf as both branch anchor and response parent', () => {
    const { result } = renderHook(() => useCompactConversation());

    expect(result.current.canCompact).toBe(true);
    act(() => result.current.compact());

    expect(mockAsk).toHaveBeenCalledWith(
      {
        text: '',
        conversationId: 'conversation-1',
        messageId: 'assistant-leaf',
        parentMessageId: 'assistant-leaf',
      },
      { compact: true },
    );
  });

  it.each([
    [
      'new conversation',
      () => (mockContext.conversation = { conversationId: 'new', endpoint: 'openAI' }),
    ],
    ['active submission', () => (mockContext.isSubmitting = true)],
    ['missing leaf', () => (mockLatestMessage = null)],
    [
      'Assistants thread',
      () =>
        (mockContext.conversation = { conversationId: 'conversation-1', endpoint: 'assistants' }),
    ],
    [
      'already compacted leaf',
      () =>
        (mockLatestMessage = leaf({
          text: '',
          content: [
            {
              type: ContentTypes.SUMMARY,
              content: [{ type: ContentTypes.TEXT, text: 'Checkpoint' }],
            },
          ],
        })),
    ],
  ])('does not offer compaction for a %s', (_label, arrange) => {
    arrange();
    const { result } = renderHook(() => useCompactConversation());

    expect(result.current.canCompact).toBe(false);
    act(() => result.current.compact());
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('clears the in-flight marker after the request settles', () => {
    const { result, rerender } = renderHook(() => useCompactConversation());
    act(() => result.current.compact());
    mockContext.isSubmitting = true;
    rerender();
    expect(result.current.isCompacting).toBe(true);

    mockContext.isSubmitting = false;
    rerender();
    expect(result.current.isCompacting).toBe(false);
    expect(getDefaultStore().get(compactingConversationAtom)).toBeNull();
  });
});
