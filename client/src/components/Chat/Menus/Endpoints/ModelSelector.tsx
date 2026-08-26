import React, { useMemo, useRef } from 'react';
import { TooltipAnchor } from '@librechat/client';
import { getConfigDefaults, isAgentsEndpoint, isAssistantsEndpoint } from 'librechat-data-provider';
import type { ModelSelectorProps } from '~/common';
import { renderEndpoints, renderModelSpecs, renderSearchResults } from './components';
import { ModelSelectorProvider, useModelSelectorContext } from './ModelSelectorContext';
import { useShortcutAriaKey, useShortcutHint } from '~/hooks/useKeyboardShortcuts';
import { ModelSelectorChatProvider } from './ModelSelectorChatContext';
import { getSelectedIcon, getDisplayValue } from './utils';
import { modelDisplayInfo } from './catalog';
import ProviderIcon from './components/ProviderIcon';
import { CustomMenu as Menu } from './CustomMenu';
import CatalogList from './components/CatalogList';
import { VIRTUALIZE_THRESHOLD } from './components/EndpointModelItem';
import { useLocalize } from '~/hooks';
import { buildModelCatalog } from './catalog';

const defaultInterface = getConfigDefaults().interface;

function ModelSelectorContent() {
  const localize = useLocalize();
  const modelSelectorHint = useShortcutHint('openModelSelector', localize('com_ui_select_model'));
  const modelSelectorAriaKey = useShortcutAriaKey('openModelSelector');

  const {
    // LibreChat
    agentsMap,
    modelSpecs,
    mappedEndpoints,
    endpointsConfig,
    // State
    searchValue,
    selectedValues,
    searchResults,
    // Functions
    setSearchValue,
    setSelectedValues,
  } = useModelSelectorContext();
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  const regularEndpoints = (mappedEndpoints ?? []).filter(
    (endpoint) =>
      !isAgentsEndpoint(endpoint.value) &&
      !isAssistantsEndpoint(endpoint.value) &&
      (endpoint.models?.length ?? 0) <= VIRTUALIZE_THRESHOLD,
  );
  const specializedSpecs = (modelSpecs ?? []).filter((spec) => {
    const endpoint = spec.preset?.endpoint;
    return isAgentsEndpoint(endpoint) || isAssistantsEndpoint(endpoint);
  });
  const catalogSpecs = (modelSpecs ?? []).filter((spec) => !specializedSpecs.includes(spec));
  const nonCatalogEndpoints = (mappedEndpoints ?? []).filter(
    (endpoint) => !regularEndpoints.includes(endpoint),
  );
  const modelCount = buildModelCatalog(regularEndpoints, catalogSpecs).length;
  const supplementarySearchResults = searchResults?.filter((item) => {
    if ('name' in item && 'label' in item) {
      return specializedSpecs.includes(item);
    }
    return nonCatalogEndpoints.includes(item);
  });
  let menuContent: React.ReactNode;
  if (searchResults) {
    menuContent = supplementarySearchResults?.length
      ? renderSearchResults(supplementarySearchResults, localize, searchValue)
      : null;
  } else {
    menuContent = [
      renderModelSpecs(specializedSpecs, selectedValues.modelSpec || ''),
      renderEndpoints(nonCatalogEndpoints),
    ];
  }

  const selectedIcon = useMemo(() => {
    const selectedEndpoint = mappedEndpoints?.find(
      (endpoint) => endpoint.value === selectedValues.endpoint,
    );
    if (
      selectedEndpoint &&
      selectedValues.model &&
      selectedEndpoint.models?.some(({ name }) => name === selectedValues.model)
    ) {
      const info = modelDisplayInfo(selectedValues.model, selectedEndpoint);
      return <ProviderIcon group={info.group} className="size-5 object-contain" />;
    }
    return getSelectedIcon({
      mappedEndpoints: mappedEndpoints ?? [],
      selectedValues,
      modelSpecs,
      endpointsConfig,
      agentsMap,
    });
  }, [mappedEndpoints, selectedValues, modelSpecs, endpointsConfig, agentsMap]);
  const selectedDisplayValue = useMemo(
    () =>
      getDisplayValue({
        localize,
        agentsMap,
        modelSpecs,
        selectedValues,
        mappedEndpoints,
      }),
    [localize, agentsMap, modelSpecs, selectedValues, mappedEndpoints],
  );

  const trigger = (
    <TooltipAnchor
      aria-label={localize('com_ui_select_model')}
      description={modelSelectorHint}
      render={
        <button
          ref={modelTriggerRef}
          data-testid="model-selector-button"
          aria-keyshortcuts={modelSelectorAriaKey}
          className="my-1 flex h-9 max-w-full items-center gap-2 rounded-xl border border-border-light bg-presentation px-3 py-2 text-sm text-text-primary hover:bg-surface-active-alt"
          aria-label={localize('com_ui_select_model')}
        >
          {selectedIcon && React.isValidElement(selectedIcon) && (
            <div className="flex flex-shrink-0 items-center justify-center overflow-hidden">
              {selectedIcon}
            </div>
          )}
          <span className="truncate text-left">{selectedDisplayValue}</span>
        </button>
      }
    />
  );

  return (
    <div className="relative flex min-w-0 max-w-[60vw] flex-col items-center gap-2 sm:max-w-xs">
      <Menu
        presentation="catalog"
        values={selectedValues}
        onValuesChange={(values: Record<string, any>) => {
          setSelectedValues({
            endpoint: values.endpoint || '',
            model: values.model || '',
            modelSpec: values.modelSpec || '',
          });
        }}
        onSearch={(value) => setSearchValue(value)}
        combobox={
          <input
            id="model-search"
            placeholder={localize('com_ui_search_models_count', { 0: modelCount })}
          />
        }
        finalFocus={modelTriggerRef}
        trigger={trigger}
      >
        <CatalogList
          endpoints={regularEndpoints}
          modelSpecs={catalogSpecs}
          hasSupplementaryResults={!!supplementarySearchResults?.length}
        />
        {menuContent}
      </Menu>
    </div>
  );
}

export default function ModelSelector({ startupConfig }: ModelSelectorProps) {
  const interfaceConfig = startupConfig?.interface ?? defaultInterface;
  const modelSpecs = startupConfig?.modelSpecs?.list ?? [];

  // Hide the selector when modelSelect is false and there are no model specs to show
  if (interfaceConfig.modelSelect === false && modelSpecs.length === 0) {
    return null;
  }

  return (
    <ModelSelectorChatProvider>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ModelSelectorContent />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}
