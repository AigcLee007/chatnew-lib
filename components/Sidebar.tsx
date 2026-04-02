import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Settings,
  Sidebar as SidebarIcon,
  Trash2,
  Check,
  Search,
  Download,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStore } from '../store';
import { db } from '../lib/db';
import { Session } from '../types';

interface Props {
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onOpenSettings: () => void;
  onCloseSidebar?: () => void;
}

type TimeGroup = '今天' | '昨天' | '过去7天' | '更早';

function groupSessionsByDate(sessions: Session[]): Record<TimeGroup, Session[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const last7DaysStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  const groups: Record<TimeGroup, Session[]> = {
    今天: [],
    昨天: [],
    '过去7天': [],
    更早: [],
  };

  for (const session of sessions) {
    const t = Number(session.updatedAt || 0);
    if (t >= todayStart) {
      groups['今天'].push(session);
    } else if (t >= yesterdayStart) {
      groups['昨天'].push(session);
    } else if (t >= last7DaysStart) {
      groups['过去7天'].push(session);
    } else {
      groups['更早'].push(session);
    }
  }

  return groups;
}

export const Sidebar: React.FC<Props> = ({ onNewChat, onSelectSession, onOpenSettings, onCloseSidebar }) => {
  const { currentSessionId, isSidebarOpen, toggleSidebar } = useStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const sessions = useLiveQuery(async () => {
    const all = await db.sessions.orderBy('updatedAt').reverse().toArray();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((s) => (s.title || '').toLowerCase().includes(q));
  }, [searchQuery]);

  const grouped = useMemo(() => groupSessionsByDate(sessions || []), [sessions]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  const handleSelectSession = (id: string) => {
    onSelectSession(id);
    if (isMobile && onCloseSidebar) onCloseSidebar();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    try {
      await db.sessions.delete(id);
      await db.messages.where('sessionId').equals(id).delete();
      if (currentSessionId === id) onNewChat();
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleExportMarkdown = async (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const msgs = await db.messages.where('sessionId').equals(session.id).sortBy('timestamp');
      let content = `# ${session.title}\n\nDate: ${new Date(session.updatedAt).toLocaleString()}\n\n---\n\n`;
      for (const m of msgs) {
        content += `### ${m.role.toUpperCase()}\n\n${m.content}\n\n`;
      }

      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(session.title || 'session').replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  if (!isSidebarOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200" onClick={toggleSidebar} />

      <aside className="w-[280px] fixed inset-y-0 left-0 md:relative md:inset-auto bg-background border-r border-border/50 flex flex-col shrink-0 transition-all duration-300 z-50 shadow-2xl md:shadow-none animate-in slide-in-from-left md:animate-none">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-4 pt-1">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <svg className="w-3.5 h-3.5" viewBox="0 0 28 28" fill="none">
                  <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" fill="url(#gemini-sidebar)" />
                  <defs>
                    <linearGradient id="gemini-sidebar" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#4285F4" />
                      <stop offset="0.5" stopColor="#9B72CB" />
                      <stop offset="1" stopColor="#D96570" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="text-xs font-semibold text-primary">Chat</span>
              </div>

            </div>

            <button onClick={toggleSidebar} className="md:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors">
              <SidebarIcon size={16} />
            </button>
          </div>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索对话..."
              className="w-full bg-muted/50 border border-border/60 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:bg-background transition-all"
            />
          </div>

          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 bg-foreground text-background px-3 py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-all shadow-sm group active:scale-[0.98]"
          >
            <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>新对话</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {!sessions ? (
            <div className="p-4 text-[10px] text-muted-foreground font-mono">加载中...</div>
          ) : sessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground opacity-30">
              <span className="text-[10px]">{searchQuery ? '无匹配结果' : '空'}</span>
            </div>
          ) : searchQuery ? (
            <>
              <div className="px-2 mb-3 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">搜索结果</div>
              {sessions.map((session) => {
                const isConfirming = confirmDeleteId === session.id;
                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 gap-2 ${
                      currentSessionId === session.id
                        ? 'bg-muted text-foreground font-medium shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <span className={`text-xs truncate flex-1 opacity-90 select-none transition-all ${isConfirming ? 'text-red-500 font-bold' : ''}`}>
                      {isConfirming ? '确认删除吗？' : session.title}
                    </span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isConfirming && (
                        <button
                          onClick={(e) => handleExportMarkdown(e, session)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-md transition-colors"
                          title="导出为 Markdown"
                        >
                          <Download size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(e, session.id)}
                        className={`relative z-20 shrink-0 p-1.5 rounded-md transition-all duration-200 ${
                          isConfirming
                            ? 'bg-red-500 text-white opacity-100 scale-110 shadow-md ml-2'
                            : 'text-muted-foreground hover:text-red-500 hover:bg-background/80'
                        }`}
                        title={isConfirming ? '点击确认删除' : '删除对话'}
                      >
                        {isConfirming ? <Check size={12} /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            (['今天', '昨天', '过去7天', '更早'] as TimeGroup[]).map((groupName) => {
              const rows = grouped[groupName];
              if (!rows.length) return null;

              return (
                <div key={groupName} className="mb-4">
                  <div className="px-2 mb-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">{groupName}</div>
                  {rows.map((session) => {
                    const isConfirming = confirmDeleteId === session.id;
                    return (
                      <div
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 gap-2 ${
                          currentSessionId === session.id
                            ? 'bg-muted text-foreground font-medium shadow-sm'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <span className={`text-xs truncate flex-1 opacity-90 select-none transition-all ${isConfirming ? 'text-red-500 font-bold' : ''}`}>
                          {isConfirming ? '确认删除吗？' : session.title}
                        </span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isConfirming && (
                            <button
                              onClick={(e) => handleExportMarkdown(e, session)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-md transition-colors"
                              title="导出为 Markdown"
                            >
                              <Download size={12} />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDelete(e, session.id)}
                            className={`relative z-20 shrink-0 p-1.5 rounded-md transition-all duration-200 ${
                              isConfirming
                                ? 'bg-red-500 text-white opacity-100 scale-110 shadow-md ml-2'
                                : 'text-muted-foreground hover:text-red-500 hover:bg-background/80'
                            }`}
                            title={isConfirming ? '点击确认删除' : '删除对话'}
                          >
                            {isConfirming ? <Check size={12} /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-border/50 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            aria-label="settings-button"
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
          >
            <Settings size={14} />
            <span>偏好设置 & 数据</span>
          </button>
        </div>
      </aside>
    </>
  );
};
