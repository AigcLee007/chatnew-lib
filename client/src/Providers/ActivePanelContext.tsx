import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useRecoilState } from 'recoil';
import store from '~/store';
export const DEFAULT_PANEL = 'conversations';

interface ActivePanelContextType {
  active: string;
  setActive: (id: string) => void;
}

const ActivePanelContext = createContext<ActivePanelContextType | undefined>(undefined);

export function ActivePanelProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useRecoilState(store.activePanel);

  const value = useMemo(() => ({ active, setActive }), [active, setActive]);

  return <ActivePanelContext.Provider value={value}>{children}</ActivePanelContext.Provider>;
}

export function useActivePanel() {
  const context = useContext(ActivePanelContext);
  if (context === undefined) {
    throw new Error('useActivePanel must be used within an ActivePanelProvider');
  }
  return context;
}

/** Returns `active` when it matches a known link, otherwise the first link's id. */
export function resolveActivePanel(active: string, links: { id: string }[]): string {
  if (links.length > 0 && links.some((l) => l.id === active)) {
    return active;
  }
  return links[0]?.id ?? active;
}
