import React, { useEffect, useRef, useState } from 'react';
import { Headphones, MessageCircle } from 'lucide-react';
import { appAssetUrl } from '../lib/base-path';

export const ContactPopover: React.FC = () => {
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
          isOpen
            ? 'bg-primary/10 border-primary/30 text-primary shadow-lg ring-4 ring-primary/5 scale-105'
            : 'bg-card border-border/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground active:scale-95'
        }`}
        title="联系客服"
      >
        <Headphones size={18} className="group-hover:-rotate-6 transition-transform" strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-72 bg-card border border-border/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden z-50">
          <div className="p-4 border-b border-border/50 flex items-center gap-2 bg-muted/20">
            <MessageCircle size={14} className="text-primary" />
            <span className="text-xs font-bold text-foreground">联系客服</span>
          </div>

          <div className="p-5 flex flex-col items-center text-center">
            <div className="w-44 h-44 rounded-2xl border border-border/60 bg-white p-2 shadow-sm">
              <img
                src={appAssetUrl('wechat.png')}
                alt="客服微信二维码"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="mt-4 text-sm font-semibold text-foreground">扫码添加客服微信</div>
            <div className="mt-1 text-xs text-muted-foreground leading-5">遇到模型、充值、文件解析等问题，可以联系人工客服处理。</div>
          </div>
        </div>
      )}
    </div>
  );
};
