import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button, TooltipAnchor } from '@librechat/client';
import { isAgentsEndpoint } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import type { SetterOrUpdater } from 'recoil';
import { useGetEndpointsQuery } from '~/data-provider';
import { EndpointIcon } from '~/components/Endpoints';
import { useAgentsMapContext } from '~/Providers';
import { useLocalize } from '~/hooks';

export default function AddedConvo({
  addedConvo,
  setAddedConvo,
}: {
  addedConvo: TConversation | null;
  setAddedConvo: SetterOrUpdater<TConversation | null>;
}) {
  const agentsMap = useAgentsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const localize = useLocalize();
  const title = useMemo(() => {
    // Priority: agent name > modelDisplayLabel > modelLabel > model
    if (isAgentsEndpoint(addedConvo?.endpoint)) {
      const agent = addedConvo?.agent_id ? agentsMap?.[addedConvo.agent_id] : undefined;
      /** Keep agent model details private by using its display name only. */
      return `+ ${agent?.name || localize('com_ui_agent')}`;
    }

    const endpointConfig = endpointsConfig?.[addedConvo?.endpoint ?? ''];
    const displayLabel =
      endpointConfig?.modelDisplayLabel || addedConvo?.modelLabel || addedConvo?.model || 'AI';

    return `+ ${displayLabel}`;
  }, [addedConvo, agentsMap, endpointsConfig, localize]);

  if (!addedConvo) {
    return null;
  }
  return (
    <div className="flex items-start gap-4 py-2.5 pl-3 pr-1.5 text-sm">
      <span className="mt-0 flex h-6 w-6 flex-shrink-0 items-center justify-center">
        <div className="icon-md">
          <EndpointIcon
            conversation={addedConvo}
            endpointsConfig={endpointsConfig}
            agentsMap={agentsMap}
            containerClassName="shadow-stroke overflow-hidden rounded-full"
            context="menu-item"
            size={20}
          />
        </div>
      </span>
      <span className="text-token-text-secondary line-clamp-3 flex-1 py-0.5 font-semibold">
        {title}
      </span>
      <TooltipAnchor
        description={localize('com_ui_close')}
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={localize('com_ui_close')}
            onClick={() => setAddedConvo(null)}
            className="size-8 shrink-0 rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        }
      />
    </div>
  );
}
