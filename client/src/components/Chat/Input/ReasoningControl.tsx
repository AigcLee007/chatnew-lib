import { BrainCircuit, RotateCcw } from 'lucide-react';
import type { TReasoningOverride } from 'librechat-data-provider';
import type { SettingDefinition } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

export type ScopedReasoningOverride = {
  targetKey: string;
  override: TReasoningOverride;
};

export function getScopedReasoningOverride(
  scoped: ScopedReasoningOverride | undefined,
  targetKey: string,
): TReasoningOverride | undefined {
  return scoped?.targetKey === targetKey ? scoped.override : undefined;
}

export default function ReasoningControl({
  setting,
  value,
  autoAllowed = true,
  descriptionId = 'reasoning-override-description',
  onChange,
}: {
  setting: SettingDefinition;
  value?: TReasoningOverride;
  autoAllowed?: boolean;
  descriptionId?: string;
  onChange: (override: TReasoningOverride | undefined) => void;
}) {
  const localize = useLocalize();
  const label = localize(
    (setting.label ?? 'com_ui_reasoning_level') as Parameters<typeof localize>[0],
  );
  return (
    <div className="flex max-w-[190px] items-center gap-1.5 text-xs text-text-secondary">
      <BrainCircuit aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">{label}</span>
      {setting.type === 'enum' ? (
        <select
          aria-label={label}
          aria-describedby={descriptionId}
          className="h-8 min-w-0 rounded-md border border-border-medium bg-surface-chat px-2 text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
          value={typeof value?.value === 'string' ? value.value : ''}
          onChange={(event) => {
            const selected = event.currentTarget.value;
            onChange(
              selected
                ? { key: setting.key as TReasoningOverride['key'], value: selected }
                : undefined,
            );
          }}
        >
          {autoAllowed && <option value="">{localize('com_ui_auto')}</option>}
          {(setting.options ?? []).filter(Boolean).map((option) => (
            <option key={option} value={option}>
              {localize(
                (setting.enumMappings?.[option]?.toString() ?? option) as Parameters<
                  typeof localize
                >[0],
              )}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            aria-label={label}
            aria-describedby={descriptionId}
            className="h-8 w-24 rounded-md border border-border-medium bg-surface-chat px-2 text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
            type="number"
            min={setting.range?.min}
            max={setting.range?.max}
            step={setting.range?.step ?? 1}
            placeholder={localize('com_ui_auto')}
            value={typeof value?.value === 'number' ? value.value : ''}
            onChange={(event) => {
              const rawValue = event.currentTarget.value;
              onChange(
                rawValue === ''
                  ? undefined
                  : { key: setting.key as TReasoningOverride['key'], value: Number(rawValue) },
              );
            }}
          />
          {autoAllowed && (
            <button
              aria-label={localize('com_ui_auto')}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary outline-none hover:bg-surface-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-heavy"
              onClick={() => onChange(undefined)}
              title={localize('com_ui_auto')}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </button>
          )}
        </>
      )}
      <span id={descriptionId} className="sr-only">
        {localize('com_ui_reasoning_next_message')}
      </span>
    </div>
  );
}
