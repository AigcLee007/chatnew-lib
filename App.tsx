
import React, { useState, useEffect, useTransition } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { NoticeModal } from './components/NoticeModal';
import { useStore } from './store';

const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { 
    setSessionId, setInput, clearAttachments, theme, toggleSidebar, isSidebarOpen, setUserSystemPrompt,
    fetchNotices, fetchLatestNotice, latestNotice, hasUnreadNotice, setNoticeModalOpen
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

  // 关闭侧边栏（移动端用）
  const handleCloseSidebar = () => {
    if (isSidebarOpen) {
      toggleSidebar();
    }
  };

  // Sync theme with DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Load announcements for notification center and unread badge.
  useEffect(() => {
    fetchNotices(1, '');
    fetchLatestNotice();
  }, [fetchNotices, fetchLatestNotice]);

  // Poll announcements every 30s so new notices appear without page refresh.
  useEffect(() => {
    const poll = () => {
      fetchNotices(1, '');
      fetchLatestNotice();
    };

    const timer = window.setInterval(poll, 30000);
    return () => window.clearInterval(timer);
  }, [fetchNotices, fetchLatestNotice]);

  // Show modal once when there is a new unread latest announcement.
  useEffect(() => {
    if (hasUnreadNotice && latestNotice) {
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

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      {/* 全局公告弹窗 */}
      <NoticeModal />
    </div>
  );
};

export default App;
