import type { useLocalize } from '~/hooks';
import type { Endpoint } from '~/common';
import { filterItems } from '../utils';
import { buildModelCatalog, filterModelCatalog, groupModelCatalog } from '../catalog';

const agentsEndpoint: Endpoint = {
  value: 'agents',
  label: 'My Agents',
  hasModels: true,
  icon: null,
  showMarketplace: true,
  searchAliases: ['agent marketplace', 'marketplace'],
};

const disabledAgentsEndpoint: Endpoint = {
  value: 'agents',
  label: 'My Agents',
  hasModels: false,
  icon: null,
};

describe('model selector utilities', () => {
  it('builds grouped display rows without changing model IDs', () => {
    const endpoint: Endpoint = {
      value: 'google',
      label: 'Google',
      hasModels: true,
      icon: null,
      models: [{ name: 'gemini-3.5-flash-preview' }, { name: 'custom-model' }],
    };
    const entries = buildModelCatalog([endpoint], []);
    expect(entries.map((entry) => entry.model)).toEqual([
      'gemini-3.5-flash-preview',
      'custom-model',
    ]);
    expect(entries[0]).toMatchObject({ group: 'GEMINI', name: 'Gemini 3.5 Flash' });
    expect(groupModelCatalog(entries).get('GEMINI')).toHaveLength(2);
  });

  it('searches descriptions and keeps unknown models', () => {
    const endpoint: Endpoint = {
      value: 'openAI',
      label: 'OpenAI',
      hasModels: true,
      icon: null,
      models: [{ name: 'future-model' }],
    };
    const entries = buildModelCatalog([endpoint], []);
    expect(filterModelCatalog(entries, 'future')).toHaveLength(1);
    expect(filterModelCatalog(entries, 'missing')).toEqual([]);
  });

  it('matches endpoint search aliases', () => {
    const results = filterItems([agentsEndpoint], 'marketplace', undefined, undefined);
    expect(results).toEqual([agentsEndpoint]);
  });

  it('matches localized Marketplace labels', () => {
    const localize = ((key: string) => {
      if (key === 'com_agents_marketplace') {
        return 'Tienda de Agentes';
      }
      if (key === 'com_ui_marketplace') {
        return 'Tienda';
      }
      return key;
    }) as ReturnType<typeof useLocalize>;

    const results = filterItems([agentsEndpoint], 'tienda', undefined, undefined, localize);
    expect(results).toEqual([agentsEndpoint]);
  });

  it('does not match agents when there are no selectable agent options', () => {
    const results = filterItems([disabledAgentsEndpoint], 'my agents', undefined, undefined);
    expect(results).toEqual([]);
  });
});
