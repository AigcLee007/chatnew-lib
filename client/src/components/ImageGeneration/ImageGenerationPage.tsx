import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@librechat/client';
import { getTokenHeader, IMAGE_MODELS } from 'librechat-data-provider';
import type {
  ImageAspectRatio,
  ImageCount,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageGenerationResult,
  ImageModel,
  ImageResolution,
} from 'librechat-data-provider';
import ImageInput from './ImageInput';
import ImageResults, { type ImageResultItem } from './ImageResults';
import type { ReferenceUpload } from './types';
import { useLocalize } from '~/hooks';
import {
  clearImageGenerationHistory,
  deleteImageGenerationHistory,
  loadImageGenerationHistory,
  releaseImageGenerationObjectUrls,
  saveImageGenerationHistory,
} from '~/utils/imageGenerationHistory';
import type { ImageGenerationHistoryEntry } from '~/utils/imageGenerationHistory';

const MAX_REFERENCE_IMAGES = 5;

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read image'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function sourceForImage(image: ImageGenerationResult): string {
  return image.data.startsWith('data:') || /^https?:\/\//i.test(image.data)
    ? image.data
    : `data:${image.mimeType};base64,${image.data}`;
}

async function referenceDataForImage(image: ImageGenerationResult): Promise<string> {
  const source = sourceForImage(image);
  if (!/^(?:blob:|https?:\/\/)/i.test(source)) return source;

  const response = await fetch(source);
  if (!response.ok) throw new Error('Unable to read generated image');
  const blob = await response.blob();
  return readFile(
    new File([blob], `generated-image-${image.index + 1}.png`, {
      type: blob.type || image.mimeType,
    }),
  );
}

function errorMessage(
  payload: Partial<ImageGenerationResponse> & { message?: string; error?: string },
  fallback: string,
): string {
  return payload.message ?? payload.error ?? fallback;
}

