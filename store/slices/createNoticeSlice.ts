import { StateCreator } from 'zustand';
import { StoreState } from '../index';
import { Notice, NoticeListResponse } from '../../types';

export interface NoticeSlice {
  // --- Admin State ---
  adminNotices: Notice[];
  adminTotal: number;
  adminPage: number;
  adminPageSize: number;
  adminSearch: string;
  isAdminLoading: boolean;

  // --- Display State ---
  notices: Notice[]; // active ones for users
  latestNotice: Notice | null;
  hasUnreadNotice: boolean;
  isNoticeModalOpen: boolean;
  currentNoticeDetail: Notice | null;

  // --- Actions ---
  fetchNotices: (page?: number, search?: string) => Promise<void>;
  fetchLatestNotice: () => Promise<void>;
  publishNotice: (
    title: string,
    content: string,
    active: boolean,
    pinned: boolean,
  ) => Promise<void>;
  updateNotice: (id: string, updates: Partial<Notice>) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  setAdminPage: (page: number) => void;
  setAdminSearch: (search: string) => void;
  setNoticeModalOpen: (isOpen: boolean, notice?: Notice) => void;
  markAllAsRead: () => void;
}

const ADMIN_KEY = 'sk-K9OJf52OughwT8vizrDKJpvMebzutpbKVXxxhYe8EZFF0nm7';

export const createNoticeSlice: StateCreator<StoreState, [], [], NoticeSlice> = (set, get) => ({
  adminNotices: [],
  adminTotal: 0,
  adminPage: 1,
  adminPageSize: 8,
  adminSearch: '',
  isAdminLoading: false,

  notices: [],
  latestNotice: null,
  hasUnreadNotice: false,
  isNoticeModalOpen: false,
  currentNoticeDetail: null,

  fetchNotices: async (page = 1, search = '') => {
    const { apiKey } = get();
    const isAdmin = apiKey === ADMIN_KEY;
    const url = isAdmin
      ? `/api/announcements?all=1&page=${page}&search=${encodeURIComponent(search)}`
      : `/api/announcements?page=${page}&search=${encodeURIComponent(search)}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isAdmin) headers['Authorization'] = `Bearer ${ADMIN_KEY}`;

    try {
      if (isAdmin) set({ isAdminLoading: true });
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(res.status === 401 ? '管理员 API Key 无效' : '加载失败');

      const data: NoticeListResponse = await res.json();
      const visibleNotices = isAdmin ? data.items.filter((n) => n.active) : data.items;
      const lastReadId = localStorage.getItem('lastReadNoticeId');
      const newestVisible = visibleNotices[0];

      if (isAdmin) {
        set({
          adminNotices: data.items,
          adminTotal: data.total,
          adminPage: data.page,
          notices: visibleNotices,
          isAdminLoading: false,
        });
      } else {
        set({
          notices: visibleNotices,
          latestNotice: newestVisible || null,
          hasUnreadNotice: newestVisible ? newestVisible.id !== lastReadId : false,
        });
      }
    } catch (err) {
      console.error(err);
      if (isAdmin) set({ isAdminLoading: false });
    }
  },

  fetchLatestNotice: async () => {
    try {
      const res = await fetch('/api/announcement');
      if (!res.ok) throw new Error('加载失败');
      const data: Notice | null = await res.json();
      const lastReadId = localStorage.getItem('lastReadNoticeId');
      set({
        latestNotice: data,
        hasUnreadNotice: data ? data.id !== lastReadId : false,
      });
    } catch (err) {
      console.error(err);
    }
  },

  publishNotice: async (title, content, active, pinned) => {
    const { fetchNotices, adminPage, adminSearch } = get();
    const res = await fetch('/api/announcement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_KEY}`,
      },
      body: JSON.stringify({ title, content, active, pinned }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || '发布失败');
    }
    await fetchNotices(adminPage, adminSearch);
  },

  updateNotice: async (id, updates) => {
    const { fetchNotices, adminPage, adminSearch } = get();
    const res = await fetch(`/api/announcement/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_KEY}`,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || '更新失败');
    }
    await fetchNotices(adminPage, adminSearch);
  },

  deleteNotice: async (id) => {
    const { fetchNotices, adminPage, adminSearch } = get();
    const res = await fetch(`/api/announcement/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ADMIN_KEY}`,
      },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || '删除失败');
    }
    await fetchNotices(adminPage, adminSearch);
  },

  setAdminPage: (page) => {
    set({ adminPage: page });
    get().fetchNotices(page, get().adminSearch);
  },

  setAdminSearch: (search) => {
    set({ adminSearch: search, adminPage: 1 });
    get().fetchNotices(1, search);
  },

  setNoticeModalOpen: (isOpen, notice) => {
    set({ isNoticeModalOpen: isOpen, currentNoticeDetail: notice || null });
    if (!isOpen && notice) {
      localStorage.setItem('lastReadNoticeId', notice.id);
      set({ hasUnreadNotice: false });
    }
  },

  markAllAsRead: () => {
    const { latestNotice, notices } = get();
    const latestAvailableNotice = latestNotice || notices[0];
    if (latestAvailableNotice) {
      localStorage.setItem('lastReadNoticeId', latestAvailableNotice.id);
      set({ hasUnreadNotice: false });
    }
  },
});
