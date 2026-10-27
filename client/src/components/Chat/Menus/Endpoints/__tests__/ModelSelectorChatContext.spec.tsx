import React from 'react';
import { RecoilRoot } from 'recoil';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EModelEndpoint } from 'librechat-data-provider';
import {
  ModelSelectorChatProvider,
  useModelSelectorChatContext,
} from '../ModelSelectorChatContext';
import store from '~/store';

const mockNewConversation = jest.fn();
const mockGenerateConversation = jest.fn();
jest.mock('~/hooks', () => ({
  useGetConversation: jest.fn(() => () => null),
  useNewConvo: jest.fn(() => ({ newConversation: mockNewConversation })),
}));
jest.mock('~/hooks/Conversations/useGenerateConvo', () => ({
  __esModule: true,
  useGenerateConvo: jest.fn(() => ({ generateConversation: mockGenerateConversation })),
}));

function Selection() {
  const { model, endpoint, newConversation } = useModelSelectorChatContext();
  return (
    <button onClick={() => newConversation({ template: { model: 'replacement' } })}>
      {endpoint}:{model}
    </button>
  );
}

it('reads the secondary panel and selects models without switching the primary chat', async () => {
  const user = userEvent.setup();
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        const base = { conversationId: 'new', title: 'New Chat', createdAt: '', updatedAt: '' };
        set(store.conversationByIndex(0), {
          ...base,
          endpoint: EModelEndpoint.openAI,
          model: 'primary',
        });
        set(store.conversationByIndex(1), {
          ...base,
          endpoint: EModelEndpoint.google,
          model: 'secondary',
        });
      }}
    >
      <ModelSelectorChatProvider index={1}>
        <Selection />
      </ModelSelectorChatProvider>
    </RecoilRoot>,
  );
  await user.click(screen.getByRole('button', { name: 'google:secondary' }));
  expect(mockGenerateConversation).toHaveBeenCalledWith({
    template: { model: 'replacement' },
    keepAddedConvos: true,
  });
  expect(mockNewConversation).not.toHaveBeenCalled();
});
