import { useCallback, useEffect, useRef } from 'react';
import { atom, useAtom } from 'jotai';
import { Constants, isCompactedLeaf, isAssistantsEndpoint } from 'librechat-data-provider';
import { useLatestMessage } from '~/hooks/Messages/useLatestMessage';
import { useChatContext } from '~/Providers';

export const compactingConversationAtom = atom<string | null>(null);

export const supportsCompaction = (endpoint?: string | null): boolean =>
  endpoint != null && endpoint !== '' && !isAssistantsEndpoint(endpoint);

export default function useCompactConversation() {
  const { ask, index, conversation, isSubmitting } = useChatContext();
  const latestMessage = useLatestMessage(index);
  const [compactingConversation, setCompactingConversation] = useAtom(compactingConversationAtom);
  const conversationId = conversation?.conversationId;
  const hasConversation =
    conversationId != null &&
    conversationId !== Constants.NEW_CONVO &&
    conversationId !== Constants.PENDING_CONVO;
  const isCompacting = isSubmitting && compactingConversation === conversationId;
  const canCompact =
    hasConversation &&
    supportsCompaction(conversation?.endpoint) &&
    !isSubmitting &&
    latestMessage != null &&
    latestMessage.parentMessageId != null &&
    !isCompactedLeaf(latestMessage);

  const wasSubmitting = useRef(isSubmitting);
  const mounted = useRef(false);
  useEffect(() => {
    const settled = wasSubmitting.current && !isSubmitting;
    const mountedIdle = !mounted.current && !isSubmitting;
    mounted.current = true;
    wasSubmitting.current = isSubmitting;
    if ((settled || mountedIdle) && compactingConversation != null) {
      setCompactingConversation(null);
    }
  }, [isSubmitting, compactingConversation, setCompactingConversation]);

  const compact = useCallback(() => {
    if (!canCompact || latestMessage == null || conversationId == null) {
      return;
    }
    setCompactingConversation(conversationId);
    const accepted = ask(
      {
        text: '',
        conversationId,
        messageId: latestMessage.messageId,
        parentMessageId: latestMessage.messageId,
      },
      { compact: true },
    );
    if (accepted === false) {
      setCompactingConversation(null);
    }
  }, [ask, canCompact, conversationId, latestMessage, setCompactingConversation]);

  return { compact, canCompact, isCompacting };
}
