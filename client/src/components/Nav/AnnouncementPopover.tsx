import { useCallback, useEffect, useRef, useState } from 'react';
import * as Menu from '@ariakit/react/menu';
import { Bell, Pin } from 'lucide-react';
import { DropdownMenuSeparator } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';
import { getTokenHeader } from 'librechat-data-provider';

type Announcement = {
  _id: string;
  title: string;
  content: string;
  unread?: boolean;
  pinned?: boolean;
  active?: boolean;
};

export default function AnnouncementPopover({ compact = false }: { compact?: boolean }) {
  const { user } = useAuthContext();
  const isAuthenticated = Boolean(user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'DELEGATED_ADMIN';
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const itemsRef = useRef<Announcement[]>([]);
  const markingRef = useRef(false);
  const pendingMarkRef = useRef(false);
  const seenUnreadIdsRef = useRef(new Set<string>());
  const openRef = useRef(open);
  const loadVersionRef = useRef(0);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getTokenHeader();
    return token ? { Authorization: token } : {};
  }, []);

  const load = useCallback(() => {
    const loadVersion = ++loadVersionRef.current;
    return fetch(`/api/announcements${canManage ? '?all=true' : ''}`, { headers: authHeaders() })
      .then((response) => (response.ok ? response.json() : []))
      .then((nextItems) => {
        if (loadVersion !== loadVersionRef.current) return false;
        itemsRef.current = nextItems;
        setItems(nextItems);
        return true;
      })
      .catch(() => {
        if (loadVersion !== loadVersionRef.current) return false;
        itemsRef.current = [];
        setItems([]);
        return true;
      });
  }, [authHeaders, canManage]);

  const hasUnread = items.some((item) => item.unread === true);

  useEffect(() => {
    const unreadIds = new Set(items.filter((item) => item.unread).map((item) => item._id));
    if ([...unreadIds].some((id) => !seenUnreadIdsRef.current.has(id))) setOpen(true);
    seenUnreadIdsRef.current = unreadIds;
  }, [items]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const markRead = useCallback(async () => {
    const announcementIds = itemsRef.current.filter((item) => item.unread).map((item) => item._id);
    if (announcementIds.length === 0) return;
    if (markingRef.current) {
      pendingMarkRef.current = true;
      return;
    }
    markingRef.current = true;
    try {
      const response = await fetch('/api/announcements/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ announcementIds }),
      });
      if (response.ok) {
        itemsRef.current = itemsRef.current.map((item) =>
          announcementIds.includes(item._id) ? { ...item, unread: false } : item,
        );
        setItems(itemsRef.current);
      }
    } catch {
      // Keep unread state so the next menu open retries the request.
    } finally {
      markingRef.current = false;
      if (pendingMarkRef.current) {
        pendingMarkRef.current = false;
        void markRead();
      }
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    void load();
    const refreshOnFocus = () => {
      const wasOpen = openRef.current;
      void load().then((applied) => {
        if (wasOpen && applied) return markRead();
      });
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [isAuthenticated, load, markRead]);

  useEffect(() => {
    if (open) void markRead();
  }, [markRead, open]);

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
    const response = await fetch(`/api/announcements/${item._id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (response.ok) load();
  };

  return (
    <Menu.MenuProvider
      open={open}
      setOpen={setOpen}
      placement={compact ? 'bottom-end' : 'right-start'}
    >
      {compact ? (
        <Menu.MenuButton
          className="relative flex size-9 cursor-pointer items-center justify-center rounded-lg p-2 transition-colors hover:bg-surface-hover"
          aria-label="公告"
          title="公告"
        >
          <Bell className="icon-md" aria-hidden="true" />
          {hasUnread && (
            <span
              className="absolute right-1 top-1 size-2 rounded-full bg-red-500"
              aria-label="有新公告"
            />
          )}
        </Menu.MenuButton>
      ) : (
        <Menu.MenuItem className="select-item text-sm" render={<Menu.MenuButton />}>
          <Bell className="icon-md" aria-hidden="true" />
          公告
          {hasUnread && (
            <span className="ml-auto size-2 rounded-full bg-red-500" aria-label="有新公告" />
          )}
        </Menu.MenuItem>
      )}
      <Menu.Menu
        portal
        className="account-settings-popover popover-ui z-[126] w-[320px] rounded-lg p-4"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bell className="size-4" />
          公告
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {items.length === 0 && <p className="text-sm text-text-secondary">暂无公告</p>}
          {items.map((item) => (
            <article key={item._id} className="border-b border-border-medium pb-3 last:border-0">
              <h3 className="flex items-center gap-1 text-sm font-medium">
                {item.pinned && <Pin className="size-3" />}
                {item.title}
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-xs text-text-secondary">{item.content}</p>
              {canManage && (
                <div className="mt-2 flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-accent-primary"
                    onClick={() => update(item, { active: !item.active })}
                  >
                    {item.active === false ? '启用' : '停用'}
                  </button>
                  <button type="button" className="text-red-500" onClick={() => remove(item)}>
                    删除
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <div className="space-y-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="公告标题"
                className="w-full rounded border border-border-medium bg-transparent px-2 py-1 text-sm"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="公告内容"
                className="w-full rounded border border-border-medium bg-transparent px-2 py-1 text-sm"
                rows={3}
              />
              <button
                type="button"
                onClick={publish}
                className="w-full rounded bg-accent-primary px-3 py-2 text-sm font-medium text-white hover:bg-accent-primary-hover"
              >
                发布公告
              </button>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </>
        )}
      </Menu.Menu>
    </Menu.MenuProvider>
  );
}
