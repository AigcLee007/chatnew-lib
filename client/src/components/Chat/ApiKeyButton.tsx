import { useRef, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  OGDialog,
  OGDialogContent,
  OGDialogFooter,
  OGDialogHeader,
  OGDialogTitle,
  TooltipAnchor,
  useToastContext,
} from '@librechat/client';
import { AITTCO_SHARED_KEY_NAME } from 'librechat-data-provider';
import { useUpdateUserKeysMutation, useUserKeyQuery } from 'librechat-data-provider/react-query';
import { NotificationSeverity } from '~/common';
import { useLocalize } from '~/hooks';

const STATUS_ID = 'shared-api-key-status';

const getConfiguredLabel = (localize: ReturnType<typeof useLocalize>) => {
  const configuredLabel = localize('com_ui_shared_key_configured');
  return configuredLabel === 'com_ui_shared_key_configured'
    ? localize('com_ui_tools_info_configured')
    : configuredLabel;
};

export default function ApiKeyButton() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const keyQuery = useUserKeyQuery(AITTCO_SHARED_KEY_NAME);
  const updateUserKeysMutation = useUpdateUserKeysMutation();
  const isLoading = updateUserKeysMutation.isLoading;
  const isConfigured = Boolean(keyQuery.data?.expiresAt);
  const statusLabel = isConfigured
    ? getConfiguredLabel(localize)
    : localize('com_ui_shared_key_not_configured');

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setApiKey('');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      return;
    }

    updateUserKeysMutation.mutate(
      {
        name: AITTCO_SHARED_KEY_NAME,
        value: trimmedKey,
        expiresAt: '',
      },
      {
        onSuccess: () => {
          showToast({
            message: localize('com_ui_save_key_success'),
            status: NotificationSeverity.SUCCESS,
          });
          handleOpenChange(false);
        },
        onError: () => {
          showToast({
            message: localize('com_ui_save_key_error'),
            status: NotificationSeverity.ERROR,
          });
        },
      },
    );
  };

  return (
    <>
      <TooltipAnchor
        description={localize('com_ui_manage_api_key')}
        render={
          <Button
            ref={triggerRef}
            type="button"
            size="icon"
            variant="outline"
            className="size-9 flex-shrink-0 rounded-xl bg-presentation hover:bg-surface-active-alt"
            aria-label={localize('com_ui_manage_api_key')}
            onClick={() => setOpen(true)}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      />

      <OGDialog open={open} onOpenChange={handleOpenChange} triggerRef={triggerRef}>
        <OGDialogContent className="w-11/12 max-w-md">
          <OGDialogHeader>
            <OGDialogTitle>{localize('com_ui_edit_shared_key_title')}</OGDialogTitle>
          </OGDialogHeader>

          <p id={STATUS_ID} className="text-sm text-text-secondary">
            {statusLabel}
          </p>

          <form className="grid gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="api-key-input">{localize('com_ui_api_key')}</Label>
              <Input
                id="api-key-input"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={localize('com_ui_shared_key_placeholder')}
                aria-describedby={STATUS_ID}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                spellCheck={false}
              />
            </div>

            <OGDialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {localize('com_ui_cancel')}
              </Button>
              <Button type="submit" variant="submit" disabled={isLoading || !apiKey.trim()}>
                {localize('com_ui_save')}
              </Button>
            </OGDialogFooter>
          </form>
        </OGDialogContent>
      </OGDialog>
    </>
  );
}
