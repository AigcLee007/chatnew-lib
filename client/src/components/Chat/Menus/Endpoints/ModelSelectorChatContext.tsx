import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import type { EModelEndpoint, TConversation } from 'librechat-data-provider';
import type { ConvoGenerator } from '~/common';
import { useGetConversation, useNewConvo } from '~/hooks';
import { useGenerateConvo } from '~/hooks/Conversations/useGenerateConvo';
import store from '~/store';

interface ModelSelectorChatContextValue {
  endpoint?: EModelEndpoint | null;
  model?: string | null;
  spec?: string | null;
  agent_id?: string | null;
  assistant_id?: string | null;
  getConversation: () => TConversation | null;
  newConversation: ConvoGenerator;
}

const ModelSelectorChatContext = createContext<ModelSelectorChatContextValue | undefined>(
  undefined,
);

export function ModelSelectorChatProvider({
  children,
  index = 0,
}: {
  children: React.ReactNode;
  index?: number;
}) {
  const getConversation = useGetConversation(index);
  const { newConversation: nextNewConversation } = useNewConvo(index);
  const { setConversation } = store.useSetConversationAtom(index);
  const { generateConversation } = useGenerateConvo({
    index,
    rootIndex: 0,
    setConversation: index > 0 ? setConversation : undefined,
  });

  const spec = useRecoilValue(store.conversationSpecByIndex(index));
  const model = useRecoilValue(store.conversationModelByIndex(index));
  const agent_id = useRecoilValue(store.conversationAgentIdByIndex(index));
  const endpoint = useRecoilValue(store.conversationEndpointByIndex(index));
  const assistant_id = useRecoilValue(store.conversationAssistantIdByIndex(index));

  const newConversationRef = useRef(index > 0 ? generateConversation : nextNewConversation);
  newConversationRef.current = index > 0 ? generateConversation : nextNewConversation;
  const newConversation = useCallback<ConvoGenerator>(
    (params) => newConversationRef.current({ ...params, keepAddedConvos: true }),
    [],
  );

  /** Context value only created when relevant conversation properties change */
  const contextValue = useMemo<ModelSelectorChatContextValue>(
    () => ({
      model,
      spec,
      agent_id,
      endpoint,
      assistant_id,
      getConversation,
      newConversation,
    }),
    [endpoint, model, spec, agent_id, assistant_id, getConversation, newConversation],
  );

  return (
    <ModelSelectorChatContext.Provider value={contextValue}>
      {children}
    </ModelSelectorChatContext.Provider>
  );
}

export function useModelSelectorChatContext() {
  const context = useContext(ModelSelectorChatContext);
  if (!context) {
    throw new Error('useModelSelectorChatContext must be used within ModelSelectorChatProvider');
  }
  return context;
}
