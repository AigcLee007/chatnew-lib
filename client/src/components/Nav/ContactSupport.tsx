import { useState } from 'react';
import * as Menu from '@ariakit/react/menu';
import { Headphones, MessageCircle } from 'lucide-react';
import { DropdownMenuSeparator } from '@librechat/client';

export default function ContactSupport() {
  const [open, setOpen] = useState(false);

  return (
    <Menu.MenuProvider open={open} setOpen={setOpen} placement="right-start">
      <Menu.MenuItem
        className="select-item text-sm"
        render={<Menu.MenuButton />}
        onClick={() => setOpen((value) => !value)}
      >
        <Headphones className="icon-md" aria-hidden="true" />
        联系客服
      </Menu.MenuItem>
      <Menu.Menu
        portal
        className="account-settings-popover popover-ui z-[126] w-[260px] rounded-lg p-4"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageCircle className="size-4" aria-hidden="true" />
          联系客服
        </div>
        <DropdownMenuSeparator />
        <img
          src="/assets/wechat.png"
          alt="客服微信二维码"
          className="mx-auto size-48 rounded-md bg-white object-contain p-2"
        />
        <p className="mt-3 text-center text-xs text-text-secondary">扫码添加客服微信</p>
      </Menu.Menu>
    </Menu.MenuProvider>
  );
}
