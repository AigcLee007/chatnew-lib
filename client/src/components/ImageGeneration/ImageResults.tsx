import { IconButton } from '@librechat/client';
import { Clipboard, Download, FileText, Pencil, Trash2 } from 'lucide-react';
import type { ImageGenerationResult } from 'librechat-data-provider';
import { triggerDownload } from '~/utils';
import { useEffect, useState } from 'react';
import { useLocalize } from '~/hooks';

const imageSource = (image: ImageGenerationResult): string =>
  image.data.startsWith('data:') || /^(?:blob:|https?:\/\/)/i.test(image.data)
    ? image.data
    : `data:${image.mimeType};base64,${image.data}`;

const modelLabels: Record<string, string> = {
  'gemini-3-pro-image-preview': 'Gemini Pro Image',
  'gemini-3.1-flash-image-preview': 'Gemini Flash Image',
  'gpt-image-2': 'GPT Image 2',
};

async function copyImage(source: string, mimeType: string): Promise<void> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const response = await fetch(source);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
    return;
  }
  await navigator.clipboard?.writeText(source);
}

interface ImageResultsProps {
  items: ImageResultItem[];
  onDelete: (index: number) => void;
  onContinueEditing: (image: ImageGenerationResult) => void;
  layout?: 'grid' | 'waterfall';
}

export interface ImageResultItem {
  image: ImageGenerationResult;
  model: string;
  prompt: string;
  createdAt: number;
}

export default function ImageResults({ items, onDelete, onContinueEditing, layout = 'grid' }: ImageResultsProps) {
  const localize = useLocalize();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

  useEffect(() => {
    if (previewIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewIndex(null);
      if (event.key === 'ArrowRight') setPreviewIndex((index) => (index === null ? 0 : (index + 1) % items.length));
      if (event.key === 'ArrowLeft') setPreviewIndex((index) => (index === null ? 0 : (index - 1 + items.length) % items.length));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewIndex, items.length]);

  if (items.length === 0) {
    return (
      <div className={layout === 'waterfall' ? 'columns-1 gap-4 sm:columns-2 lg:columns-4' : ''}>
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-border-light p-6 text-sm text-text-secondary">
        {localize('com_ui_image_generation_empty_results')}
        </div>
      </div>
    );
  }

  return (
    <div className={layout === 'waterfall' ? 'columns-1 gap-4 sm:columns-2 lg:columns-4' : 'grid grid-cols-1 gap-4 sm:grid-cols-2'}>
      {items.map(({ image, model, prompt, createdAt }, index) => {
        const source = imageSource(image);
        return (
          <article
            key={`${image.index}-${index}`}
            className={layout === 'waterfall' ? 'group relative mb-4 break-inside-avoid overflow-hidden rounded-lg border border-border-light bg-surface-secondary' : 'group relative overflow-hidden rounded-lg border border-border-light bg-surface-secondary'}
          >
            <div className="pointer-events-none absolute right-1 top-0.5 z-10 text-right text-[10px] font-medium tracking-normal text-white/65 opacity-0 drop-shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:right-1.5 sm:top-1">
              {modelLabels[model] ?? model}
            </div>
            <div className="pointer-events-none absolute bottom-0 right-1 z-10 max-w-[38%] truncate text-right text-[10px] font-medium tracking-normal text-white/60 opacity-0 drop-shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:bottom-0.5 sm:right-1.5">
              {new Date(createdAt).toLocaleString()}
            </div>
            <img
              src={source}
              alt={`${localize('com_ui_image_generation_result')} ${index + 1}`}
              className="w-full cursor-zoom-in object-contain"
              onClick={() => setPreviewIndex(index)}
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setPreviewIndex(index); }}
            />
            <div className="absolute bottom-4 left-1/2 z-20 flex max-w-[78%] -translate-x-1/2 items-center justify-center gap-1.5 overflow-x-auto opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <IconButton
                  label={localize('com_ui_download')}
                  size="sm"
                  shape="square"
                  className="rounded-full bg-black/35 text-white shadow-sm backdrop-blur-sm hover:bg-black/55"
                  title={localize('com_ui_download')}
                  onClick={() => triggerDownload(source, `generated-image-${index + 1}.png`)}
                >
                  <Download className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={localize('com_ui_image_generation_copy_image')}
                  size="sm"
                  shape="square"
                  className="rounded-full bg-black/35 text-white shadow-sm backdrop-blur-sm hover:bg-black/55"
                  title={localize('com_ui_image_generation_copy_image')}
                  onClick={() =>
                    void copyImage(source, image.mimeType).then(() => {
                      setCopiedIndex(index);
                      window.setTimeout(() => setCopiedIndex(null), 1600);
                    })
                  }
                >
                  <Clipboard className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={localize('com_ui_image_generation_copy_prompt')}
                  size="sm"
                  shape="square"
                  className="rounded-full bg-black/35 text-white shadow-sm backdrop-blur-sm hover:bg-black/55"
                  title={localize('com_ui_image_generation_copy_prompt')}
                  onClick={() => {
                    const copy = navigator.clipboard?.writeText(prompt);
                    if (copy) {
                      void copy.then(() => {
                        setCopiedPromptIndex(index);
                        window.setTimeout(() => setCopiedPromptIndex(null), 1600);
                      });
                    }
                  }}
                >
                  <FileText className="size-4" aria-hidden="true" />
                </IconButton>
                {copiedIndex === index && (
                  <span className="text-xs text-text-secondary" role="status">
                    {localize('com_ui_image_generation_copied')}
                  </span>
                )}
                <IconButton
                  label={localize('com_ui_delete')}
                  variant="destructive"
                  size="sm"
                  shape="square"
                  className="rounded-full bg-red-600/90 text-white shadow-sm backdrop-blur-sm hover:bg-red-600"
                  title={localize('com_ui_delete')}
                  onClick={() => onDelete(index)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={localize('com_ui_image_generation_continue_editing')}
                  size="sm"
                  shape="square"
                  className="rounded-full bg-black/35 text-white shadow-sm backdrop-blur-sm hover:bg-black/55"
                  title={localize('com_ui_image_generation_continue_editing')}
                  onClick={() => onContinueEditing(image)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </IconButton>
                {copiedPromptIndex === index && (
                  <span className="sr-only" role="status">
                    {localize('com_ui_image_generation_prompt_copied')}
                  </span>
                )}
            </div>
          </article>
        );
      })}
      {previewIndex !== null && items[previewIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={localize('com_ui_image_generation_preview')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewIndex(null)}
        >
          <img
            src={imageSource(items[previewIndex].image)}
            alt={`${localize('com_ui_image_generation_result')} ${previewIndex + 1}`}
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            aria-label={localize('com_ui_close')}
            className="absolute right-4 top-4 text-2xl text-white"
            onClick={() => setPreviewIndex(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
