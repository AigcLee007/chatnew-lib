import { useId, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import {
  Check,
  ChevronRight,
  Paperclip,
  Pin,
  Plus,
  SlidersHorizontal,
  Type,
  Wrench,
} from 'lucide-react';
import { Button, TooltipAnchor, useMediaQuery, usePopoverZIndex } from '@librechat/client';
import type { MenuItemProps } from '~/common';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export type ComposerMenuRenderer = (items: MenuItemProps[]) => React.ReactNode;

interface ComposerMenuProps {
  attachmentItems: MenuItemProps[];
  toolItems: MenuItemProps[];
  formatting: boolean;
  disabled?: boolean;
  onFormattingChange: (value: boolean) => void;
  onOpenParameters?: () => void;
}

const itemClassName =
  'flex min-h-[39px] w-full items-center gap-2.5 rounded-lg px-[9px] py-1 text-xs font-normal text-text-primary outline-none hover:bg-surface-hover focus-visible:bg-surface-hover [&>span>svg]:size-[17px]';

function MenuItems({
  items,
  close,
  tools = false,
}: {
  items: MenuItemProps[];
  close: () => void;
  tools?: boolean;
}) {
  const localize = useLocalize();
  return items
    .filter((item) => item.show !== false)
    .map((item, index) => {
      if (item.separate) {
        return (
          <Ariakit.MenuSeparator key={index} className="mx-[3px] my-[5px] border-border-light" />
        );
      }
      if (item.subItems?.length) {
        return (
          <MenuGroup
            key={item.id ?? index}
            label={item.label ?? ''}
            icon={item.icon}
            items={item.subItems}
            close={close}
          />
        );
      }
      let status: React.ReactNode = null;
      if (tools && item.ariaChecked !== undefined) {
        status = (
          <span
            aria-hidden="true"
            data-testid="tool-state"
            data-active={String(item.ariaChecked)}
            className={cn(
              'ms-auto inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border border-border-medium',
              item.ariaChecked && 'border-accent-primary bg-accent-primary text-text-on-status',
            )}
          >
            {item.ariaChecked && <Check className="size-3" />}
          </span>
        );
      } else if (item.ariaChecked !== undefined) {
        status = <Ariakit.MenuItemCheck checked={item.ariaChecked} />;
      }
      return (
        <div key={item.id ?? index} className="flex items-center gap-0.5">
          <Ariakit.MenuItem
            id={item.id}
            disabled={item.disabled}
            hideOnClick={false}
            render={item.render}
            aria-label={item.ariaLabel ?? item.label}
            aria-checked={item.ariaChecked}
            role={item.ariaChecked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            className={cn(
              itemClassName,
              'min-w-0 flex-1',
              item.className,
              tools && item.ariaChecked && 'bg-accent-primary/10 text-accent-primary',
            )}
            onClick={(event) => {
              item.onClick?.(event);
              if (item.hideOnClick !== false) close();
            }}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {item.icon}
              <span className="truncate">{item.label}</span>
            </span>
            {status}
          </Ariakit.MenuItem>
          {tools && item.onPinChange && (
            <Ariakit.MenuItem
              hideOnClick={false}
              role="button"
              render={<Button variant="ghost" size="icon-xs" />}
              disabled={item.disabled}
              className={cn(
                'size-[30px] shrink-0 rounded-[7px] text-text-tertiary',
                item.isPinned && 'bg-accent-primary/10 text-accent-primary',
              )}
              aria-label={`${item.isPinned ? localize('com_ui_unpin') : localize('com_ui_pin')} ${item.label ?? ''}`.trim()}
              aria-pressed={item.isPinned ?? false}
              onClick={(event) => {
                event.stopPropagation();
                item.onPinChange?.(!item.isPinned);
              }}
            >
              <Pin className="size-4" aria-hidden="true" />
            </Ariakit.MenuItem>
          )}
        </div>
      );
    });
}

function GroupContents({
  items,
  tools,
  attachments,
  close,
}: {
  items: MenuItemProps[];
  tools?: boolean;
  attachments?: boolean;
  close: () => void;
}) {
  const localize = useLocalize();
  return (
    <>
      {(tools || attachments) && (
        <div className="px-[9px] pb-[5px] pt-[7px] text-[10px] font-semibold text-text-secondary">
          {localize(tools ? 'com_ui_composer_available_tools' : 'com_ui_composer_attach_heading')}
        </div>
      )}
      {tools && (
        <p className="px-[9px] pb-[7px] pt-1.5 text-[10px] leading-[1.45] text-text-tertiary">
          {localize('com_ui_composer_tools_note')}
        </p>
      )}
      {attachments && (
        <p className="px-[9px] pb-[7px] pt-1.5 text-[10px] leading-[1.45] text-text-tertiary">
          {localize('com_ui_composer_attachments_note')}
        </p>
      )}
      <MenuItems items={items} tools={tools} close={close} />
      {tools && (
        <>
          <Ariakit.MenuSeparator className="mx-[3px] my-[5px] border-border-light" />
          <p className="px-[9px] pb-[7px] pt-1.5 text-[10px] leading-[1.45] text-text-tertiary">
            {localize(
              tools ? 'com_ui_composer_tools_availability' : 'com_ui_composer_attachments_note',
            )}
          </p>
        </>
      )}
    </>
  );
}

function MenuGroup({
  label,
  icon,
  items,
  close,
  meta,
  tools,
  attachments,
}: {
  label: string;
  icon: React.ReactNode;
  items: MenuItemProps[];
  close: () => void;
  meta?: string;
  tools?: boolean;
  attachments?: boolean;
}) {
  const store = Ariakit.useMenuStore({ placement: 'right-start', focusLoop: true });
  const zIndex = usePopoverZIndex();
  return (
    <Ariakit.MenuProvider store={store}>
      <Ariakit.MenuButton className={itemClassName} aria-label={label}>
        <span className="flex items-center gap-2.5">
          {icon}
          {label}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'ms-auto whitespace-nowrap text-[10px] text-text-tertiary',
            tools && 'rounded bg-accent-primary/10 px-1.5 py-0.5 text-accent-primary',
          )}
        >
          {meta}
        </span>
        <ChevronRight className="size-[15px] shrink-0 text-text-secondary" aria-hidden="true" />
      </Ariakit.MenuButton>
      <Ariakit.Menu
        portal
        gutter={8}
        unmountOnHide
        aria-label={label}
        className="popover-ui max-w-[calc(100vw-24px)]"
        style={{
          zIndex,
          width: 260,
          maxHeight: 'min(420px, calc(100dvh - 24px))',
          padding: 6,
          borderRadius: 12,
          margin: 0,
        }}
      >
        <GroupContents items={items} tools={tools} attachments={attachments} close={close} />
      </Ariakit.Menu>
    </Ariakit.MenuProvider>
  );
}

