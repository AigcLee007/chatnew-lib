import React, { useState } from 'react';
import { HoverCard, HoverCardContent, HoverCardPortal, HoverCardTrigger } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export type ToolHelpId = 'fileSearch' | 'skills' | 'memory' | 'runCode' | 'artifacts';

type ToolHelpProps = {
  id: ToolHelpId;
  children: React.ReactNode;
  className?: string;
};

const ToolHelp = ({ id, children, className }: ToolHelpProps) => {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const prefix = `com_ui_tool_help_${id}`;
  const text = (suffix: 'title' | 'what' | 'benefit' | 'how' | 'example') =>
    localize(`${prefix}_${suffix}` as Parameters<typeof localize>[0]);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>
        <div
          className={cn('min-w-0 flex-1', className)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={10}
          className="z-[999] max-h-[min(28rem,calc(100vh-2rem))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-4"
        >
          <div className="space-y-3 text-left">
            <h3 className="text-sm font-semibold text-text-primary">{text('title')}</h3>
            <section>
              <h4 className="text-xs font-medium text-text-secondary">
                {localize('com_ui_tool_help_what')}
              </h4>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{text('what')}</p>
            </section>
            <section>
              <h4 className="text-xs font-medium text-text-secondary">
                {localize('com_ui_tool_help_benefit')}
              </h4>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{text('benefit')}</p>
            </section>
            <section>
              <h4 className="text-xs font-medium text-text-secondary">
                {localize('com_ui_tool_help_how')}
              </h4>
              <p className="mt-1 whitespace-pre-line text-xs leading-5 text-text-secondary">
                {text('how')}
              </p>
            </section>
            <p className="rounded-md bg-surface-hover px-2.5 py-2 font-mono text-xs leading-5 text-text-primary">
              {text('example')}
            </p>
          </div>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
};

export default React.memo(ToolHelp);
