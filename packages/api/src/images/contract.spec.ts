import { IMAGE_ASPECT_RATIOS, IMAGE_MODELS, IMAGE_RESOLUTIONS } from 'librechat-data-provider';

const enabled = process.env.AITTCO_CONTRACT_TEST === 'true' && Boolean(process.env.AITTCO_TEST_KEY);

/**
 * Opt-in smoke-test scaffold for gateway deployments. The exact upstream
 * response contract is covered by adapter tests; this suite is intentionally
 * skipped in CI unless a disposable gateway key is explicitly provided.
 */
const contractDescribe = enabled ? describe : describe.skip;

contractDescribe('AITTCO image contract', () => {
  it('exposes the configured image contract', () => {
    expect(IMAGE_MODELS).toHaveLength(3);
    expect(IMAGE_ASPECT_RATIOS).toHaveLength(8);
    expect(IMAGE_RESOLUTIONS).toEqual(['1K', '2K', '4K']);
  });
});
