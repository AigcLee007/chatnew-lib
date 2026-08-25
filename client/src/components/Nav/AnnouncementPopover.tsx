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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AnnouncementPopover({ compact = false }: { compact?: boolean }) {
  const { user } = useAuthContext();
  const isAuthenticated = Boolean(user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'DELEGATED_ADMIN';
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAnnouncement, setDetailAnnouncement] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const itemsRef = useRef<Announcement[]>([]);
  const markingRef = useRef(false);
  const pendingMarkIdsRef = useRef(new Set<string>());
  const seenUnreadIdsRef = useRef(new Set<string>());
  const openRef = useRef(open);
  const announcementButtonRef = useRef<HTMLButtonElement>(null);
  const detailDialogRef = useRef<HTMLDivElement>(null);
  const loadVersionRef = useRef(0);
  const itemsRevisionRef = useRef(0);

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
        itemsRevisionRef.current += 1;
        if (markingRef.current) {
          nextItems.filter((item: Announcement) => item.unread).forEach((item: Announcement) => {
            pendingMarkIdsRef.current.add(item._id);
          });
        }
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
    const newUnread = items.find(
      (item) => item.unread && !seenUnreadIdsRef.current.has(item._id),
    );
    if (newUnread) {
      setOpen(true);
      setDetailAnnouncement(newUnread);
      setDetailOpen(true);
    }
    seenUnreadIdsRef.current = unreadIds;
  }, [items]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const markRead = useCallback(async () => {
    const announcementIds = itemsRef.current.filter((item) => item.unread).map((item) => item._id);
    if (announcementIds.length === 0) return;
    if (markingRef.current) {
      announcementIds.forEach((id) => pendingMarkIdsRef.current.add(id));
      return;
    }
    markingRef.current = true;
    const requestRevision = itemsRevisionRef.current;
    try {
      const response = await fetch('/api/announcements/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ announcementIds }),
      });
      if (response.ok) {
        if (itemsRevisionRef.current === requestRevision) {
          itemsRef.current = itemsRef.current.map((item) =>
            announcementIds.includes(item._id) ? { ...item, unread: false } : item,
          );
          setItems(itemsRef.current);
        } else {
          itemsRef.current
            .filter((item) => item.unread)
            .forEach((item) => pendingMarkIdsRef.current.add(item._id));
        }
      }
    } catch {
      // Keep unread state so the next menu open retries the request.
    } finally {
      markingRef.current = false;
      if (pendingMarkIdsRef.current.size > 0) {
        pendingMarkIdsRef.current.clear();
        void markRead();
      }
    }
  }, [authHeaders]);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setOpen(false);
    announcementButtonRef.current?.focus();
    void markRead();
  }, [markRead]);

  useEffect(() => {
    if (!detailOpen) return undefined;
    const dialog = detailDialogRef.current;
    if (!dialog) return undefined;

    const getFocusableElements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const firstFocusable = getFocusableElements()[0] ?? dialog;
    firstFocusable.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeDetail();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        event.stopPropagation();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        event.stopPropagation();
        first.focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        event.stopPropagation();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        event.stopPropagation();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [closeDetail, detailOpen]);

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
          ref={announcementButtonRef}
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
        <Menu.MenuItem
          className="select-item text-sm"
          render={<Menu.MenuButton ref={announcementButtonRef} />}
        >
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
      {detailOpen && detailAnnouncement && (
        <div
          ref={detailDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-detail-title"
          tabIndex={-1}
          className="fixed inset-0 z-[127] flex items-start justify-center bg-black/40 p-4 pt-20"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <div
            className="max-h-[calc(100vh-6rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border-medium bg-surface-primary p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="announcement-detail-title" className="text-base font-semibold">
                {detailAnnouncement.pinned && (
                  <span
                    aria-hidden="true"
                    className="mr-1 inline-flex items-center gap-1 text-xs text-text-secondary"
                  >
                    <Pin className="size-3" aria-hidden="true" />
                    置顶
                  </span>
                )}
                {detailAnnouncement.title}
              </h2>
              <button
                type="button"
                aria-label="关闭公告详情"
                className="rounded p-1 text-text-secondary hover:bg-surface-hover"
                onClick={closeDetail}
              >
                ×
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
              {detailAnnouncement.content}
            </p>
            <button
              type="button"
              className="mt-5 rounded bg-accent-primary px-3 py-2 text-sm font-medium text-white hover:bg-accent-primary-hover"
              onClick={closeDetail}
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </Menu.MenuProvider>
  );
}
