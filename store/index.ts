import { create } from 'zustand';
import { createSettingsSlice, SettingsSlice } from './slices/createSettingsSlice';
import { createChatSlice, ChatSlice } from './slices/createChatSlice';
import { createNoticeSlice, NoticeSlice } from './slices/createNoticeSlice';

// Combined store type
export type StoreState = SettingsSlice & ChatSlice & NoticeSlice;

// Create the combined store
export const useStore = create<StoreState>()((...args) => ({
  ...createSettingsSlice(...args),
  ...createChatSlice(...args),
  ...createNoticeSlice(...args),
}));

// Re-export slice types for convenience
export type { SettingsSlice } from './slices/createSettingsSlice';
export type { ChatSlice } from './slices/createChatSlice';
export type { Theme } from './slices/createSettingsSlice';
