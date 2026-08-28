import React, { useEffect, useRef, useState, useTransition } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { NoticeModal } from './components/NoticeModal';
import { useStore } from './store';
import { appAssetUrl } from './lib/base-path';

const VERSION_STORAGE_KEY = 'aittco_app_version_seen';

const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const currentVersionRef = useRef<string | null>(null);
  const autoOpenedNoticeIdsRef = useRef(new Set<string>());
  const [, startTransition] = useTransition();
  const {
    setSessionId,
    setInput,
    clearAttachments,
    theme,
    toggleSidebar,
    isSidebarOpen,
    setUserSystemPrompt,
    fetchNotices,
    fetchLatestNotice,
    latestNotice,
    hasUnreadNotice,
    setNoticeModalOpen,
  } = useStore();

  const handleNewChat = () => {
    startTransition(() => {
      setSessionId(null);
      setInput('');
      clearAttachments();
      setUserSystemPrompt('');
    });
  };

  const handleSelectSession = (id: string) => {
    startTransition(() => {
      setSessionId(id);
      setInput('');
      clearAttachments();
    });
  };

  const handleCloseSidebar = () => {
    if (isSidebarOpen) {
      toggleSidebar();
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    fetchNotices(1, '');
    fetchLatestNotice();
  }, [fetchNotices, fetchLatestNotice]);

  useEffect(() => {
    let cancelled = false;

    const checkVersion = async () => {
      try {
        const response = await fetch(`${appAssetUrl('app-version.json')}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const remoteVersion = typeof data?.version === 'string' ? data.version : '';
        if (!remoteVersion || cancelled) return;

        const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
        if (!currentVersionRef.current) {
          currentVersionRef.current = remoteVersion;
          if (storedVersion && storedVersion !== remoteVersion) {
            setAvailableVersion(remoteVersion);
            return;
          }
          localStorage.setItem(VERSION_STORAGE_KEY, remoteVersion);
          return;
        }

        if (currentVersionRef.current !== remoteVersion) {
          setAvailableVersion(remoteVersion);
        }
      } catch {
        // Version checks are best effort and should never block the app.
      }
    };

    checkVersion();
    const timer = window.setInterval(checkVersion, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const handleReloadForUpdate = () => {
    if (availableVersion) {
      localStorage.setItem(VERSION_STORAGE_KEY, availableVersion);
    }
    window.location.reload();
  };

  useEffect(() => {
    const poll = () => {
      fetchNotices(1, '');
      fetchLatestNotice();
    };

    const timer = window.setInterval(poll, 30000);
    return () => window.clearInterval(timer);
  }, [fetchNotices, fetchLatestNotice]);

  useEffect(() => {
    if (hasUnreadNotice && latestNotice && !autoOpenedNoticeIdsRef.current.has(latestNotice.id)) {
      autoOpenedNoticeIdsRef.current.add(latestNotice.id);
      setNoticeModalOpen(true, latestNotice);
    }
  }, [hasUnreadNotice, latestNotice, setNoticeModalOpen]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground transition-colors duration-300 relative">
      <Sidebar
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCloseSidebar={handleCloseSidebar}
      />

      <main className="flex-1 flex flex-col h-full relative z-0">
        <ChatInterface />
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <NoticeModal />

      {availableVersion && (
        <div className="fixed inset-x-0 bottom-5 z-[80] flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-2xl shadow-black/20">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">
                {'\u68c0\u6d4b\u5230\u65b0\u7248\u672c'}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {
                  '\u9879\u76ee\u5df2\u66f4\u65b0\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u7ee7\u7eed\u4f7f\u7528\u3002'
                }
              </div>
            </div>
            <button
              onClick={handleReloadForUpdate}
              className="shrink-0 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background transition hover:opacity-90"
            >
              {'\u7acb\u5373\u66f4\u65b0'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