export default function ComposerMenu({
  attachmentItems,
  toolItems,
  formatting,
  disabled,
  onFormattingChange,
  onOpenParameters,
}: ComposerMenuProps) {
  const localize = useLocalize();
  const id = useId();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const zIndex = usePopoverZIndex();
  const menu = Ariakit.useMenuStore({
    open,
    setOpen: (value) => {
      setOpen(value);
      if (!value) setSection(null);
    },
    placement: 'top-start',
    focusLoop: true,
  });
  const close = () => menu.hide();
  const label = localize('com_ui_composer_add');
  const visibleTools = toolItems.filter((item) => item.show !== false && !item.separate);
  const visibleAttachments = attachmentItems.filter(
    (item) => item.show !== false && !item.separate,
  );
  const groups = [
    {
      id: 'attachments',
      label: localize('com_ui_composer_attachments'),
      icon: <Paperclip className="size-[17px]" aria-hidden="true" />,
      items: visibleAttachments,
      meta: localize('com_ui_composer_attachment_count', { count: visibleAttachments.length }),
    },
    {
      id: 'tools',
      label: localize('com_ui_tools'),
      icon: <Wrench className="size-[17px]" aria-hidden="true" />,
      items: visibleTools,
      meta: localize('com_ui_composer_tools_summary', {
        enabled: visibleTools.filter((item) => item.ariaChecked).length,
        pinned: visibleTools.filter((item) => item.isPinned).length,
      }),
    },
  ];
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Ariakit.MenuProvider store={menu}>
        <TooltipAnchor
          description={label}
          render={
            <Ariakit.MenuButton
              id="attach-file-menu-button"
              disabled={disabled}
              aria-label={label}
              render={<Button variant="ghost" size="icon-sm" />}
              className={cn(
                'size-9 rounded-[11px] text-text-secondary',
                open && 'bg-accent-primary/10 text-accent-primary',
              )}
            >
              <Plus className="size-[17px]" aria-hidden="true" />
            </Ariakit.MenuButton>
          }
        />
        <Ariakit.Menu
          portal
          modal={false}
          unmountOnHide
          gutter={10}
          className="popover-ui max-w-[calc(100vw-24px)]"
          style={{ zIndex, width: 242, padding: 6, borderRadius: 12, margin: 0 }}
        >
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) =>
              isMobile ? (
                <div key={group.id}>
                  <Ariakit.MenuItem
                    hideOnClick={false}
                    className={itemClassName}
                    aria-label={group.label}
                    aria-expanded={section === group.id}
                    aria-controls={`${id}-${group.id}`}
                    onClick={() => setSection(section === group.id ? null : group.id)}
                  >
                    <span className="flex items-center gap-2.5">
                      {group.icon}
                      {group.label}
                    </span>
                    <span aria-hidden="true" className="ms-auto text-[10px] text-text-tertiary">
                      {group.meta}
                    </span>
                    <ChevronRight
                      className={cn('size-[15px]', section === group.id && 'rotate-90')}
                      aria-hidden="true"
                    />
                  </Ariakit.MenuItem>
                  {section === group.id && (
                    <div
                      id={`${id}-${group.id}`}
                      role="group"
                      aria-label={group.label}
                      className="ms-3 max-h-[38dvh] overflow-y-auto border-s border-border-light ps-1"
                    >
                      <GroupContents
                        items={group.items}
                        tools={group.id === 'tools'}
                        attachments={group.id === 'attachments'}
                        close={close}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <MenuGroup
                  key={group.id}
                  label={group.label}
                  icon={group.icon}
                  items={group.items}
                  close={close}
                  meta={group.meta}
                  tools={group.id === 'tools'}
                  attachments={group.id === 'attachments'}
                />
              ),
            )}
          <Ariakit.MenuSeparator className="mx-[3px] my-[5px] border-border-light" />
          <Ariakit.MenuItem
            role="menuitemcheckbox"
            aria-checked={formatting}
            hideOnClick={false}
            className={cn(itemClassName, 'min-h-[42px]')}
            onClick={() => onFormattingChange(!formatting)}
          >
            <span className="flex items-center gap-2.5">
              <Type className="size-[17px]" aria-hidden="true" />
              {localize('com_ui_composer_formatting')}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'ms-auto flex h-[19px] w-[34px] shrink-0 items-center rounded-full bg-switch-unchecked p-[3px]',
                formatting && 'bg-accent-primary',
              )}
            >
              <span
                className={cn(
                  'size-[13px] rounded-full bg-surface-primary shadow-sm transition-transform',
                  formatting && 'translate-x-[15px]',
                )}
              />
            </span>
          </Ariakit.MenuItem>
          {onOpenParameters && (
            <Ariakit.MenuItem
              className={itemClassName}
              onClick={() => {
                close();
                onOpenParameters();
              }}
            >
              <span className="flex items-center gap-2.5">
                <SlidersHorizontal className="size-[17px]" aria-hidden="true" />
                {localize('com_ui_composer_parameters')}
              </span>
            </Ariakit.MenuItem>
          )}
        </Ariakit.Menu>
      </Ariakit.MenuProvider>
    </div>
  );
}