export default function ImageGenerationPage() {
  const localize = useLocalize();
  const abortRef = useRef<AbortController | null>(null);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ImageModel>(IMAGE_MODELS[0]);
  const [size, setSize] = useState<ImageAspectRatio>('1:1');
  const [resolution, setResolution] = useState<ImageResolution>('1K');
  const [count, setCount] = useState<ImageCount>(1);
  const [references, setReferences] = useState<ReferenceUpload[]>([]);
  const [imageItems, setImageItems] = useState<ImageResultItem[]>([]);
  const [error, setError] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<ImageGenerationHistoryEntry[]>([]);
  const [historyOffset, setHistoryOffset] = useState(20);
  const [historyAvailable, setHistoryAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    void loadImageGenerationHistory(20).then((entries) => {
      if (active) {
        setHistory(entries);
        setHistoryAvailable(entries.length >= 20);
      }
    });
    return () => {
      active = false;
      releaseImageGenerationObjectUrls();
    };
  }, []);

  const addFiles = (files: File[]) => {
    void Promise.all(
      files.map(async (file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        mimeType: file.type,
        data: await readFile(file),
      })),
    )
      .then((next) =>
        setReferences((current) => [...current, ...next].slice(0, MAX_REFERENCE_IMAGES)),
      )
      .catch(() => setError(localize('com_ui_image_generation_upload_error')));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating || prompt.trim().length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(undefined);
    setIsGenerating(true);
    const request: ImageGenerationRequest = {
      model,
      prompt: prompt.trim(),
      size,
      resolution,
      count,
      ...(references.length > 0
        ? { images: references.map(({ data, mimeType }) => ({ data, mimeType })) }
        : {}),
    };
    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(getTokenHeader() ? { Authorization: getTokenHeader() } : {}),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const payload = (await response.json()) as ImageGenerationResponse & {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(errorMessage(payload, localize('com_ui_image_gen_failed')));
        return;
      }
      const createdAt = Date.now();
      const generatedItems = payload.images.map((image) => ({ image, model, prompt: request.prompt, createdAt }));
      setImageItems((current) => [...generatedItems, ...current]);
      const saved = await Promise.all(
        payload.images.map((image) =>
          saveImageGenerationHistory({ model, prompt: request.prompt, size, resolution, image, references: request.images }),
        ),
      );
      setHistory((current) => [
        ...saved.filter((entry): entry is ImageGenerationHistoryEntry => entry !== null),
        ...current,
      ]);
      if (payload.failedCount > 0)
        setError(payload.message ?? localize('com_ui_image_generation_partial'));
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return;
      setError(localize('com_ui_image_gen_failed'));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsGenerating(false);
      }
    }
  };

  const continueEditing = async (image: ImageGenerationResult, historyReferences?: ReferenceUpload[]) => {
    try {
      const data = await referenceDataForImage(image);
      setReferences((current) =>
        [
          ...(historyReferences ?? []),
          {
            id: `generated-${image.index}-${crypto.randomUUID()}`,
            name: `generated-image-${image.index + 1}.png`,
            mimeType: image.mimeType,
            data,
          },
          ...current,
        ].slice(0, MAX_REFERENCE_IMAGES),
      );
      setPrompt('');
    } catch {
      setError(localize('com_ui_image_generation_upload_error'));
    }
  };

  const loadMoreHistory = async () => {
    const entries = await loadImageGenerationHistory(20, historyOffset);
    setHistory((current) => [...current, ...entries]);
    setHistoryOffset((offset) => offset + 20);
    setHistoryAvailable(entries.length === 20);
  };

  const clearHistory = async () => {
    await clearImageGenerationHistory();
    setHistory([]);
    setHistoryOffset(20);
    setHistoryAvailable(false);
  };

  return (
    <main className="h-full overflow-y-auto bg-surface-primary">
      <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-6 p-4 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)] lg:p-6">
        <section className="rounded-lg border border-border-light bg-surface-primary-alt p-4 sm:p-5">
          <h1 className="mb-5 text-xl font-semibold text-text-primary">
            {localize('com_ui_image_generation')}
          </h1>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <ImageInput
              prompt={prompt}
              model={model}
              size={size}
              resolution={resolution}
              count={count}
              references={references}
              disabled={isGenerating}
              onPromptChange={setPrompt}
              onModelChange={setModel}
              onSizeChange={setSize}
              onResolutionChange={setResolution}
              onCountChange={setCount}
              onAddFiles={addFiles}
              onRemoveReference={(id) =>
                setReferences((current) => current.filter((reference) => reference.id !== id))
              }
              onReorderReferences={(sourceId, targetId) =>
                setReferences((current) => {
                  const sourceIndex = current.findIndex((reference) => reference.id === sourceId);
                  const targetIndex = current.findIndex((reference) => reference.id === targetId);
                  if (sourceIndex < 0 || targetIndex < 0) return current;
                  const next = [...current];
                  const [reference] = next.splice(sourceIndex, 1);
                  next.splice(targetIndex, 0, reference);
                  return next;
                })
              }
              onUploadError={setError}
            />
            {isGenerating && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 text-sm text-text-secondary"
                onClick={() => abortRef.current?.abort()}
              >
                <Spinner className="size-4" />
                {localize('com_ui_cancel')}
              </button>
            )}
            {error && (
              <p role="alert" className="text-text-danger text-sm">
                {error}
              </p>
            )}
          </form>
        </section>
        <section className="min-w-0 rounded-lg border border-border-light bg-surface-primary-alt p-4 sm:p-5">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">
            {localize('com_ui_image_generation_results')}
          </h2>
          <ImageResults
            items={imageItems}
            onDelete={(index) => {
              setImageItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
            }}
            onContinueEditing={continueEditing}
          />
        </section>
        <section className="min-w-0 rounded-lg border border-border-light bg-surface-primary-alt p-4 sm:p-5 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text-primary">
              {localize('com_ui_image_generation_history')}
            </h2>
            <button type="button" className="text-sm text-text-secondary" onClick={() => void clearHistory()}>
              {localize('com_ui_clear')}
            </button>
          </div>
          <ImageResults
            items={history.map((entry) => ({ image: entry.image, model: entry.model, prompt: entry.prompt, createdAt: entry.createdAt }))}
            layout="waterfall"
            onDelete={(index) => {
              const entry = history[index];
              if (!entry) return;
              void deleteImageGenerationHistory(entry.id);
              setHistory((current) => current.filter((_, itemIndex) => itemIndex !== index));
            }}
            onContinueEditing={(image) => {
              const entry = history.find((item) => item.image.data === image.data);
              const references = entry?.references.map((reference, referenceIndex) => ({
                ...reference,
                id: `history-${entry.id}-${referenceIndex}`,
                name: (reference as ReferenceUpload).name ?? `history-reference-${referenceIndex + 1}.png`,
              }));
              void continueEditing(image, references);
            }}
          />
          {historyAvailable && history.length > 0 && (
            <button type="button" className="mt-4 text-sm text-text-secondary" onClick={() => void loadMoreHistory()}>
              {localize('com_ui_load_more')}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
