import { act, renderHook } from '@testing-library/react';
import type { TConversation } from 'librechat-data-provider';
import type { useChatContext } from '~/Providers/ChatContext';
import useSetIndexOptions from '../useSetIndexOptions';

const mockChatContext = jest.fn<
  Pick<
    ReturnType<typeof useChatContext>,
    'conversation' | 'preset' | 'setConversation' | 'setPreset'
  >,
  []
>();

jest.mock('~/Providers/ChatContext', () => ({ useChatContext: () => mockChatContext() }));

describe('reasoning parameter updates', () => {
  it.each([false, true])(
    'enables thinking when setting a reasoning parameter (preset: %s)',
    (preset) => {
      const setter = jest.fn();
      for (const [key, value] of [
        ['effort', 'max'],
        ['thinkingLevel', 'high'],
        ['thinkingBudget', 8192],
      ] as const) {
        const previous = {
          conversationId: 'conversation-1',
          endpoint: key === 'effort' ? 'anthropic' : 'google',
          model: key === 'effort' ? 'claude-opus-5-5' : 'gemini-4-argon-high',
          thinking: false,
        } as TConversation;
        mockChatContext.mockReturnValue({
          conversation: previous,
          preset: {
            endpoint: previous.endpoint ?? null,
            model: previous.model,
            thinking: false,
            presetId: null,
            title: 'New Preset',
          },
          setConversation: setter,
          setPreset: setter,
        });
        const { result, unmount } = renderHook(() => useSetIndexOptions(preset));
        setter.mockClear();
        act(() => result.current.setOption(key)(value));
        const updated = setter.mock.calls[0][0](previous);
        expect(updated).toEqual(expect.objectContaining({ [key]: value, thinking: true }));
        unmount();
      }
    },
  );
});
