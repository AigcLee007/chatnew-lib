import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ImageGenerationPage from '../ImageGenerationPage';

const mockTriggerDownload = jest.fn<void, [source: string, filename: string]>();

jest.mock('~/utils', () => ({
  cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' '),
  triggerDownload: (...args: Parameters<typeof mockTriggerDownload>) => mockTriggerDownload(...args),
}));

jest.mock(
  '@librechat/client',
  () => {
    const React = jest.requireActual('react') as typeof import('react');
    return {
      Button: ({
        children,
        variant: _variant,
        size: _size,
        ...props
      }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) =>
        React.createElement('button', props, children),
      IconButton: ({
        children,
        label,
        variant: _variant,
        size: _size,
        shape: _shape,
        ...props
      }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        label: string;
        variant?: string;
        size?: string;
        shape?: string;
      }) => React.createElement('button', { ...props, 'aria-label': label }, children),
      Label: ({
        children,
        variant: _variant,
        ...props
      }: React.LabelHTMLAttributes<HTMLLabelElement> & { variant?: string }) =>
        React.createElement('label', props, children),
      Spinner: ({ className }: { className?: string }) =>
        React.createElement('span', { className }),
      Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
        React.createElement('textarea', props),
    };
  },
  { virtual: true },
);

const createResponse = (body: unknown, ok = true) =>
  Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);

const setFetchMock = (mock: jest.Mock) => {
  global.fetch = mock as unknown as typeof fetch;
  return mock;
};

const generatedImage = (data = 'aGVsbG8=') => ({
  data,
  mimeType: 'image/png',
  index: 0,
});

