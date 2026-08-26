import React, { useMemo } from 'react';
import { CheckCircle2, Pin, PinOff } from 'lucide-react';
import { VisuallyHidden } from '@ariakit/react';
import type { TModelSpec } from 'librechat-data-provider';
import type { Endpoint } from '~/common';
import { useFavorites, useLocalize } from '~/hooks';
import { cn, getSpecAgentAvatarURL } from '~/utils';
import { useModelSelectorContext } from '../ModelSelectorContext';
import {
  buildModelCatalog,
  filterModelCatalog,
  groupModelCatalog,
  type CatalogEntry,
} from '../catalog';
import { CustomMenuItem as MenuItem } from '../CustomMenu';
import ProviderIcon from './ProviderIcon';
import SpecIcon from './SpecIcon';

type CatalogListProps = {
  endpoints: Endpoint[];
  modelSpecs: TModelSpec[];
  hasSupplementaryResults?: boolean;
};

function CatalogRow({
  entry,
  favorites,
}: {
  entry: CatalogEntry;
  favorites: ReturnType<typeof useFavorites>;
}) {
  const localize = useLocalize();
  const { selectedValues, handleSelectModel, handleSelectSpec, endpointsConfig, agentsMap } =
    useModelSelectorContext();
  const { isFavoriteModel, toggleFavoriteModel, isFavoriteSpec, toggleFavoriteSpec } = favorites;
  const isSpec = entry.spec != null;
  const isSelected = isSpec
    ? selectedValues.modelSpec === entry.spec?.name
    : selectedValues.endpoint === entry.endpoint?.value &&
      selectedValues.model === entry.model &&
      !selectedValues.modelSpec;
  const isFavorite = isSpec
    ? isFavoriteSpec(entry.spec?.name ?? '')
    : isFavoriteModel(entry.model ?? '', entry.endpoint?.value ?? '');

  const select = () => {
    if (entry.spec) {
      handleSelectSpec(entry.spec);
    } else if (entry.endpoint && entry.model) {
      handleSelectModel(entry.endpoint, entry.model);
    }
  };

  const toggleFavorite = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (entry.spec) {
      toggleFavoriteSpec(entry.spec.name);
    } else if (entry.endpoint && entry.model) {
      toggleFavoriteModel({ model: entry.model, endpoint: entry.endpoint.value });
    }
  };
  let icon: React.ReactNode = (
    <ProviderIcon group={entry.group} className="mt-0.5 size-5 shrink-0 object-contain" />
  );
  if (entry.spec) {
    icon = entry.spec.showIconInMenu ? (
      <SpecIcon
        currentSpec={entry.spec}
        endpointsConfig={endpointsConfig}
        agentAvatarURL={getSpecAgentAvatarURL(entry.spec, agentsMap)}
      />
    ) : null;
  }

  return (
    <MenuItem
      onClick={select}
      aria-selected={isSelected || undefined}
      className={cn(
        'group flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-2.5',
        isSelected && 'bg-surface-active-alt',
      )}
    >
      {icon}
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium text-text-primary">{entry.name}</div>
        {entry.description && (
          <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-text-secondary">
            {entry.description}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={toggleFavorite}
        aria-label={isFavorite ? localize('com_ui_unpin') : localize('com_ui_pin')}
        className={cn(
          'mt-0.5 rounded-md p-1 text-text-secondary hover:bg-surface-hover',
          !isFavorite &&
            'group-focus-within:visible group-hover:visible group-data-[active-item]:visible [@media(hover:hover)]:invisible',
        )}
      >
        {isFavorite ? (
          <PinOff className="size-4" aria-hidden="true" />
        ) : (
          <Pin className="size-4" aria-hidden="true" />
        )}
      </button>
      {isSelected && (
        <>
          <CheckCircle2 className="mt-1 size-4 shrink-0" aria-hidden="true" />
          <VisuallyHidden>{localize('com_a11y_selected')}</VisuallyHidden>
        </>
      )}
    </MenuItem>
  );
}

export default function CatalogList({
  endpoints,
  modelSpecs,
  hasSupplementaryResults = false,
}: CatalogListProps) {
  const localize = useLocalize();
  const favorites = useFavorites();
  const { searchValue } = useModelSelectorContext();
  const entries = useMemo(
    () => buildModelCatalog(endpoints, modelSpecs, localize),
    [endpoints, modelSpecs, localize],
  );
  const filtered = useMemo(() => filterModelCatalog(entries, searchValue), [entries, searchValue]);
  const groups = useMemo(() => groupModelCatalog(filtered), [filtered]);

  if (groups.size === 0 && !hasSupplementaryResults) {
    return (
      <div role="status" className="px-3 py-6 text-center text-sm text-text-secondary">
        {localize('com_ui_no_search_results')}
      </div>
    );
  }

  if (groups.size === 0) {
    return null;
  }

  return (
    <div className="space-y-2 p-1">
      {Array.from(groups.entries()).map(([group, groupEntries]) => (
        <section key={group} aria-label={group}>
          <h2 className="px-2 py-1 text-[10px] font-semibold tracking-[0.18em] text-text-secondary">
            {group}
          </h2>
          <div className="space-y-0.5">
            {groupEntries.map((entry) => (
              <CatalogRow key={entry.key} entry={entry} favorites={favorites} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
