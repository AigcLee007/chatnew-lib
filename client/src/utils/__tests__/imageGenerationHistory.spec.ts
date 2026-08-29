import {
  clearImageGenerationHistory,
  deleteImageGenerationHistory,
  loadImageGenerationHistory,
  saveImageGenerationHistory,
} from '../imageGenerationHistory';

function installIndexedDb(): void {
  const blobs = new Map<string, Blob>();
  const createRequest = <T>(run: () => T) => {
    const request = {} as IDBRequest<T>;
    queueMicrotask(() => {
      try {
        Object.assign(request, { result: run() });
        request.onsuccess?.call(request, new Event('success'));
      } catch (error) {
        Object.assign(request, { error });
        request.onerror?.call(request, new Event('error'));
      }
    });
    return request;
  };
  const store = {
    put: (blob: Blob, key: string) => createRequest(() => blobs.set(key, blob)),
    get: (key: string) => createRequest(() => blobs.get(key)),
    delete: (key: string) => createRequest(() => blobs.delete(key)),
    clear: () => createRequest(() => blobs.clear()),
  } as unknown as IDBObjectStore;
  const database = {
    createObjectStore: jest.fn(),
    transaction: () => ({ objectStore: () => store }) as unknown as IDBTransaction,
    close: jest.fn(),
  } as unknown as IDBDatabase;
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: { open: () => createRequest(() => database) } as unknown as IDBFactory,
  });
}

const sample = (index = 0) => ({
  model: 'gemini-3-pro-image-preview' as const,
  prompt: `A garden ${index}`,
  size: '1:1' as const,
  resolution: '1K' as const,
  image: {
    data: `data:image/png;base64,${btoa(`result-${index}`)}`,
    mimeType: 'image/png',
    index,
  },
  references: [
    {
      data: `data:image/png;base64,${btoa('reference')}`,
      mimeType: 'image/png',
      name: 'reference.png',
    },
  ],
});

describe('image generation history', () => {
  beforeEach(async () => {
    installIndexedDb();
    localStorage.clear();
    await clearImageGenerationHistory();
  });

  it('degrades gracefully when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
    await expect(saveImageGenerationHistory(sample())).resolves.toBeNull();
    await expect(loadImageGenerationHistory()).resolves.toEqual([]);
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: original });
  });

  it('persists image and reference blobs while localStorage contains metadata only', async () => {
    const saved = await saveImageGenerationHistory(sample());
    expect(saved).not.toBeNull();
    const metadata = JSON.parse(localStorage.getItem('image-generation-history') ?? '[]') as Array<
      Record<string, unknown>
    >;
    expect(metadata).toHaveLength(1);
    expect(metadata[0]).toEqual(
      expect.objectContaining({ model: 'gemini-3-pro-image-preview', promptSummary: 'A garden 0' }),
    );
    expect(metadata[0]).not.toHaveProperty('prompt');
    expect(JSON.stringify(metadata)).not.toContain('result-0');
    expect(JSON.stringify(metadata)).not.toContain(btoa('reference'));
    expect(saved?.image.data).toContain('cmVzdWx0LTA=');
  });

  it('loads newest entries with pagination, then deletes and clears them', async () => {
    await Promise.all([0, 1, 2].map((index) => saveImageGenerationHistory(sample(index))));
    const first = await loadImageGenerationHistory(2);
    expect(first).toHaveLength(2);
    expect(first[0].prompt).toBe('A garden 2');
    const rest = await loadImageGenerationHistory(2, 2);
    expect(rest).toHaveLength(1);
    await deleteImageGenerationHistory(first[0].id);
    expect(await loadImageGenerationHistory(20)).toHaveLength(2);
    await clearImageGenerationHistory();
    expect(await loadImageGenerationHistory()).toEqual([]);
  });
});
