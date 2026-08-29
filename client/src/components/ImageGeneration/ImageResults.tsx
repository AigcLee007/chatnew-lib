import { Button, IconButton } from '@librechat/client';
import { Clipboard, Download, Pencil, Trash2 } from 'lucide-react';
import type { ImageResult } from 'librechat-data-provider';
import { triggerDownload } from '~/utils';
import { useLocalize } from '~/hooks';

const imageSource = (image: ImageResult): string =>
  image.data.startsWith('data:') || /^https?:\/\//i.test(image.data)
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
  images: ImageResult[];
  onDelete: (index: number) => void;
  onContinueEditing: (image: ImageResult) => void;
}

export default function ImageResults({ images, onDelete, onContinueEditing }: ImageResultsProps) {
  const localize = useLocalize();

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
              className="aspect-square w-full object-cover"
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
                  label={localize('com_ui_copy')}
                  size="sm"
                  shape="square"
                  title={localize('com_ui_copy')}
                  onClick={() => void copyImage(source, image.mimeType)}
                >
                  <Clipboard className="size-4" aria-hidden="true" />
                </IconButton>
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
    </div>
  );
}
