import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, waitFor, screen, render } from 'test/layout-test-utils';
import { useUpdateUserKeysMutation, useUserKeyQuery } from 'librechat-data-provider/react-query';
import ApiKeyButton from '../ApiKeyButton';

const AITTCO_SHARED_KEY_NAME = 'aittco_shared';

const mockUseUserKeyQuery = useUserKeyQuery as jest.Mock;
const mockUseUpdateUserKeysMutation = useUpdateUserKeysMutation as jest.Mock;

jest.mock('librechat-data-provider/react-query', () => ({
  useUpdateUserKeysMutation: jest.fn(),
  useUserKeyQuery: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      com_ui_manage_api_key: 'Manage API key',
      com_ui_api_key: 'API Key',
      com_ui_save: 'Save',
      com_ui_tools_info_configured: 'Configured',
    };

    let translated = translations[key] ?? key;

    if (values) {
      translated = Object.entries(values).reduce(
        (result, [placeholder, value]) =>
          result.replace(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'), String(value)),
        translated,
      );
    }

    return translated;
  },
}));

describe('ApiKeyButton', () => {
  let mutate: jest.Mock;

  beforeEach(() => {
    mockUseUserKeyQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    mutate = jest.fn();
    mockUseUpdateUserKeysMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens the dialog and shows a password textbox', () => {
    render(<ApiKeyButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage API key' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const input = screen.getByLabelText('API Key');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('does not reveal a stored key when configured', () => {
    mockUseUserKeyQuery.mockReturnValue({
      data: {
        value: 'secret-key-value',
        expiresAt: 'never',
      },
      isLoading: false,
    });

    render(<ApiKeyButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage API key' }));

    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key')).not.toHaveValue('secret-key-value');
    expect(screen.queryByText('secret-key-value')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('secret-key-value')).not.toBeInTheDocument();
  });

  it('trims the replacement key before submitting the mutation', async () => {
    render(<ApiKeyButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage API key' }));

    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: '  replacement-key  ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          name: AITTCO_SHARED_KEY_NAME,
          value: 'replacement-key',
          expiresAt: '',
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      ),
    );
  });

  it('blocks whitespace-only submission', () => {
    render(<ApiKeyButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage API key' }));

    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: '   ' },
    });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);

    expect(saveButton).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and preserves the entered value on mutation error', async () => {
    mutate.mockImplementation((_payload: unknown, options?: { onError?: (error: Error) => void }) => {
      options?.onError?.(new Error('boom'));
    });

    render(<ApiKeyButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage API key' }));

    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'replacement-key' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(screen.getByLabelText('API Key')).toHaveValue('replacement-key');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
