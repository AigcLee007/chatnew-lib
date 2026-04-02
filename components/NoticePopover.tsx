import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Megaphone, Trash2, X } from 'lucide-react';
import { useStore } from '../store';

export const NoticePopover: React.FC = () => {
    const { notices, hasUnreadNotice, setNoticeModalOpen, markAllAsRead } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative pointer-events-auto" ref={popoverRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-xl border transition-all duration-300 relative group ${
                    isOpen ? 'bg-primary/10 border-primary/30 text-primary shadow-lg ring-4 ring-primary/5 scale-105' : 'bg-card border-border/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground active:scale-95'
                }`}
                title="通知中心"
            >
                <Bell size={18} className={`${hasUnreadNotice ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'}`} strokeWidth={2} />
                {hasUnreadNotice && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-background rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-3 w-80 bg-card border border-border/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden z-50">
                    {/* Header */}
                    <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/20">
                        <div className="flex items-center gap-2">
                             <Megaphone size={14} className="text-primary" />
                             <span className="text-xs font-bold text-foreground">通知公告中心</span>
                        </div>
                        <button 
                            onClick={markAllAsRead}
                            className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/5"
                        >
                            <CheckCheck size={12} />
                            标注已读
                        </button>
                    </div>

                    {/* List */}
                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                        {notices.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center opacity-40">
                                <Bell size={32} className="mb-2" />
                                <span className="text-[10px]">当前暂无全站公告</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {notices.map(n => (
                                    <button 
                                        key={n.id}
                                        onClick={() => {
                                            setNoticeModalOpen(true, n);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full p-4 text-left hover:bg-muted/40 transition-colors group flex flex-col gap-1.5 relative overflow-hidden ${n.pinned ? 'bg-primary/5 border-l-2 border-primary/40' : ''}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 flex items-center gap-1.5">
                                                {n.pinned && <Megaphone size={10} className="text-primary fill-primary/20" />}
                                                {n.title}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground font-mono shrink-0">{new Date(n.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed opacity-80">{n.content}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 text-center border-t border-border/50 bg-muted/10 opacity-60">
                        <span className="text-[9px] text-muted-foreground">© Aittco Notification System</span>
                    </div>
                </div>
            )}
        </div>
    );
};
