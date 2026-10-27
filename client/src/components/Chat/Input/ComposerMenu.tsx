import { useId, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { ChevronRight, Paperclip, Plus, SlidersHorizontal, Type, Wrench } from 'lucide-react';
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
  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm text-text-primary outline-none hover:bg-surface-hover focus:bg-surface-hover md:py-2';

function MenuItems({ items, close }: { items: MenuItemProps[]; close: () => void }) {
  return items
    .filter((item) => item.show !== false)
    .map((item, index) => {
      if (item.separate) {
        return <Ariakit.MenuSeparator key={index} className="my-1 border-border-light" />;
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
      return (
        <Ariakit.MenuItem
          key={item.id ?? index}
          id={item.id}
          disabled={item.disabled}
          hideOnClick={false}
          render={item.render}
          aria-label={item.ariaLabel}
          aria-checked={item.ariaChecked}
          role={item.ariaChecked === undefined ? 'menuitem' : 'menuitemcheckbox'}
          className={cn(itemClassName, item.className)}
          onClick={(event) => {
            item.onClick?.(event);
            if (item.hideOnClick !== false) {
              close();
            }
          }}
        >
          <span className="flex items-center gap-2">
            {item.icon}
            {item.label}
          </span>
          {item.ariaChecked !== undefined && <Ariakit.MenuItemCheck checked={item.ariaChecked} />}
        </Ariakit.MenuItem>
      );
    });
}

function MenuGroup({
  label,
  icon,
  items,
  close,
}: {
  label: string;
  icon: React.ReactNode;
  items: MenuItemProps[];
  close: () => void;
}) {
  const store = Ariakit.useMenuStore({ placement: 'right-start', focusLoop: true });
  const zIndex = usePopoverZIndex();
  return (
    <Ariakit.MenuProvider store={store}>
      <Ariakit.MenuButton className={itemClassName}>
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Ariakit.MenuButton>
      <Ariakit.Menu
        portal
        gutter={8}
        unmountOnHide
        className="popover-ui min-w-60 max-w-[calc(100vw-2rem)]"
        style={{ zIndex }}
      >
        <MenuItems items={items} close={close} />
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
      if (!value) {
        setSection(null);
      }
    },
    placement: 'top-start',
    focusLoop: true,
  });
  const close = () => menu.hide();
  const label = localize('com_ui_composer_add');
  const groups = [
    {
      id: 'attachments',
      label: localize('com_ui_composer_attachments'),
      icon: <Paperclip className="size-4" aria-hidden="true" />,
      items: attachmentItems,
    },
    {
      id: 'tools',
      label: localize('com_ui_tools'),
      icon: <Wrench className="size-4" aria-hidden="true" />,
      items: toolItems,
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
              render={<Button variant="ghost" size="theme" shape="theme" />}
            >
              <Plus className="size-5" aria-hidden="true" />
            </Ariakit.MenuButton>
          }
        />
        <Ariakit.Menu
          portal
          modal={false}
          unmountOnHide
          gutter={8}
          className="popover-ui w-72 max-w-[calc(100vw-2rem)]"
          style={{ zIndex }}
        >
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) =>
              isMobile ? (
                <div key={group.id}>
                  <Ariakit.MenuItem
                    hideOnClick={false}
                    className={itemClassName}
                    aria-expanded={section === group.id}
                    aria-controls={`${id}-${group.id}`}
                    onClick={() => setSection(section === group.id ? null : group.id)}
                  >
                    <span className="flex items-center gap-2">
                      {group.icon}
                      {group.label}
                    </span>
                    <ChevronRight
                      className={cn('size-4', section === group.id && 'rotate-90')}
                      aria-hidden="true"
                    />
                  </Ariakit.MenuItem>
                  {section === group.id && (
                    <div
                      id={`${id}-${group.id}`}
                      role="group"
                      aria-label={group.label}
                      className="ms-3 border-s border-border-light ps-1"
                    >
                      <MenuItems items={group.items} close={close} />
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
                />
              ),
            )}
          <Ariakit.MenuSeparator className="my-1 border-border-light" />
          <Ariakit.MenuItem
            role="menuitemcheckbox"
            aria-checked={formatting}
            hideOnClick={false}
            className={itemClassName}
            onClick={() => onFormattingChange(!formatting)}
          >
            <span className="flex items-center gap-2">
              <Type className="size-4" aria-hidden="true" />
              {localize('com_ui_composer_formatting')}
            </span>
            <Ariakit.MenuItemCheck checked={formatting} />
          </Ariakit.MenuItem>
          {onOpenParameters && (
            <Ariakit.MenuItem
              className={itemClassName}
              onClick={() => {
                close();
                onOpenParameters();
              }}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {localize('com_ui_composer_parameters')}
              </span>
            </Ariakit.MenuItem>
          )}
        </Ariakit.Menu>
      </Ariakit.MenuProvider>
    </div>
  );
}
