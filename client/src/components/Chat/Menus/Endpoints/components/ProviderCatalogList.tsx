import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useMediaQuery } from '@librechat/client';
import type { TModelSpec } from 'librechat-data-provider';
import type { Endpoint } from '~/common';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { useModelSelectorContext } from '../ModelSelectorContext';
import {
  buildModelCatalog,
  filterModelCatalog,
  groupModelCatalog,
  type CatalogGroup,
} from '../catalog';
import { CustomMenu as Menu, CustomMenuItem as MenuItem } from '../CustomMenu';
import CatalogList from './CatalogList';
import ProviderIcon from './ProviderIcon';

type ProviderCatalogListProps = {
  endpoints: Endpoint[];
  modelSpecs: TModelSpec[];
  hasSupplementaryResults?: boolean;
};

const PROVIDER_ORDER: CatalogGroup[] = ['GEMINI', 'ANTHROPIC', 'OPENAI', 'GROK'];
const PROVIDER_LABELS: Record<string, string> = {
  GEMINI: 'Gemini',
  ANTHROPIC: 'Anthropic',
  OPENAI: 'OpenAI',
  GROK: 'Grok',
};

export default function ProviderCatalogList({
  endpoints,
  modelSpecs,
  hasSupplementaryResults = false,
}: ProviderCatalogListProps) {
  const localize = useLocalize();
  const { searchValue } = useModelSelectorContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const [activeGroup, setActiveGroup] = useState<CatalogGroup | null>(null);
  const groups = useMemo(() => {
    const entries = filterModelCatalog(
      buildModelCatalog(endpoints, modelSpecs, localize),
      searchValue,
    );
    const grouped = groupModelCatalog(entries);
    const orderedGroups = [
      ...PROVIDER_ORDER.filter((group) => grouped.has(group)),
      ...Array.from(grouped.keys()).filter((group) => !PROVIDER_ORDER.includes(group)),
    ];
    return orderedGroups.map((group) => ({
      group,
      count: grouped.get(group)?.length ?? 0,
    }));
  }, [endpoints, modelSpecs, localize, searchValue]);

  if (groups.length === 0 && !hasSupplementaryResults) {
    return (
      <div role="status" className="px-3 py-6 text-center text-sm text-text-secondary">
        {localize('com_ui_no_search_results')}
      </div>
    );
  }

  if (isSmallScreen && activeGroup) {
    return (
      <div className="p-1">
        <button
          type="button"
          onClick={() => setActiveGroup(null)}
          aria-label="Back to providers"
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-text-primary hover:bg-surface-hover"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>{PROVIDER_LABELS[activeGroup] ?? activeGroup}</span>
        </button>
        <CatalogList
          endpoints={endpoints}
          modelSpecs={modelSpecs}
          group={activeGroup}
          hideGroupHeading
        />
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-1">
      {groups.map(({ group, count }) => {
        const label = PROVIDER_LABELS[group] ?? group;
        const trigger = (
          <div
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left',
              'hover:bg-surface-hover',
            )}
          >
            <ProviderIcon group={group} className="size-6 shrink-0 object-contain" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
              {label}
            </span>
            <span className="text-xs text-text-secondary">{count}</span>
            <ChevronRight className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
          </div>
        );

        if (isSmallScreen) {
          return (
            <MenuItem
              key={group}
              onClick={() => setActiveGroup(group)}
              aria-label={`${label} ${count}`}
              aria-haspopup="menu"
              aria-expanded={false}
            >
              {trigger}
            </MenuItem>
          );
        }

        return (
          <Menu key={group} presentation="catalog" label={label} trigger={trigger}>
            <CatalogList
              endpoints={endpoints}
              modelSpecs={modelSpecs}
              group={group}
              hideGroupHeading
            />
          </Menu>
        );
      })}
    </div>
  );
}
