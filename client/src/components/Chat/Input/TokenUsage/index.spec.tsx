import '@testing-library/jest-dom/extend-expect';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { Constants } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import type { TokenUsageView } from '~/hooks/Chat/useTokenUsage';
import useCompactConversation from '~/hooks/Chat/useCompactConversation';
import useTokenUsage from '~/hooks/Chat/useTokenUsage';
import { useGetStartupConfig } from '~/data-provider';
import TokenUsage from './index';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/hooks/Chat/useTokenUsage', () => ({
  __esModule: true,
  default: () => mockView,
}));

jest.mock('~/hooks/Chat/useCompactConversation', () => ({
  __esModule: true,
  default: () => mockCompaction,
  supportsCompaction: (endpoint?: string | null) => endpoint != null && endpoint !== 'assistants',
}));

jest.mock('~/data-provider', () => ({
  useGetLangfuseSessionLinkQuery: () => ({ data: undefined }),
  useGetStartupConfig: () => ({ data: mockStartupConfig }),
}));

jest.mock('@ariakit/react', () => ({
  usePopoverStore: () => ({}),
  useStoreState: () => false,
  PopoverDisclosure: jest.requireActual<typeof import('react')>('react').forwardRef(
    (props: React.ComponentProps<'button'>, ref: React.Ref<HTMLButtonElement>) => (
      <button {...props} ref={ref} />
    ),
  ),
  Popover: () => null,
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
  TooltipAnchor: ({ render }: { render: React.ReactNode }) => render,
}));

jest.mock('./Breakdown', () => () => null);

let mockView: TokenUsageView;
let mockCompaction: ReturnType<typeof useCompactConversation>;
let mockStartupConfig: ReturnType<typeof useGetStartupConfig>['data'];

const conversation = {
  conversationId: 'conversation-1',
  endpoint: 'openAI',
} as TConversation;

const createView = (percent: number, maxTokens: number | null = 1000): TokenUsageView =>
  ({
    usedTokens: maxTokens != null ? (percent / 100) * maxTokens : 500,
    maxTokens: maxTokens ?? undefined,
    percent,
    isEstimate: false,
    snapshot: null,
    snapshotActive: false,
    branchTotals: {
      input: 500,
      output: 0,
      counted: 1,
      total: 1,
      estTokens: 0,
      tailEstTokens: 0,
      containsAnchor: false,
      summaryBaseline: 0,
      usage: { input: 500, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, costKnown: true },
      tailId: null,
    },
    branchUsage: { input: 500, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, costKnown: true },
    totalUsage: { input: 500, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, costKnown: true },
    hasUsage: true,
    branchCost: 0,
    totalCost: 0,
    liveTokens: 0,
    estimatedTokens: 0,
    overheadTokens: 0,
    messageTokens: 500,
    messagesPruned: false,
  }) as TokenUsageView;

const compact = jest.fn();

beforeEach(() => {
  mockView = createView(81);
  mockCompaction = { compact, canCompact: true, isCompacting: false };
  mockStartupConfig = {
    interface: { contextUsage: true },
    compactionEnabled: true,
    langfuseConnectionAccess: false,
  } as ReturnType<typeof useGetStartupConfig>['data'];
  compact.mockClear();
});

const renderTokenUsage = (props: Partial<React.ComponentProps<typeof TokenUsage>> = {}) =>
  render(
    <TokenUsage
      index={0}
      conversation={conversation}
      isSubmitting={false}
      {...props}
    />,
  );

describe('TokenUsage context compaction reminder', () => {
  it('shows a one-click reminder when context usage exceeds 80%', async () => {
    renderTokenUsage();

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await userEvent.click(screen.getByRole('button', { name: 'com_ui_context_compact' }));

    expect(compact).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['at 80%', () => { mockView = createView(80); }],
    ['with unknown context size', () => { mockView = createView(81, null); }],
    ['when compaction is disabled', () => {
      mockStartupConfig = {
        ...mockStartupConfig,
        compactionEnabled: false,
      } as ReturnType<typeof useGetStartupConfig>['data'];
    }],
    ['when the endpoint is unsupported', () => {}],
    ['when there is no active conversation', () => {}],
    ['for a new conversation', () => {}],
    ['for a pending conversation', () => {}],
    ['when the conversation cannot be compacted', () => { mockCompaction = { ...mockCompaction, canCompact: false }; }],
    ['while compacting', () => { mockCompaction = { ...mockCompaction, isCompacting: true }; }],
    ['while submitting', () => {}],
  ])('hides the reminder %s', (_label, setup) => {
    setup();
    renderTokenUsage({
      conversation: _label === 'when the endpoint is unsupported'
        ? ({ ...conversation, endpoint: 'assistants' } as TConversation)
        : _label === 'when there is no active conversation'
          ? null
          : _label === 'for a new conversation'
            ? ({ ...conversation, conversationId: Constants.NEW_CONVO } as TConversation)
            : _label === 'for a pending conversation'
              ? ({ ...conversation, conversationId: Constants.PENDING_CONVO } as TConversation)
              : conversation,
      isSubmitting: _label === 'while submitting',
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hides the dismissed reminder until usage returns to 80% and exceeds it again', async () => {
    const { rerender } = renderTokenUsage();
    await userEvent.click(
      screen.getByRole('button', { name: 'com_ui_context_compact_reminder_dismiss' }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    mockView = createView(80);
    rerender(<TokenUsage index={0} conversation={{ ...conversation }} isSubmitting={false} />);
    mockView = createView(81);
    rerender(<TokenUsage index={0} conversation={conversation} isSubmitting={false} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('resets dismissal when the active conversation changes', async () => {
    const { rerender } = renderTokenUsage();
    await userEvent.click(
      screen.getByRole('button', { name: 'com_ui_context_compact_reminder_dismiss' }),
    );

    rerender(
      <TokenUsage
        index={0}
        conversation={{ ...conversation, conversationId: 'conversation-2' }}
        isSubmitting={false}
      />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
