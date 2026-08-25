import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnouncementPopover from './AnnouncementPopover';

const fetchMock = jest.fn();

jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ user: { role: 'USER' } }),
}));

jest.mock('librechat-data-provider', () => ({
  getTokenHeader: () => 'Bearer test',
}));

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe('AnnouncementPopover', () => {
  it('shows an unread announcement in a dialog named for its title', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/announcements/read'
        ? jsonResponse({ ok: true })
        : jsonResponse([
            {
              _id: 'a-1',
              title: 'Important update',
              content: 'Please read this update.',
              unread: true,
            },
          ]),
    );

    render(<AnnouncementPopover compact />);

    const dialog = await screen.findByRole('dialog', { name: 'Important update' });
    expect(dialog).toHaveTextContent('Please read this update.');
  });

  it('closes the unread announcement dialog and removes the red dot after confirming', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/announcements/read'
        ? jsonResponse({ ok: true })
        : jsonResponse([
            { _id: 'a-1', title: 'Read this', content: 'Announcement body', unread: true },
          ]),
    );

    render(<AnnouncementPopover compact />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '我知道了' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Read this' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/announcements/read',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ announcementIds: ['a-1'] }),
      }),
    );
  });

  it('auto-opens and shows a red dot when an announcement is unread', async () => {
    let resolveRead: (response: unknown) => void = () => undefined;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/announcements/read') {
        return new Promise((resolve) => {
          resolveRead = resolve;
        });
      }
      return jsonResponse([{ _id: 'a-1', title: 'New', content: 'Body', unread: true }]);
    });

    render(<AnnouncementPopover compact />);

    expect(await screen.findByText('New')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/announcements/read',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.getByLabelText('有新公告')).toBeInTheDocument();

    resolveRead(jsonResponse({ ok: true }));
    await waitFor(() => expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument());
  });

  it('removes the red dot after opening and successfully marking announcements read', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/announcements/read'
        ? jsonResponse({ ok: true })
        : jsonResponse([{ _id: 'a-1', title: 'Read me', content: 'Body', unread: true }]),
    );

    render(<AnnouncementPopover compact />);

    expect(await screen.findByText('Read me')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument());
    const readCall = fetchMock.mock.calls.find(([url]) => url === '/api/announcements/read');
    expect(readCall?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ announcementIds: ['a-1'] }),
      }),
    );
  });

  it('keeps the red dot and retries when marking announcements read fails', async () => {
    let readAttempts = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/announcements/read') {
        readAttempts += 1;
        return readAttempts === 1
          ? Promise.reject(new Error('network'))
          : jsonResponse({ ok: true });
      }
      return jsonResponse([{ _id: 'a-1', title: 'Retry', content: 'Body', unread: true }]);
    });

    render(<AnnouncementPopover compact />);

    expect(await screen.findByText('Retry')).toBeInTheDocument();
    await waitFor(() => expect(readAttempts).toBe(1));
    expect(screen.getByLabelText('有新公告')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '公告' }));
    await user.click(screen.getByRole('button', { name: '公告' }));
    await waitFor(() => expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument());
    expect(readAttempts).toBe(2);
  });

  it('retries marking announcements read when the window regains focus', async () => {
    let readAttempts = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/announcements/read') {
        readAttempts += 1;
        return readAttempts === 1
          ? Promise.reject(new Error('network'))
          : jsonResponse({ ok: true });
      }
      return jsonResponse([{ _id: 'a-1', title: 'Focus retry', content: 'Body', unread: true }]);
    });

    render(<AnnouncementPopover compact />);

    expect(await screen.findByText('Focus retry')).toBeInTheDocument();
    await waitFor(() => expect(readAttempts).toBe(1));
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(readAttempts).toBe(2));
    await waitFor(() => expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument());
  });

  it('opens for an announcement received while the window was unfocused', async () => {
    let loadCount = 0;
    let freshVisibleWhenReadStarts: boolean | undefined;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/announcements/read') {
        if (loadCount > 1) freshVisibleWhenReadStarts = Boolean(screen.queryByText('Fresh'));
        return jsonResponse({ ok: true });
      }
      loadCount += 1;
      return jsonResponse(
        loadCount === 1
          ? [{ _id: 'a-1', title: 'Initial', content: 'Body', unread: true }]
          : [{ _id: 'a-2', title: 'Fresh', content: 'Body', unread: true }],
      );
    });

    render(<AnnouncementPopover compact />);

    expect(await screen.findByText('Initial')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '公告' }));
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByText('Fresh')).toBeInTheDocument();
    expect(freshVisibleWhenReadStarts).toBe(true);
  });

  it('reopens when a new unread announcement arrives after a failed read', async () => {
    let loadCount = 0;
    let readAttempts = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/announcements/read') {
        readAttempts += 1;
        return readAttempts === 1 ? Promise.reject(new Error('network')) : new Promise(() => {});
      }
      loadCount += 1;
      return jsonResponse(
        loadCount === 1
          ? [{ _id: 'a-1', title: 'Old', content: 'Body', unread: true }]
          : [
              { _id: 'a-1', title: 'Old', content: 'Body', unread: true },
              { _id: 'a-2', title: 'Fresh after failure', content: 'Body', unread: true },
            ],
      );
    });

    render(<AnnouncementPopover compact />);

    expect(await screen.findByText('Old')).toBeInTheDocument();
    await waitFor(() => expect(readAttempts).toBe(1));
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: '公告' });
    await user.click(button);
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByText('Fresh after failure')).toBeInTheDocument();
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
  });

  it('keeps the newest announcement response when an earlier load finishes last', async () => {
    let resolveInitialLoad: (response: unknown) => void = () => undefined;
    let resolveFocusLoad: (response: unknown) => void = () => undefined;
    let loadCount = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/announcements/read') return new Promise(() => {});
      loadCount += 1;
      return new Promise((resolve) => {
        if (loadCount === 1) resolveInitialLoad = resolve;
        else resolveFocusLoad = resolve;
      });
    });

    render(<AnnouncementPopover compact />);
    await waitFor(() => expect(loadCount).toBe(1));
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(loadCount).toBe(2));
    resolveFocusLoad(
      jsonResponse([{ _id: 'a-2', title: 'Newest', content: 'Body', unread: true }]),
    );

    expect(await screen.findByText('Newest')).toBeInTheDocument();
    await act(async () => resolveInitialLoad(jsonResponse([])));

    expect(screen.getByText('Newest')).toBeInTheDocument();
    expect(screen.getByLabelText('有新公告')).toBeInTheDocument();
  });

  it('marks announcements from the latest overlapping focus refresh', async () => {
    let loadCount = 0;
    let readAttempts = 0;
    let resolveStaleLoad: (response: unknown) => void = () => undefined;
    let resolveFreshLoad: (response: unknown) => void = () => undefined;
    const readBodies: string[] = [];
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/announcements/read') {
        readAttempts += 1;
        readBodies.push(String(options?.body));
        if (readAttempts === 1) return Promise.reject(new Error('network'));
        return jsonResponse({ ok: true });
      }

      loadCount += 1;
      if (loadCount === 1) {
        return jsonResponse([{ _id: 'a-1', title: 'Old', content: 'Body', unread: true }]);
      }
      return new Promise((resolve) => {
        if (loadCount === 2) resolveStaleLoad = resolve;
        else resolveFreshLoad = resolve;
      });
    });

    render(<AnnouncementPopover compact />);

    expect(await screen.findByText('Old')).toBeInTheDocument();
    await waitFor(() => expect(readAttempts).toBe(1));
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(loadCount).toBe(2));
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(loadCount).toBe(3));

    await act(async () =>
      resolveStaleLoad(jsonResponse([{ _id: 'a-1', title: 'Old', content: 'Body', unread: true }])),
    );
    await act(async () =>
      resolveFreshLoad(
        jsonResponse([{ _id: 'a-2', title: 'Fresh', content: 'Body', unread: true }]),
      ),
    );

    expect(await screen.findByText('Fresh')).toBeInTheDocument();
    await waitFor(() => expect(readBodies).toContain(JSON.stringify({ announcementIds: ['a-2'] })));
  });

  it('queues the latest announcements while an earlier read request is in flight', async () => {
    let loadCount = 0;
    let readAttempts = 0;
    let resolveInitialRead: (response: unknown) => void = () => undefined;
    const readBodies: string[] = [];
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/announcements/read') {
        readAttempts += 1;
        readBodies.push(String(options?.body));
        if (readAttempts === 1) {
          return new Promise((resolve) => {
            resolveInitialRead = resolve;
          });
        }
        return jsonResponse({ ok: true });
      }

      loadCount += 1;
      return jsonResponse(
        loadCount === 1
          ? [{ _id: 'a-1', title: 'Old', content: 'Body', unread: true }]
          : [{ _id: 'a-2', title: 'Fresh', content: 'Body', unread: true }],
      );
    });

    render(<AnnouncementPopover compact />);

    expect(await screen.findByText('Old')).toBeInTheDocument();
    await waitFor(() => expect(readAttempts).toBe(1));
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByText('Fresh')).toBeInTheDocument();
    expect(readAttempts).toBe(1);
    resolveInitialRead(jsonResponse({ ok: true }));

    await waitFor(() => expect(readBodies).toContain(JSON.stringify({ announcementIds: ['a-2'] })));
  });
});
