import { useRef } from 'react';
import { Button, IconButton, Label, Textarea } from '@librechat/client';
import { IMAGE_ASPECT_RATIOS, IMAGE_MODELS, IMAGE_RESOLUTIONS } from 'librechat-data-provider';
import type {
  ImageAspectRatio,
  ImageCount,
  ImageModel,
  ImageResolution,
} from 'librechat-data-provider';
import { ImagePlus, Plus, X } from 'lucide-react';
import type { ReferenceUpload } from './types';
import { useLocalize } from '~/hooks';

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface ImageInputProps {
  prompt: string;
  model: ImageModel;
  size: ImageAspectRatio;
  resolution: ImageResolution;
  count: ImageCount;
  references: ReferenceUpload[];
  disabled: boolean;
  onPromptChange: (prompt: string) => void;
  onModelChange: (model: ImageModel) => void;
  onSizeChange: (size: ImageAspectRatio) => void;
  onResolutionChange: (resolution: ImageResolution) => void;
  onCountChange: (count: ImageCount) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveReference: (id: string) => void;
  onReorderReferences: (sourceId: string, targetId: string) => void;
  onUploadError: (message: string) => void;
}

export default function ImageInput({
  prompt,
  model,
  size,
  resolution,
  count,
  references,
  disabled,
  onPromptChange,
  onModelChange,
  onSizeChange,
  onResolutionChange,
  onCountChange,
  onAddFiles,
  onRemoveReference,
  onReorderReferences,
  onUploadError,
}: ImageInputProps) {
  const localize = useLocalize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draggedReferenceId = useRef<string | null>(null);

  const addFiles = (files: File[]) => {
    const valid = files.filter((file) => allowedImageTypes.has(file.type));
    if (valid.length === 0) {
      onUploadError(localize('com_ui_image_generation_upload_error'));
      return;
    }
    const remaining = 5 - references.length;
    if (valid.length > remaining) {
      onUploadError(localize('com_ui_image_generation_reference_limit'));
    }
    if (remaining > 0) {
      onAddFiles(valid.slice(0, remaining));
    }
  };

  return (
    <section
      className="flex min-w-0 flex-col gap-5"
      aria-label={localize('com_ui_image_generation')}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-2 text-sm text-text-primary">
          <span>{localize('com_ui_image_generation_model')}</span>
          <select
            value={model}
            disabled={disabled}
            className="lc-field h-10 rounded-lg border border-border-light bg-transparent px-3 text-sm text-text-primary focus-visible:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => onModelChange(event.target.value as ImageModel)}
          >
            {IMAGE_MODELS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm text-text-primary">
          <span>{localize('com_ui_image_generation_aspect_ratio')}</span>
          <select
            value={size}
            disabled={disabled}
            className="lc-field h-10 rounded-lg border border-border-light bg-transparent px-3 text-sm text-text-primary focus-visible:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => onSizeChange(event.target.value as ImageAspectRatio)}
          >
            {IMAGE_ASPECT_RATIOS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm text-text-primary">
          <span>{localize('com_ui_image_generation_resolution')}</span>
          <select
            value={resolution}
            disabled={disabled}
            className="lc-field h-10 rounded-lg border border-border-light bg-transparent px-3 text-sm text-text-primary focus-visible:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => onResolutionChange(event.target.value as ImageResolution)}
          >
            {IMAGE_RESOLUTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm text-text-primary">
          <span>{localize('com_ui_image_generation_count')}</span>
          <select
            value={count}
            disabled={disabled}
            className="lc-field h-10 rounded-lg border border-border-light bg-transparent px-3 text-sm text-text-primary focus-visible:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => onCountChange(Number(event.target.value) as ImageCount)}
          >
            {[1, 2, 3, 4].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="image-generation-reference-upload">
            {localize('com_ui_image_generation_reference_images')}
          </Label>
          <span className="text-xs text-text-secondary">{references.length}/5</span>
        </div>
        <div
          className="flex flex-wrap gap-2 rounded-lg border border-border-light bg-surface-secondary/30 p-2"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(Array.from(event.dataTransfer?.files ?? []));
          }}
          onPaste={(event) => addFiles(Array.from(event.clipboardData?.files ?? []))}
        >
          {references.map((reference) => (
            <div
              key={reference.id}
              draggable={!disabled}
              className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-border-light bg-surface-secondary sm:size-20"
              onDragStart={() => {
                draggedReferenceId.current = reference.id;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedReferenceId.current && draggedReferenceId.current !== reference.id) {
                  onReorderReferences(draggedReferenceId.current, reference.id);
                }
                draggedReferenceId.current = null;
              }}
            >
              <img src={reference.data} alt={reference.name} className="h-full w-full object-cover" />
              <IconButton
                label={localize('com_ui_image_generation_remove_reference')}
                size="xs"
                shape="square"
                className="absolute right-1 top-1 bg-surface-primary shadow-sm"
                disabled={disabled}
                title={localize('com_ui_image_generation_remove_reference')}
                onClick={() => onRemoveReference(reference.id)}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          ))}
          {references.length < 5 && (
            <button
              type="button"
              aria-label={localize('com_ui_image_generation_add_reference')}
              disabled={disabled}
              className="relative size-16 shrink-0 rounded-lg border border-dashed border-border-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 sm:size-20"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          id="image-generation-reference-upload"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="sr-only"
          aria-label={localize('com_ui_image_generation_reference_images')}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="image-generation-prompt">{localize('com_ui_prompt')}</Label>
        <Textarea
          id="image-generation-prompt"
          value={prompt}
          maxLength={8000}
          placeholder={localize('com_ui_image_generation_prompt_placeholder')}
          disabled={disabled}
          onChange={(event) => onPromptChange(event.target.value)}
        />
      </div>

      <p className="text-xs text-text-secondary">{localize('com_ui_image_generation_parallel_hint')}</p>

      <Button type="submit" variant="submit" disabled={disabled || prompt.trim().length === 0}>
        <ImagePlus className="size-4" aria-hidden="true" />
        {disabled ? localize('com_ui_image_generation_generating') : localize('com_ui_generate')}
      </Button>
    </section>
  );
}
