import { StateCreator } from 'zustand';
import { Attachment } from '../../types';

export interface ChatSlice {
  currentSessionId: string | null;
  isSidebarOpen: boolean;
  isLoading: boolean;
  attachments: Attachment[];
  input: string;
  isWebSearchEnabled: boolean;

  setSessionId: (id: string | null) => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  setInput: (input: string | ((prev: string) => string)) => void;
  addAttachment: (file: Attachment) => void;
  removeAttachment: (id: string) => void;
  toggleAttachmentInclusion: (id: string) => void;
  clearAttachments: () => void;
  toggleWebSearch: () => void;
  setWebSearchEnabled: (enabled: boolean) => void;
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  currentSessionId: null,
  isSidebarOpen: true,
  isLoading: false,
  attachments: [],
  input: '',
  isWebSearchEnabled:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('aittco_web_search') === 'true'
      : false,

  setSessionId: (id) =>
    set({
      currentSessionId: id,
      input: '',
      attachments: [],
    }),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setLoading: (loading) => set({ isLoading: loading }),

  setInput: (val) =>
    set((state) => ({
      input: typeof val === 'function' ? val(state.input) : val,
    })),

  addAttachment: (att) =>
    set((state) => ({
      attachments: [...state.attachments, { ...att, included: true }],
    })),

  removeAttachment: (id) =>
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
    })),

  toggleAttachmentInclusion: (id) =>
    set((state) => ({
      attachments: state.attachments.map((a) =>
        a.id === id ? { ...a, included: !a.included } : a
      ),
    })),

  clearAttachments: () => set({ attachments: [] }),

  toggleWebSearch: () =>
    set((state) => {
      const next = !state.isWebSearchEnabled;
      localStorage.setItem('aittco_web_search', String(next));
      return { isWebSearchEnabled: next };
    }),

  setWebSearchEnabled: (enabled) =>
    set(() => {
      localStorage.setItem('aittco_web_search', String(enabled));
      return { isWebSearchEnabled: enabled };
    }),
});
