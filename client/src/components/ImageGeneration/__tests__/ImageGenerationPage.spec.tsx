import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ImageGenerationPage from '../ImageGenerationPage';

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

const renderPage = () =>
  render(
    <MemoryRouter>
      <ImageGenerationPage />
    </MemoryRouter>,
  );

describe('ImageGenerationPage', () => {
  it('renders generation controls for models, aspect ratios, resolution and count', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /image generation/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3 + 8 + 3 + 4);
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
      createResponse({
        images: [{ data: 'aGVsbG8=', mimeType: 'image/png', index: 0 }],
        requestedCount: 1,
        successCount: 1,
        failedCount: 0,
        model: 'gemini-3-pro-image-preview',
        requestId: 'request-1',
      }),
    );
    global.fetch = fetchSpy;
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
    global.fetch = jest
      .fn()
      .mockImplementation(() =>
        createResponse({ message: 'Image generation is unavailable' }, false),
      );
    renderPage();

    await user.type(screen.getByLabelText(/prompt/i), 'A summer garden');
    await user.click(screen.getByRole('button', { name: /generate/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Image generation is unavailable');
    expect(screen.getByRole('button', { name: /generate/i })).toBeEnabled();
  });
});