const generatedResponse = (images = [generatedImage()], failedCount = 0) => ({
  images,
  requestedCount: 1,
  successCount: images.length,
  failedCount,
  model: 'gemini-3-pro-image-preview',
  requestId: 'request-1',
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ImageGenerationPage />
    </MemoryRouter>,
  );

describe('ImageGenerationPage', () => {
  beforeEach(() => {
    mockTriggerDownload.mockReset();
  });

  it('renders generation controls for models, aspect ratios, resolution and count', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /image generation/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3 + 8 + 3 + 4);
    expect(screen.getByText(/single request/i)).toBeInTheDocument();
  });

  it('keeps at most five reference images', async () => {
    const user = userEvent.setup();
    renderPage();
    const files = Array.from(
      { length: 6 },
      (_, index) => new File(['image'], `reference-${index}.png`, { type: 'image/png' }),
    );

    await user.upload(screen.getByLabelText(/reference images/i), files);

    expect(await screen.findAllByRole('button', { name: /remove reference image/i })).toHaveLength(
      5,
    );
    expect(screen.getByText(/up to five reference images/i)).toBeInTheDocument();
  });

  it('submits the selected settings and renders generated images', async () => {
    const user = userEvent.setup();
    const fetchSpy = jest.fn().mockImplementation(() =>
      createResponse(generatedResponse()),
    );
    setFetchMock(fetchSpy);
    renderPage();

    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/images/generate',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByRole('img', { name: /generated image 1/i })).toBeInTheDocument();
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({
      prompt: 'A summer garden',
      model: 'gemini-3-pro-image-preview',
      size: '1:1',
      resolution: '1K',
      count: 1,
    });
  });

  it('shows the API error and enables generation again', async () => {
    const user = userEvent.setup();
    setFetchMock(
      jest
        .fn()
        .mockImplementation(() =>
          createResponse({ message: 'Image generation is unavailable' }, false),
        ),
    );
    renderPage();

    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /generate/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Image generation is unavailable');
    expect(screen.getByRole('button', { name: /generate/i })).toBeEnabled();
  });

  it('reorders reference images dropped onto another reference', async () => {
    const user = userEvent.setup();
    renderPage();
    const first = new File(['first'], 'first.png', { type: 'image/png' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });

    await user.upload(screen.getByLabelText(/reference images/i), [first, second]);

    const firstImage = await screen.findByRole('img', { name: 'first.png' });
    const secondImage = screen.getByRole('img', { name: 'second.png' });
    const firstReference = firstImage.parentElement;
    const secondReference = secondImage.parentElement;
    expect(firstReference).not.toBeNull();
    expect(secondReference).not.toBeNull();

    fireEvent.dragStart(firstReference!);
    fireEvent.drop(secondReference!);

    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'second.png',
      'first.png',
    ]);
  });

  it('adds pasted image files as references', async () => {
    renderPage();
    const file = new File(['image'], 'pasted.png', { type: 'image/png' });

    fireEvent.paste(screen.getByText(/click, drop, or paste reference images/i), {
      clipboardData: { files: [file] },
    });

    expect(await screen.findByRole('img', { name: 'pasted.png' })).toBeInTheDocument();
  });

  it('disables generation controls and aborts the request when cancelled', async () => {
    const user = userEvent.setup();
    let requestSignal: AbortSignal | undefined;
    setFetchMock(jest.fn().mockImplementation((_url, options: RequestInit) => {
      requestSignal = options.signal ?? undefined;
      return new Promise((_resolve, reject) =>
        requestSignal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted', 'AbortError')),
        ),
      );
    }));
    renderPage();

    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /^generate$/i }));

    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled();
    expect(screen.getByLabelText(/prompt/i)).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByRole('button', { name: /^generate$/i })).toBeEnabled();
  });

  it('shows a partial failure message while retaining successful images', async () => {
    const user = userEvent.setup();
    setFetchMock(
      jest
        .fn()
        .mockImplementation(() => createResponse({ ...generatedResponse(), failedCount: 1 })),
    );
    renderPage();

    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /^generate$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Some images could not be generated');
    expect(screen.getByRole('img', { name: /generated image 1/i })).toBeInTheDocument();
  });

  it('downloads, copies, deletes, and continues editing generated images', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    setFetchMock(jest.fn().mockImplementation(() => createResponse(generatedResponse())));
    renderPage();

    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /^generate$/i }));
    await screen.findByRole('img', { name: /generated image 1/i });

    await user.click(screen.getByRole('button', { name: /download/i }));
    expect(mockTriggerDownload).toHaveBeenCalledWith(
      'data:image/png;base64,aGVsbG8=',
      'generated-image-1.png',
    );

    await user.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('data:image/png;base64,aGVsbG8='),
    );

    await user.click(screen.getByRole('button', { name: /continue editing/i }));
    expect(await screen.findByRole('img', { name: 'generated-image-1.png' })).toHaveAttribute(
      'src',
      'data:image/png;base64,aGVsbG8=',
    );

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.queryByRole('img', { name: /generated image 1/i })).not.toBeInTheDocument();
  });

  it('opens generated images in a full-screen preview and closes it', async () => {
    const user = userEvent.setup();
    setFetchMock(jest.fn().mockImplementation(() => createResponse(generatedResponse())));
    renderPage();
    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /^generate$/i }));
    const image = await screen.findByRole('img', { name: /generated image 1/i });
    await user.click(image);
    expect(screen.getByRole('dialog', { name: /image preview/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches between images with arrow keys in the preview', async () => {
    const user = userEvent.setup();
    const secondImage = { ...generatedImage('d29ybGQ='), index: 1 };
    setFetchMock(jest.fn().mockImplementation(() => createResponse(generatedResponse([generatedImage(), secondImage]))));
    renderPage();
    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /^generate$/i }));
    await user.click(await screen.findByRole('img', { name: /generated image 1/i }));
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8=');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,d29ybGQ=');
  });

  it('renders history cards in a waterfall layout with natural image ratio', async () => {
    const user = userEvent.setup();
    setFetchMock(jest.fn().mockImplementation(() => createResponse(generatedResponse())));
    renderPage();
    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /^generate$/i }));
    await screen.findByRole('img', { name: /generated image 1/i });
    const historyHeading = screen.getByRole('heading', { name: /local history/i });
    const historySection = historyHeading.closest('section');
    expect(historySection).not.toBeNull();
    expect(historySection?.querySelector('.columns-1')).toBeInTheDocument();
    const historyImages = historySection?.querySelectorAll('img') ?? [];
    historyImages.forEach((historyImage) => {
      expect(historyImage).not.toHaveClass('aspect-square');
      expect(historyImage).toHaveClass('object-contain');
    });
  });

  it('converts a generated image URL to a data URL before continuing to edit', async () => {
    const user = userEvent.setup();
    const imageUrl = 'https://images.example.test/generated.png';
    const fetchSpy = jest
      .fn()
      .mockImplementationOnce(() => createResponse(generatedResponse([generatedImage(imageUrl)])))
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['image'], { type: 'image/png' })),
        }),
      );
    setFetchMock(fetchSpy);
    renderPage();

    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /^generate$/i }));
    await screen.findByRole('img', { name: /generated image 1/i });
    await user.click(screen.getByRole('button', { name: /continue editing/i }));

    expect(await screen.findByRole('img', { name: 'generated-image-1.png' })).toHaveAttribute(
      'src',
      'data:image/png;base64,aW1hZ2U=',
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(2, imageUrl);
  });

  it('shows an error when a generated image URL cannot be read for editing', async () => {
    const user = userEvent.setup();
    const imageUrl = 'https://images.example.test/generated.png';
    setFetchMock(
      jest
        .fn()
        .mockImplementationOnce(() => createResponse(generatedResponse([generatedImage(imageUrl)])))
        .mockRejectedValueOnce(new Error('Network error')),
    );
    renderPage();

    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /^generate$/i }));
    await screen.findByRole('img', { name: /generated image 1/i });
    await user.click(screen.getByRole('button', { name: /continue editing/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Add a PNG, JPEG, or WebP image');
    expect(screen.queryByRole('img', { name: 'generated-image-1.png' })).not.toBeInTheDocument();
  });
});
