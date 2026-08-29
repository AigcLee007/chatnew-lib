import type {
  ImageAspectRatio,
  ImageGenerationResult,
  ImageModel,
  ImageResolution,
  ReferenceImage,
} from 'librechat-data-provider';

const DB_NAME = 'librechat-image-generation';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';
const INDEX_KEY = 'image-generation-history';
const MAX_PROMPT_SUMMARY = 120;

export interface ImageGenerationHistoryInput {
  model: ImageModel;
  prompt: string;
  size: ImageAspectRatio;
  resolution: ImageResolution;
  image: ImageGenerationResult;
  references?: ReferenceImage[];
}

export interface ImageGenerationHistoryEntry {
  id: string;
  createdAt: number;
  model: ImageModel;
  prompt: string;
  promptSummary: string;
  size: ImageAspectRatio;
  resolution: ImageResolution;
  image: ImageGenerationResult;
  references: ReferenceImage[];
}

interface Metadata {
  id: string;
  createdAt: number;
  model: ImageModel;
  promptSummary: string;
  size: ImageAspectRatio;
  resolution: ImageResolution;
  imageBlobKey: string;
  referenceBlobKeys: string[];
  imageMimeType: string;
  referenceMimeTypes: string[];
  referenceNames: string[];
}

const objectUrls = new Set<string>();

function available(): boolean {
  return typeof indexedDB !== 'undefined' && typeof window !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });
}

function dataUrlToBlob(data: string, mimeType: string): Blob {
  if (!data.startsWith('data:')) return new Blob([data], { type: mimeType });
  const comma = data.indexOf(',');
  if (comma < 0) return new Blob([], { type: mimeType });
  const header = data.slice(0, comma);
  const body = data.slice(comma + 1);
  if (/;base64/i.test(header)) {
    const binary = atob(body);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: mimeType || header.slice(5).split(';')[0] });
  }
  return new Blob([decodeURIComponent(body)], { type: mimeType || header.slice(5) });
}

async function blobForImage(image: ReferenceImage | ImageGenerationResult): Promise<Blob> {
  if (/^https?:\/\//i.test(image.data)) {
    const response = await fetch(image.data);
    if (!response.ok) throw new Error('Unable to save image');
    return response.blob();
  }
  return dataUrlToBlob(image.data.startsWith('data:') ? image.data : `data:${image.mimeType};base64,${image.data}`, image.mimeType);
}

function createObjectUrl(blob: Blob): string {
  if (typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    objectUrls.add(url);
    return url;
  }
  return '';
}

function readMetadata(): Metadata[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as Metadata[]) : [];
  } catch {
    return [];
  }
}

function writeMetadata(metadata: Metadata[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(metadata));
}

function request<T>(transaction: IDBTransaction, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const result = action(transaction.objectStore(STORE_NAME));
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error ?? new Error('IndexedDB operation failed'));
  });
}

async function putBlob(db: IDBDatabase, key: string, blob: Blob): Promise<void> {
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  await request(transaction, (store) => store.put(blob, key));
}

async function getBlob(db: IDBDatabase, key: string): Promise<Blob | undefined> {
  const transaction = db.transaction(STORE_NAME, 'readonly');
  return request<Blob | undefined>(transaction, (store) => store.get(key));
}

async function removeBlob(db: IDBDatabase, key: string): Promise<void> {
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  await request(transaction, (store) => store.delete(key));
}

export async function saveImageGenerationHistory(
  input: ImageGenerationHistoryInput,
): Promise<ImageGenerationHistoryEntry | null> {
  if (!available()) return null;
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const imageBlobKey = `${id}:image`;
  const references = input.references ?? [];
  const referenceBlobKeys = references.map((_, index) => `${id}:reference:${index}`);
  try {
    const db = await openDatabase();
    await putBlob(db, imageBlobKey, await blobForImage(input.image));
    await Promise.all(
      references.map(async (reference, index) => putBlob(db, referenceBlobKeys[index], await blobForImage(reference))),
    );
    const metadata: Metadata = {
      id,
      createdAt,
      model: input.model,
      promptSummary: input.prompt.trim().slice(0, MAX_PROMPT_SUMMARY),
      size: input.size,
      resolution: input.resolution,
      imageBlobKey,
      referenceBlobKeys,
      imageMimeType: input.image.mimeType,
      referenceMimeTypes: references.map((reference) => reference.mimeType),
      referenceNames: references.map((reference) => reference.name ?? 'reference-image'),
    };
    writeMetadata([metadata, ...readMetadata()]);
    db.close();
    return {
      ...input,
      id,
      createdAt,
      promptSummary: metadata.promptSummary,
      references,
    };
  } catch {
    return null;
  }
}

export async function loadImageGenerationHistory(limit = 20, offset = 0): Promise<ImageGenerationHistoryEntry[]> {
  if (!available()) return [];
  try {
    const db = await openDatabase();
    const entries = await Promise.all(
      readMetadata().slice(offset, offset + limit).map(async (metadata) => {
        const imageBlob = await getBlob(db, metadata.imageBlobKey);
        if (!imageBlob) return null;
        const imageData = createObjectUrl(imageBlob);
        const references = await Promise.all(
          metadata.referenceBlobKeys.map(async (key, index) => {
            const blob = await getBlob(db, key);
            return blob
              ? {
                  data: createObjectUrl(blob),
                  mimeType: metadata.referenceMimeTypes[index],
                  name: metadata.referenceNames[index],
                }
              : null;
          }),
        );
        return {
          id: metadata.id,
          createdAt: metadata.createdAt,
          model: metadata.model,
          prompt: metadata.promptSummary,
          promptSummary: metadata.promptSummary,
          size: metadata.size,
          resolution: metadata.resolution,
          image: { data: imageData, mimeType: metadata.imageMimeType, index: 0 },
          references: references.filter((reference): reference is ReferenceImage => reference !== null),
        };
      }),
    );
    db.close();
    return entries.filter((entry): entry is ImageGenerationHistoryEntry => entry !== null);
  } catch {
    return [];
  }
}

export async function deleteImageGenerationHistory(id: string): Promise<void> {
  if (!available()) return;
  const metadata = readMetadata().find((entry) => entry.id === id);
  if (!metadata) return;
  try {
    const db = await openDatabase();
    await Promise.all([metadata.imageBlobKey, ...metadata.referenceBlobKeys].map((key) => removeBlob(db, key)));
    db.close();
    writeMetadata(readMetadata().filter((entry) => entry.id !== id));
    releaseImageGenerationObjectUrls();
  } catch {
    return;
  }
}

export async function clearImageGenerationHistory(): Promise<void> {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
  if (!available()) {
    localStorage.removeItem(INDEX_KEY);
    return;
  }
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    await request(transaction, (store) => store.clear());
    db.close();
  } catch {
    return;
  }
  localStorage.removeItem(INDEX_KEY);
}

export function releaseImageGenerationObjectUrls(): void {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
}
