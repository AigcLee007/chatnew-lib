import React, { useId, useMemo, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@librechat/client';
import { getConfigDefaults, isAgentsEndpoint, isAssistantsEndpoint } from 'librechat-data-provider';
import type { ModelSelectorProps } from '~/common';
import { renderEndpoints, renderModelSpecs, renderSearchResults } from './components';
import { ModelSelectorProvider, useModelSelectorContext } from './ModelSelectorContext';
import { useShortcutAriaKey } from '~/hooks/useKeyboardShortcuts';
import { ModelSelectorChatProvider } from './ModelSelectorChatContext';
import { getSelectedIcon, getDisplayValue } from './utils';
import { modelDisplayInfo } from './catalog';
import ProviderIcon from './components/ProviderIcon';
import { CustomMenu as Menu } from './CustomMenu';
import ProviderCatalogList from './components/ProviderCatalogList';
import { VIRTUALIZE_THRESHOLD } from './components/EndpointModelItem';
import { useLocalize } from '~/hooks';
import { buildModelCatalog } from './catalog';

const defaultInterface = getConfigDefaults().interface;

function ModelSelectorContent({ disabled }: { disabled?: boolean }) {
  const searchId = useId();
  const localize = useLocalize();
  const modelSelectorAriaKey = useShortcutAriaKey('openModelSelector');
  const { mappedEndpoints } = useModelSelectorContext();

  const {
    // LibreChat
    agentsMap,
    modelSpecs,
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
  const modelCount = buildModelCatalog(regularEndpoints, catalogSpecs, localize).length;
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
    <Button
      variant="ghost"
      size="sm"
      type="button"
      disabled={disabled}
      ref={modelTriggerRef}
      data-testid="model-selector-button"
      aria-keyshortcuts={modelSelectorAriaKey}
      className="h-8 min-w-0 max-w-full gap-1 px-1.5 text-xs text-text-secondary"
      aria-label={localize('com_ui_select_model')}
    >
      {selectedIcon && React.isValidElement(selectedIcon) && (
        <div className="hidden size-4 shrink-0 items-center justify-center overflow-hidden sm:flex">
          {selectedIcon}
        </div>
      )}
      <span className="truncate text-left">{selectedDisplayValue}</span>
      <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
    </Button>
  );

  return (
    <div
      className="relative flex min-w-0 max-w-full flex-col"
      onClick={(event) => event.stopPropagation()}
    >
      <Menu
        presentation="composer"
        placement="top-end"
        disabled={disabled}
        className="h-8 min-w-0 gap-1 border-0 bg-transparent px-1.5 py-1 shadow-none"
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
            id={searchId}
            aria-label={localize('com_ui_select_model')}
            placeholder={localize('com_ui_search_models_count', { 0: modelCount })}
          />
        }
        finalFocus={modelTriggerRef}
        trigger={trigger}
      >
        <ProviderCatalogList
          endpoints={regularEndpoints}
          modelSpecs={catalogSpecs}
          hasSupplementaryResults={!!supplementarySearchResults?.length}
        />
        {menuContent}
      </Menu>
    </div>
  );
}

export default function ModelSelector({ startupConfig, index = 0, disabled }: ModelSelectorProps) {
  const interfaceConfig = startupConfig?.interface ?? defaultInterface;
  const modelSpecs = startupConfig?.modelSpecs?.list ?? [];

  // Hide the selector when modelSelect is false and there are no model specs to show
  if (interfaceConfig.modelSelect === false && modelSpecs.length === 0) {
    return null;
  }

  return (
    <ModelSelectorChatProvider index={index}>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ModelSelectorContent disabled={disabled} />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}
