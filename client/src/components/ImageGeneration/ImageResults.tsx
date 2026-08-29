import { Button, IconButton } from '@librechat/client';
import { Clipboard, Download, Pencil, Trash2 } from 'lucide-react';
import type { ImageGenerationResult } from 'librechat-data-provider';
import { triggerDownload } from '~/utils';
import { useEffect, useState } from 'react';
import { useLocalize } from '~/hooks';

const imageSource = (image: ImageGenerationResult): string =>
  image.data.startsWith('data:') || /^(?:blob:|https?:\/\/)/i.test(image.data)
    ? image.data
    : `data:${image.mimeType};base64,${image.data}`;

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
  images: ImageGenerationResult[];
  onDelete: (index: number) => void;
  onContinueEditing: (image: ImageGenerationResult) => void;
}

export default function ImageResults({ images, onDelete, onContinueEditing }: ImageResultsProps) {
  const localize = useLocalize();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (previewIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewIndex(null);
      if (event.key === 'ArrowRight') setPreviewIndex((index) => (index === null ? 0 : (index + 1) % images.length));
      if (event.key === 'ArrowLeft') setPreviewIndex((index) => (index === null ? 0 : (index - 1 + images.length) % images.length));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewIndex, images.length]);

  if (images.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-border-light p-6 text-sm text-text-secondary">
        {localize('com_ui_image_generation_empty_results')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {images.map((image, index) => {
        const source = imageSource(image);
        return (
          <article
            key={`${image.index}-${index}`}
            className="overflow-hidden rounded-lg border border-border-light bg-surface-secondary"
          >
            <img
              src={source}
              alt={`${localize('com_ui_image_generation_result')} ${index + 1}`}
              className="aspect-square w-full cursor-zoom-in object-cover"
              onClick={() => setPreviewIndex(index)}
            />
            <div className="flex items-center justify-between gap-2 p-2">
              <div className="flex items-center gap-1">
                <IconButton
                  label={localize('com_ui_download')}
                  size="sm"
                  shape="square"
                  title={localize('com_ui_download')}
                  onClick={() => triggerDownload(source, `generated-image-${index + 1}.png`)}
                >
                  <Download className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={localize('com_ui_image_generation_copy_image')}
                  size="sm"
                  shape="square"
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
                  title={localize('com_ui_delete')}
                  onClick={() => onDelete(index)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
              <Button variant="outline" size="sm" onClick={() => onContinueEditing(image)}>
                <Pencil className="size-4" aria-hidden="true" />
                {localize('com_ui_image_generation_continue_editing')}
              </Button>
            </div>
          </article>
        );
      })}
      {previewIndex !== null && images[previewIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={localize('com_ui_image_generation_preview')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewIndex(null)}
        >
          <img
            src={imageSource(images[previewIndex])}
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
