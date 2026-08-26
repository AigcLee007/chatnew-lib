import React from 'react';

type ProviderIconProps = { group: string; className?: string };

function GrokLogo({ className = '', size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M6.469 8.776 16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9 2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z" />
    </svg>
  );
}

function ProviderIcon({ group, className = 'size-5' }: ProviderIconProps) {
  if (group === 'GEMINI') {
    return <img src="/assets/google.svg" alt="" aria-hidden="true" className={className} />;
  }
  if (group === 'OPENAI') {
    return <img src="/assets/openai.svg" alt="" aria-hidden="true" className={className} />;
  }
  if (group === 'ANTHROPIC') {
    return <img src="/assets/claude-ai-icon.svg" alt="" aria-hidden="true" className={className} />;
  }
  if (group === 'GROK') {
    return <GrokLogo className={className} size={20} />;
  }
  return (
    <span className="flex size-5 items-center justify-center text-xs font-semibold">
      {group.slice(0, 1)}
    </span>
  );
}

export default ProviderIcon;
