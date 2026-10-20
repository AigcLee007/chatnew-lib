import { memo, useEffect, useRef, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { ScrollText, XIcon } from 'lucide-react';
import { Button, TooltipAnchor } from '@librechat/client';
import { Constants } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import type { CurrencyConfig } from '~/utils';
import useCompactConversation, { supportsCompaction } from '~/hooks/Chat/useCompactConversation';
import { useGetLangfuseSessionLinkQuery, useGetStartupConfig } from '~/data-provider';
import { formatTokens, formatCost, cn } from '~/utils';
import useTokenUsage from '~/hooks/Chat/useTokenUsage';
import { useLocalize } from '~/hooks';
import Breakdown from './Breakdown';
import Gauge from './Gauge';
import CompactAction from './CompactAction';

interface TokenUsageProps {
  index: number;
  conversation: TConversation | null;
  isSubmitting: boolean;
}

function TokenUsageIndicator({
  index,
  conversation,
  isSubmitting,
  showCost,
  currency,
  langfuseConnectionAccess,
  compactionEnabled,
}: TokenUsageProps & {
  showCost: boolean;
  currency?: CurrencyConfig;
  langfuseConnectionAccess: boolean;
  compactionEnabled: boolean;
}) {
  const localize = useLocalize();
  const view = useTokenUsage({ index, conversation, isSubmitting });
  const compaction = useCompactConversation();
  const popover = Ariakit.usePopoverStore({ placement: 'top' });
  const popoverOpen = Ariakit.useStoreState(popover, 'open');
  const disclosureRef = useRef<HTMLButtonElement>(null);
  const [isReminderDismissed, setIsReminderDismissed] = useState(false);
  const conversationId = conversation?.conversationId ?? '';
  const hasConversation =
    conversationId !== '' &&
    conversationId !== Constants.NEW_CONVO &&
    conversationId !== Constants.PENDING_CONVO;
  const previousConversationId = useRef(conversationId);
  useEffect(() => {
    if (previousConversationId.current !== conversationId || view.percent <= 80) {
      setIsReminderDismissed(false);
    }
    previousConversationId.current = conversationId;
  }, [conversationId, view.percent]);

  const canResolveLangfuseSession =
    langfuseConnectionAccess &&
    popoverOpen &&
    !isSubmitting &&
    conversationId !== '' &&
    conversationId !== Constants.NEW_CONVO &&
    conversationId !== Constants.PENDING_CONVO;
  const { data: langfuseSession } = useGetLangfuseSessionLinkQuery(
    conversationId,
    canResolveLangfuseSession,
  );

  /** Hide until the branch has data — keeps a fresh, message-less chat clean and
   *  lets the indicator animate into view once the first tokens land. */
  if (view.usedTokens <= 0) {
    return null;
  }

  const hasMax = view.maxTokens != null && view.maxTokens > 0;
  const showCompactionReminder =
    hasMax &&
    view.percent > 80 &&
    hasConversation &&
    compactionEnabled &&
    supportsCompaction(conversation?.endpoint) &&
    compaction.canCompact &&
    !compaction.isCompacting &&
    !isSubmitting &&
    !isReminderDismissed;
  const ariaLabel = hasMax
    ? localize('com_ui_context_usage_label', {
        0: formatTokens(view.usedTokens),
        1: formatTokens(view.maxTokens ?? 0),
        2: String(Math.round(view.percent)),
      })
    : localize('com_ui_context_usage_label_unknown', { 0: formatTokens(view.usedTokens) });

  const snapshotSummary = hasMax
    ? localize('com_ui_context_usage_snapshot', {
        0: formatTokens(view.usedTokens),
        1: formatTokens(view.maxTokens ?? 0),
        2: String(Math.round(view.percent)),
      })
    : localize('com_ui_context_usage_snapshot_unknown', { 0: formatTokens(view.usedTokens) });
  const snapshot =
    showCost && view.hasUsage && view.branchUsage.costKnown
      ? `${snapshotSummary} · ${formatCost(view.branchCost, currency)}`
      : snapshotSummary;

  return (
    <>
      {showCompactionReminder && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            'absolute inset-x-0 bottom-full z-20 mb-2 flex items-center gap-3 rounded-md border',
            'border-status-warning bg-surface-secondary p-2.5 text-text-primary shadow-sm',
            'context-compaction-reminder-breathe motion-reduce:animate-none',
          )}
        >
          <p className="min-w-0 flex-1 text-sm text-text-secondary">
            {localize('com_ui_context_compact_reminder')}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={compaction.compact}
            className="h-8 shrink-0 gap-2 px-3 text-sm"
          >
            <ScrollText className="size-4" aria-hidden="true" />
            {localize('com_ui_context_compact')}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={localize('com_ui_context_compact_reminder_dismiss')}
            onClick={() => setIsReminderDismissed(true)}
            className="size-8 shrink-0"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}
      <TooltipAnchor
        description={snapshot}
        side="top"
        render={
          <Ariakit.PopoverDisclosure
            ref={disclosureRef}
            store={popover}
            type="button"
            data-testid="token-usage"
            aria-label={ariaLabel}
            aria-haspopup="dialog"
            className={cn(
              'flex size-theme-control items-center justify-center rounded-theme-control-round transition-colors',
              'hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary',
              'duration-300 animate-in fade-in zoom-in-95',
            )}
          >
            <span
              role="meter"
              aria-valuemin={0}
              aria-valuemax={hasMax ? view.maxTokens : undefined}
              aria-valuenow={view.usedTokens}
              aria-label={localize('com_ui_context_usage')}
              className="flex items-center justify-center"
            >
              <Gauge percent={view.percent} indeterminate={!hasMax} />
            </span>
          </Ariakit.PopoverDisclosure>
        }
      />
      {/* Focus the labelled dialog on open so screen readers enter and announce
          the breakdown, and so focus stays contained instead of falling back to
          the body (which the composer's global focus logic would steal). The
          visible ring is suppressed via focus:outline-none, and finalFocus
          returns focus to the gauge trigger on close. */}
      <Ariakit.Popover
        store={popover}
        gutter={8}
        portal
        unmountOnHide
        finalFocus={disclosureRef}
        aria-label={localize('com_ui_context_usage')}
        className="z-[200] rounded-xl border border-border-medium bg-surface-secondary p-3 shadow-lg focus:outline-none"
      >
        <div className="w-72 space-y-3">
          <Breakdown
            view={view}
            showCost={showCost}
            currency={currency}
            langfuseSessionUrl={langfuseSession?.url ?? undefined}
          />
          {compactionEnabled && supportsCompaction(conversation?.endpoint) && (
            <>
              <div className="border-t border-border-light" role="separator" />
              <CompactAction
                compact={compaction.compact}
                canCompact={compaction.canCompact}
                isCompacting={compaction.isCompacting}
              />
            </>
          )}
        </div>
      </Ariakit.Popover>
    </>
  );
}

/** Config gate kept outside the indicator so disabled deployments mount nothing */
const TokenUsage = memo(function TokenUsage(props: TokenUsageProps) {
  const { data: startupConfig } = useGetStartupConfig();
  /** Wait for config before mounting: until it loads `contextUsage === false`
   *  reads as undefined, so a disabled deployment would briefly mount the
   *  indicator and fire the token-config query on first load */
  if (startupConfig == null || startupConfig.interface?.contextUsage === false) {
    return null;
  }
  return (
    <TokenUsageIndicator
      {...props}
      showCost={startupConfig.interface?.contextCost === true}
      currency={startupConfig.interface?.currency}
      langfuseConnectionAccess={startupConfig.langfuseConnectionAccess === true}
      compactionEnabled={startupConfig.compactionEnabled === true}
    />
  );
});

export default TokenUsage;
