import createPayload from '../src/createPayload';
import { EModelEndpoint } from '../src/schemas';
import type { TSubmission } from '../src/types';

function createSubmission(overrides: Partial<TSubmission> = {}): TSubmission {
  return {
    userMessage: {
      text: '',
      messageId: 'assistant_placeholder',
      parentMessageId: 'branch_leaf',
      conversationId: 'conversation-1',
      sender: 'User',
      isCreatedByUser: true,
    },
    messages: [],
    conversation: { conversationId: 'conversation-1', endpoint: EModelEndpoint.agents },
    endpointOption: { endpoint: EModelEndpoint.agents } as TSubmission['endpointOption'],
    isTemporary: false,
    isRegenerate: true,
    ...overrides,
  } as TSubmission;
}

describe('createPayload compaction', () => {
  it('sends compact without regenerate semantics', () => {
    const { payload } = createPayload(createSubmission({ compact: true }));

    expect(payload).toMatchObject({
      compact: true,
      conversationId: 'conversation-1',
      parentMessageId: 'branch_leaf',
    });
    expect(payload).not.toHaveProperty('isRegenerate');
  });

  it('preserves ordinary regenerate requests', () => {
    const { payload } = createPayload(createSubmission());

    expect(payload.isRegenerate).toBe(true);
    expect(payload).not.toHaveProperty('compact');
  });
});
