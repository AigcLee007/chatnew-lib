import { EModelEndpoint, ReasoningParameterFormat } from 'librechat-data-provider';
import { createOpenRouterReasoningCatalog, validateReasoningOverride } from './reasoning';

describe('validateReasoningOverride', () => {
  it('accepts supported OpenAI effort and rejects unknown effort values', () => {
    const input = {
      endpoint: EModelEndpoint.openAI,
      model: 'o3-mini',
      override: { key: 'reasoning_effort', value: 'high' },
    };
    expect(validateReasoningOverride(input)).toEqual({ valid: true, override: input.override });
    expect(
      validateReasoningOverride({
        ...input,
        override: { key: 'reasoning_effort', value: 'unlimited' },
      }),
    ).toEqual({ valid: false, error: 'unsupported_value' });
  });

  it('rejects forged keys, unsupported models, and disabled endpoint reasoning', () => {
    expect(
      validateReasoningOverride({
        endpoint: EModelEndpoint.openAI,
        model: 'o3-mini',
        override: { key: 'temperature', value: 0 },
      }),
    ).toEqual({ valid: false, error: 'invalid_shape' });
    expect(
      validateReasoningOverride({
        endpoint: EModelEndpoint.openAI,
        model: 'gpt-4.1',
        override: { key: 'reasoning_effort', value: 'high' },
      }),
    ).toEqual({ valid: false, error: 'unsupported_value' });
    expect(
      validateReasoningOverride({
        endpoint: EModelEndpoint.openAI,
        model: 'o3-mini',
        reasoningFormat: ReasoningParameterFormat.disabled,
        override: { key: 'reasoning_effort', value: 'high' },
      }),
    ).toEqual({ valid: false, error: 'unsupported_value' });
  });

  it('requires explicit parameter definitions for Azure deployment names', () => {
    const base = {
      endpoint: EModelEndpoint.azureOpenAI,
      model: 'production-deployment',
      override: { key: 'reasoning_effort', value: 'high' },
    };
    expect(validateReasoningOverride(base)).toEqual({ valid: false, error: 'unsupported_value' });
    expect(
      validateReasoningOverride({
        ...base,
        parameterDefinitions: [
          {
            key: 'reasoning_effort',
            label: 'Effort',
            type: 'enum',
            options: ['low', 'high'],
            component: 'slider',
          },
        ],
      }),
    ).toEqual({ valid: true, override: base.override });
  });

  it('rejects values blocked by the enforced model spec', () => {
    expect(
      validateReasoningOverride({
        endpoint: EModelEndpoint.openAI,
        model: 'o3-mini',
        blockedParameters: ['reasoning_effort'],
        override: { key: 'reasoning_effort', value: 'high' },
      }),
    ).toEqual({ valid: false, error: 'unsupported_value' });
  });
});

describe('OpenRouter reasoning catalog', () => {
  it('reads supported effort values from a same-origin paginated catalog', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { id: 'vendor/model-a', reasoning_effort: ['low', 'high'], reasoning_required: true },
            ],
            next_page: 'https://gateway.example/v1/models?page=2',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ id: 'vendor/model-b', reasoning_effort: ['medium'] }] }),
          { status: 200 },
        ),
      );
    const catalog = createOpenRouterReasoningCatalog({ fetcher, now: () => 10 });

    await expect(
      catalog.get({
        endpoint: 'https://gateway.example/v1',
        apiKey: 'secret',
        model: 'vendor/model-a',
      }),
    ).resolves.toEqual({ values: ['low', 'high'], required: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]).toEqual(
      expect.objectContaining({ headers: { Authorization: 'Bearer secret' }, redirect: 'error' }),
    );
  });

  it('rejects cross-origin pagination and does not infer effort from reasoning support alone', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'vendor/model-a', supported_parameters: ['reasoning'] }],
          next_page: 'https://attacker.example/models',
        }),
        { status: 200 },
      ),
    );
    const catalog = createOpenRouterReasoningCatalog({ fetcher });

    await expect(
      catalog.get({
        endpoint: 'https://gateway.example/v1',
        apiKey: 'secret',
        model: 'vendor/model-a',
      }),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
