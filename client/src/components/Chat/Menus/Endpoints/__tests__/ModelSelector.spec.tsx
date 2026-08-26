import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getConfigDefaults } from 'librechat-data-provider';
import type { Endpoint, SelectedValues } from '~/common';
import ModelSelector from '../ModelSelector';
import mockEn from '~/locales/en/translation.json';

const mockSelectModel = jest.fn();
const mockSelectSpec = jest.fn();
const mockToggleFavorite = jest.fn();
let mockSearchValue = '';
const mockEndpoints: Endpoint[] = [
  {
    value: 'google',
    label: 'Google',
    hasModels: true,
    icon: null,
    models: [{ name: 'gemini-3.5-flash-preview' }, { name: 'gemini-3.1-pro-preview' }],
  },
  {
    value: 'OpenAI',
    label: 'OpenAI',
    hasModels: true,
    icon: null,
    models: [{ name: 'gpt-5.6-sol' }, { name: 'future-model' }],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    hasModels: true,
    icon: null,
    models: [{ name: 'claude-opus-4-8' }],
  },
  {
    value: 'agents',
    label: 'Agents',
    hasModels: true,
    icon: null,
    models: [{ name: 'agent-1' }],
    agentNames: { 'agent-1': 'Research Assistant' },
  },
];

jest.mock('../ModelSelectorChatContext', () => ({
  ModelSelectorChatProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../ModelSelectorContext', () => ({
  ModelSelectorProvider: ({ children }: { children: React.ReactNode }) => children,
  useModelSelectorContext: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [, rerender] = React.useState(0);
    const setSearchValue = (value: string) => {
      mockSearchValue = value;
      rerender((count: number) => count + 1);
    };
    const [selectedValues, setSelectedValues] = React.useState<SelectedValues>({
      endpoint: 'google',
      model: 'gemini-3.5-flash-preview',
      modelSpec: '',
    });
    return {
      mappedEndpoints: mockEndpoints,
      modelSpecs: [],
      endpointsConfig: {},
      agentsMap: {},
      searchValue: mockSearchValue,
      setSearchValue,
      selectedValues,
      setSelectedValues,
      searchResults:
        mockSearchValue === 'assistant' ? [mockEndpoints[mockEndpoints.length - 1]] : null,
      endpointSearchValues: {},
      setEndpointSearchValue: jest.fn(),
      endpointRequiresUserKey: () => true,
      handleSelectModel: mockSelectModel,
      handleSelectSpec: mockSelectSpec,
      handleSelectEndpoint: jest.fn(),
      handleOpenKeyDialog: jest.fn(),
    };
  },
}));
jest.mock('../DialogManager', () => () => null);
jest.mock('~/hooks/useKeyboardShortcuts', () => ({
  useShortcutHint: (_name: string, label: string) => label,
  useShortcutAriaKey: () => undefined,
}));
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: keyof typeof mockEn, options?: Record<string, string | number>) =>
    Object.entries(options ?? {}).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
      mockEn[key] ?? key,
    ),
  useFavorites: () => ({
    isFavoriteModel: () => false,
    toggleFavoriteModel: mockToggleFavorite,
    isFavoriteSpec: () => false,
    toggleFavoriteSpec: jest.fn(),
    isFavoriteAgent: () => false,
    toggleFavoriteAgent: jest.fn(),
  }),
  useIsActiveItem: () => ({ ref: { current: null }, isActive: false }),
}));

async function openSelector() {
  mockSearchValue = '';
  const user = userEvent.setup();
  render(<ModelSelector startupConfig={getConfigDefaults()} />);
  await user.click(screen.getByTestId('model-selector-button'));
  await screen.findByRole('combobox');
  return user;
}

describe('model catalog menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows models directly with descriptions and no API-key settings', async () => {
    await openSelector();
    expect(await screen.findByText('Gemini 3.5 Flash')).toBeVisible();
    expect(screen.getByText('GPT-5.6 Sol')).toBeVisible();
    expect(screen.queryByRole('button', { name: /key/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search 5 models...')).toBeInTheDocument();
    expect(screen.getByText(/low latency/i)).toBeVisible();
  });

  it('filters by description, hides empty groups, and selects the original ID', async () => {
    const user = await openSelector();
    await user.type(screen.getByRole('combobox'), 'latency');
    const option = await screen.findByText('Gemini 3.5 Flash');
    expect(screen.queryByText('GPT-5.6 Sol')).not.toBeInTheDocument();
    await user.click(option);
    expect(mockSelectModel).toHaveBeenCalledWith(mockEndpoints[0], 'gemini-3.5-flash-preview');
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it('preserves unknown models and pinning does not select a model or close the menu', async () => {
    const user = await openSelector();
    const option = await screen.findByText('future-model');
    await user.click(
      within(option.parentElement?.parentElement as HTMLElement).getByRole('button', {
        name: /pin/i,
      }),
    );
    expect(mockToggleFavorite).toHaveBeenCalledWith({ model: 'future-model', endpoint: 'OpenAI' });
    expect(mockSelectModel).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toBeVisible();
  });

  it('shows an empty state and Escape returns focus to the trigger', async () => {
    const user = await openSelector();
    await user.type(screen.getByRole('combobox'), 'no-such-model');
    expect(await screen.findByText('No results match your search')).toBeVisible();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
    expect(screen.getByTestId('model-selector-button')).toHaveFocus();
  });

  it('keeps specialized endpoints searchable without showing unrelated catalog rows', async () => {
    const user = await openSelector();
    await user.type(screen.getByRole('combobox'), 'assistant');
    expect(await screen.findByText('Research Assistant')).toBeVisible();
    expect(screen.queryByText('Gemini 3.5 Flash')).not.toBeInTheDocument();
  });
});
