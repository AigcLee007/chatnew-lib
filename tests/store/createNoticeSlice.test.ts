import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import type { Notice } from '../../types';
import { createNoticeSlice, type NoticeSlice } from '../../store/slices/createNoticeSlice';

const newestNotice: Notice = {
  id: 'notice-new',
  title: 'Newest notice',
  content: 'Newest content',
  date: '2026-08-24T09:00:00.000Z',
  active: true,
  pinned: false,
};

const olderNotice: Notice = {
  id: 'notice-old',
  title: 'Older notice',
  content: 'Older content',
  date: '2026-08-23T09:00:00.000Z',
  active: true,
  pinned: false,
};

type TestState = NoticeSlice & { apiKey: string };

function createTestSlice(initialState: Partial<TestState> = {}) {
  let state: TestState;
  const set = (update: Partial<TestState> | ((current: TestState) => Partial<TestState>)) => {
    const next = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...next };
  };
  const slice = createNoticeSlice(set as never, () => state, {} as never);
  state = { ...slice, apiKey: '', ...initialState };
  return { getState: () => state };
}

describe('createNoticeSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('uses the newest active list item as latestNotice after a successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ total: 2, page: 1, pageSize: 10, items: [newestNotice, olderNotice] }),
      }),
    );
    const store = createTestSlice();

    await store.getState().fetchNotices();

    expect(store.getState().notices).toEqual([newestNotice, olderNotice]);
    expect(store.getState().latestNotice).toEqual(newestNotice);
    expect(store.getState().hasUnreadNotice).toBe(true);
  });

  it('preserves the current notice state when a fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const store = createTestSlice({
      notices: [olderNotice],
      latestNotice: olderNotice,
      hasUnreadNotice: true,
    });

    await store.getState().fetchNotices();

    expect(store.getState().notices).toEqual([olderNotice]);
    expect(store.getState().latestNotice).toEqual(olderNotice);
    expect(store.getState().hasUnreadNotice).toBe(true);
  });

  it('keeps a notice unread when its detail is opened', () => {
    const store = createTestSlice({ latestNotice: newestNotice, hasUnreadNotice: true });

    store.getState().setNoticeModalOpen(true, newestNotice);

    expect(localStorage.getItem('lastReadNoticeId')).toBeNull();
    expect(store.getState().hasUnreadNotice).toBe(true);
  });

  it('marks a notice as read only when its detail is confirmed closed', () => {
    const store = createTestSlice({ latestNotice: newestNotice, hasUnreadNotice: true });

    store.getState().setNoticeModalOpen(false, newestNotice);

    expect(localStorage.getItem('lastReadNoticeId')).toBe(newestNotice.id);
    expect(store.getState().hasUnreadNotice).toBe(false);
  });

  it('marks the latest available notice as read even when the active list is empty', () => {
    const store = createTestSlice({
      latestNotice: newestNotice,
      notices: [],
      hasUnreadNotice: true,
    });

    store.getState().markAllAsRead();

    expect(localStorage.getItem('lastReadNoticeId')).toBe(newestNotice.id);
    expect(store.getState().hasUnreadNotice).toBe(false);
  });
});

const appState = vi.hoisted(() => ({
  latestNotice: {
    id: 'notice-new',
    title: 'Newest notice',
    content: 'Newest content',
    date: '2026-08-24T09:00:00.000Z',
    active: true,
    pinned: false,
  } as Notice | null,
  hasUnreadNotice: true,
  setNoticeModalOpen: vi.fn(),
}));

vi.mock('../../store', () => ({
  useStore: () => ({
    setSessionId: vi.fn(),
    setInput: vi.fn(),
    clearAttachments: vi.fn(),
    theme: 'light',
    toggleSidebar: vi.fn(),
    isSidebarOpen: false,
    setUserSystemPrompt: vi.fn(),
    fetchNotices: vi.fn(),
    fetchLatestNotice: vi.fn(),
    ...appState,
  }),
}));

vi.mock('../../components/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('../../components/ChatInterface', () => ({ ChatInterface: () => null }));
vi.mock('../../components/SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('../../components/NoticeModal', () => ({ NoticeModal: () => null }));

describe('App announcement auto-open', () => {
  beforeEach(() => {
    appState.latestNotice = newestNotice;
    appState.hasUnreadNotice = true;
    appState.setNoticeModalOpen.mockReset();
  });

  it('opens each unread notice at most once during the session', async () => {
    const { default: App } = await import('../../App');
    const view = render(createElement(App));

    expect(appState.setNoticeModalOpen).toHaveBeenCalledTimes(1);
    expect(appState.setNoticeModalOpen).toHaveBeenLastCalledWith(true, newestNotice);

    view.rerender(createElement(App));
    expect(appState.setNoticeModalOpen).toHaveBeenCalledTimes(1);

    appState.hasUnreadNotice = false;
    view.rerender(createElement(App));
    appState.hasUnreadNotice = true;
    view.rerender(createElement(App));
    expect(appState.setNoticeModalOpen).toHaveBeenCalledTimes(1);

    appState.latestNotice = { ...newestNotice, id: 'notice-next' };
    view.rerender(createElement(App));
    expect(appState.setNoticeModalOpen).toHaveBeenCalledTimes(2);
    expect(appState.setNoticeModalOpen).toHaveBeenLastCalledWith(true, appState.latestNotice);
  });
});
