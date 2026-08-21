import { useEffect, useState } from 'react';
import * as Menu from '@ariakit/react/menu';
import { Bell, Pin } from 'lucide-react';
import { DropdownMenuSeparator } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';
import { getTokenHeader } from 'librechat-data-provider';

type Announcement = { _id: string; title: string; content: string; pinned?: boolean; active?: boolean };

export default function AnnouncementPopover() {
  const { user } = useAuthContext();
  const canManage = user?.role === 'ADMIN' || user?.role === 'DELEGATED_ADMIN';
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const authHeaders = () => {
    const token = getTokenHeader();
    return token ? { Authorization: token } : {};
  };

  const load = () =>
    fetch(`/api/announcements${canManage ? '?all=true' : ''}`, { headers: authHeaders() })
      .then((response) => (response.ok ? response.json() : []))
      .then(setItems)
      .catch(() => setItems([]));

  useEffect(() => {
    load();
  }, [canManage]);

  const publish = async () => {
    if (!title.trim() || !content.trim()) return;
    setError('');
    const response = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ title, content, pinned: true }),
    });
    if (response.ok) {
      setTitle('');
      setContent('');
      load();
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body?.error || body?.message || `发布失败（HTTP ${response.status}）`);
    }
  };

  const update = async (item: Announcement, changes: Partial<Announcement>) => {
    const response = await fetch(`/api/announcements/${item._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(changes),
    });
    if (response.ok) load();
  };

  const remove = async (item: Announcement) => {
    if (!window.confirm(`确定删除公告“${item.title}”吗？`)) return;
    const response = await fetch(`/api/announcements/${item._id}`, { method: 'DELETE', headers: authHeaders() });
    if (response.ok) load();
  };

  return (
    <Menu.MenuProvider open={open} setOpen={setOpen} placement="right-start">
      <Menu.MenuItem
        className="select-item text-sm"
        render={<Menu.MenuButton />}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="icon-md" aria-hidden="true" />
        公告
        {items.length > 0 && <span className="ml-auto size-2 rounded-full bg-red-500" aria-label="有新公告" />}
      </Menu.MenuItem>
      <Menu.Menu portal className="account-settings-popover popover-ui z-[126] w-[320px] rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-medium"><Bell className="size-4" />公告</div>
        <DropdownMenuSeparator />
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {items.length === 0 && <p className="text-sm text-text-secondary">暂无公告</p>}
          {items.map((item) => (
            <article key={item._id} className="border-b border-border-medium pb-3 last:border-0">
              <h3 className="flex items-center gap-1 text-sm font-medium">{item.pinned && <Pin className="size-3" />}{item.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-xs text-text-secondary">{item.content}</p>
              {canManage && (
                <div className="mt-2 flex gap-2 text-xs">
                  <button type="button" className="text-accent-primary" onClick={() => update(item, { active: !item.active })}>
                    {item.active === false ? '启用' : '停用'}
                  </button>
                  <button type="button" className="text-red-500" onClick={() => remove(item)}>删除</button>
                </div>
              )}
            </article>
          ))}
        </div>
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <div className="space-y-2">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="公告标题" className="w-full rounded border border-border-medium bg-transparent px-2 py-1 text-sm" />
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="公告内容" className="w-full rounded border border-border-medium bg-transparent px-2 py-1 text-sm" rows={3} />
              <button type="button" onClick={publish} className="w-full rounded bg-accent-primary px-3 py-2 text-sm font-medium text-white hover:bg-accent-primary-hover">发布公告</button>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </>
        )}
      </Menu.Menu>
    </Menu.MenuProvider>
  );
}
