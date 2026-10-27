import type { TSubmission } from './types';
import createPayload from './createPayload';
import { EModelEndpoint } from './schemas';

describe('createPayload reasoning override', () => {
  it('preserves the one-message reasoning override without writing it to the conversation', () => {
    const submission = {
      conversation: { conversationId: null, endpoint: EModelEndpoint.openAI },
      endpointOption: { endpoint: EModelEndpoint.openAI, model: 'o3-mini' },
      userMessage: { text: 'think carefully' },
      messages: [],
      isTemporary: false,
      reasoningOverride: { key: 'reasoning_effort', value: 'high' },
    } as TSubmission;

    const { payload } = createPayload(submission);

    expect(payload.reasoningOverride).toEqual({ key: 'reasoning_effort', value: 'high' });
    expect(payload).not.toHaveProperty('reasoning_effort');
    expect(submission.conversation).not.toHaveProperty('reasoning_effort');
  });
});
