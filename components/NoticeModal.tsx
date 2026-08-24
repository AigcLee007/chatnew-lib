import React from 'react';
import { X, Megaphone, Check } from 'lucide-react';
import { useStore } from '../store';

export const NoticeModal: React.FC = () => {
  const { isNoticeModalOpen, currentNoticeDetail, setNoticeModalOpen } = useStore();

  if (!isNoticeModalOpen || !currentNoticeDetail) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-modal-title"
        className="w-full max-w-[450px] max-h-[calc(100vh-2rem)] flex flex-col bg-card border border-border/50 rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden scale-in-center animate-in zoom-in-95 duration-300"
      >
        {/* Header with Icon and Close */}
        <div className="relative p-6 pb-0 group">
          <button
            type="button"
            aria-label="关闭公告"
            onClick={() => setNoticeModalOpen(false, currentNoticeDetail)}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center hover:bg-muted rounded-full text-muted-foreground transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-primary/10 rounded-2xl text-primary ring-4 ring-primary/5">
              <Megaphone size={28} className="rotate-[-10deg]" />
            </div>
            <div className="pt-1">
              <h2
                id="notice-modal-title"
                className="text-xl font-bold text-foreground tracking-tight"
              >
                {currentNoticeDetail.title}
              </h2>
              <p className="text-[11px] text-muted-foreground font-mono mt-1 opacity-70">
                {currentNoticeDetail.date}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-8">
          <div className="bg-muted/30 border border-border/40 rounded-2xl p-5 min-h-[160px]">
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium">
              {currentNoticeDetail.content}
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-6 pt-2">
          <button
            type="button"
            onClick={() => setNoticeModalOpen(false, currentNoticeDetail)}
            className="w-full py-4 bg-foreground text-background font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
          >
            <Check size={18} className="group-hover:scale-110 transition-transform" />
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
