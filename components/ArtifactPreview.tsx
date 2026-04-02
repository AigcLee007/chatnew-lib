import React from 'react';

interface Props {
  code: string;
  language: string;
}

export const ArtifactPreview: React.FC<Props> = ({ code, language }) => {
  if (language !== 'html') return null;

  return (
    <div className="w-full h-[400px] border border-border rounded-b-xl overflow-hidden bg-white">
      <iframe
        className="w-full h-full"
        sandbox="allow-scripts"
        srcDoc={code}
        title="preview"
      />
    </div>
  );
};