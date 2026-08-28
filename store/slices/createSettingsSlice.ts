import { StateCreator } from 'zustand';
import { ModelId, Prompt, WorkMode } from '../../types';

export type Theme = 'light' | 'dark';

const now = Date.now();
const DEFAULT_PROMPTS: Prompt[] = [
  {
    id: '1',
    title: '代码专家',
    content: '你是一名资深全栈工程师，请帮我审查这段代码，指出潜在的性能问题、安全漏洞，并提供优化后的代码版本。',
    createdAt: now,
  },
  {
    id: '2',
    title: '文案润色',
    content: '请将下面内容润色成更专业、自然、简洁的表达，保留原意并优化结构。',
    createdAt: now + 1,
  },
  {
    id: '3',
    title: '英语翻译',
    content: '你是一名专业翻译，请把下面中文翻译成地道的英文，并给出两种风格版本：正式版与口语版。',
    createdAt: now + 2,
  },
  {
    id: '4',
    title: '周报生成',
    content: '请根据以下工作内容整理一份结构清晰的周报，包含本周完成事项、问题与风险、下周计划。',
    createdAt: now + 3,
  },
  {
    id: '5',
    title: '海报设计',
    content: '请帮我生成可直接用于图像模型的海报提示词，包含主题、视觉风格、色彩、构图、文案与尺寸。',
    createdAt: now + 4,
  },
  {
    id: '6',
    title: '各种角色',
    content: '请先询问我想要的角色设定，然后根据角色身份与语气风格输出对应的回复。',
    createdAt: now + 5,
  },
];

export interface SettingsSlice {
  apiKey: string;
  defaultModel: ModelId;
  userSystemPrompt: string;
  workMode: WorkMode;
  theme: Theme;
  prompts: Prompt[];

  setApiKey: (key: string) => void;
  setModel: (model: ModelId) => void;
  setUserSystemPrompt: (prompt: string) => void;
  setWorkMode: (mode: WorkMode) => void;
  toggleTheme: () => void;
  addPrompt: (prompt: Prompt) => void;
  removePrompt: (id: string) => void;
  updatePrompt: (id: string, updates: Partial<Prompt>) => void;
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  apiKey:
    typeof localStorage !== 'undefined' ? localStorage.getItem('aittco_api_key') || '' : '',
  defaultModel:
    typeof localStorage !== 'undefined'
      ? (() => {
          const storedModel = localStorage.getItem('aittco_model');
          if (storedModel === 'gemini-3.1-flash-preview') return 'gemini-3.5-flash-preview';
          if (storedModel === 'gpt-5.2-all') return 'gpt-5.4';
          if (storedModel === 'gpt-5.2-thinking' || storedModel === 'gpt-5.3-codex') return 'gpt-5.5';
          if (storedModel === 'gemini-2.5-flash-image') return 'gpt-image-2';
          return (storedModel as ModelId) || 'gemini-3.5-flash-preview';
        })()
      : 'gemini-3.5-flash-preview',
  userSystemPrompt:
    typeof localStorage !== 'undefined' ? localStorage.getItem('aittco_system_prompt') || '' : '',
  workMode:
    typeof localStorage !== 'undefined'
      ? ((localStorage.getItem('aittco_work_mode') as WorkMode) || 'chat')
      : 'chat',
  theme:
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem('aittco_theme') as Theme) || 'dark'
      : 'dark',
  prompts: (() => {
    if (typeof localStorage === 'undefined') return DEFAULT_PROMPTS;
    const stored = localStorage.getItem('aittco_prompts');
    if (!stored) return DEFAULT_PROMPTS;

    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROMPTS;
    } catch {
      return DEFAULT_PROMPTS;
    }
  })(),

  setApiKey: (key) => {
    localStorage.setItem('aittco_api_key', key);
    set({ apiKey: key });
  },

  setModel: (model) => {
    const migratedModel = model === ('gemini-3.1-flash-preview' as ModelId)
      ? 'gemini-3.5-flash-preview'
      : model === ('gpt-5.2-all' as ModelId)
      ? 'gpt-5.4'
      : model === ('gpt-5.2-thinking' as ModelId) || model === ('gpt-5.3-codex' as ModelId)
      ? 'gpt-5.5'
      : model === ('gemini-2.5-flash-image' as ModelId)
      ? 'gpt-image-2'
      : model;
    localStorage.setItem('aittco_model', migratedModel);
    set({ defaultModel: migratedModel });
  },

  setUserSystemPrompt: (prompt) => {
    localStorage.setItem('aittco_system_prompt', prompt);
    set({ userSystemPrompt: prompt });
  },

  setWorkMode: (mode) => {
    localStorage.setItem('aittco_work_mode', mode);
    set({ workMode: mode });
  },

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('aittco_theme', newTheme);
      return { theme: newTheme };
    }),

  addPrompt: (prompt) =>
    set((state) => {
      const newPrompts = [...state.prompts, prompt];
      localStorage.setItem('aittco_prompts', JSON.stringify(newPrompts));
      return { prompts: newPrompts };
    }),

  removePrompt: (id) =>
    set((state) => {
      const newPrompts = state.prompts.filter((p) => p.id !== id);
      localStorage.setItem('aittco_prompts', JSON.stringify(newPrompts));
      return { prompts: newPrompts };
    }),

  updatePrompt: (id, updates) =>
    set((state) => {
      const newPrompts = state.prompts.map((p) => (p.id === id ? { ...p, ...updates } : p));
      localStorage.setItem('aittco_prompts', JSON.stringify(newPrompts));
      return { prompts: newPrompts };
    }),
});
