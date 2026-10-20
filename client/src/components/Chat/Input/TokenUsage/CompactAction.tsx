import { memo } from 'react';
import { ScrollText } from 'lucide-react';
import { Button, Spinner, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface CompactActionProps {
  compact: () => void;
  canCompact: boolean;
  isCompacting: boolean;
}

function CompactAction({ compact, canCompact, isCompacting }: CompactActionProps) {
  const localize = useLocalize();

  return (
    <TooltipAnchor
      side="bottom"
      description={localize('com_ui_context_compact_info')}
      render={
        <Button
          type="button"
          variant="outline"
          onClick={compact}
          disabled={!canCompact}
          aria-busy={isCompacting}
          className="h-8 w-full justify-center gap-2 text-sm"
        >
          {isCompacting ? (
            <Spinner className="size-4" />
          ) : (
            <ScrollText className="size-4" aria-hidden="true" />
          )}
          {isCompacting
            ? localize('com_ui_context_compacting')
            : localize('com_ui_context_compact')}
        </Button>
      }
    />
  );
}

export default memo(CompactAction);
