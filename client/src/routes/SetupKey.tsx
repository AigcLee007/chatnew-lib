import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserKeyQuery, useUpdateUserKeysMutation } from 'librechat-data-provider/react-query';
import { useAuthContext, useLocalize } from '~/hooks';

const SHARED_KEY_NAME = 'aittco_shared';

export default function SetupKey() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const keyQuery = useUserKeyQuery(SHARED_KEY_NAME, { refetchOnMount: true });
  const updateKey = useUpdateUserKeysMutation();
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (keyQuery.data?.expiresAt) {
      navigate('/c/new', { replace: true });
    }
  }, [keyQuery.data?.expiresAt, navigate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey || updateKey.isLoading) {
      return;
    }
    updateKey.mutate(
      { name: SHARED_KEY_NAME, value: trimmedKey, expiresAt: '' },
      { onSuccess: () => navigate('/c/new', { replace: true }) },
    );
  };

  if (!isAuthenticated || keyQuery.isLoading || keyQuery.data?.expiresAt) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-primary px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-lg border border-border-medium p-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{localize('com_ui_shared_key_title')}</h1>
          <p className="mt-2 text-sm text-text-secondary">{localize('com_ui_shared_key_description')}</p>
        </div>
        <label className="block text-sm text-text-primary">
          {localize('com_ui_api_key')}
          <input
            autoFocus
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="mt-2 w-full rounded-md border border-border-medium bg-surface-secondary px-3 py-2"
            placeholder={localize('com_ui_shared_key_placeholder')}
          />
        </label>
        {updateKey.isError && <p className="text-sm text-red-500">{localize('com_ui_shared_key_error')}</p>}
        <button
          type="submit"
          disabled={!apiKey.trim() || updateKey.isLoading}
          className="w-full rounded-md bg-accent-primary px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {localize('com_ui_shared_key_continue')}
        </button>
      </form>
    </main>
  );
}
