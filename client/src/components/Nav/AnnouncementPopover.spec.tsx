import { act, render, screen, waitFor, within } from '@testing-library/react';
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

  it('shows the pinned marker in the announcement detail dialog', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/announcements/read'
        ? jsonResponse({ ok: true })
        : jsonResponse([
            { _id: 'a-1', title: 'Pinned update', content: 'Body', pinned: true, unread: true },
          ]),
    );

    render(<AnnouncementPopover compact />);

    const dialog = await screen.findByRole('dialog', { name: 'Pinned update' });
    expect(dialog).toHaveTextContent('置顶');
  });

  it('moves focus into the dialog and loops Tab navigation within it', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/announcements/read'
        ? jsonResponse({ ok: true })
        : jsonResponse([{ _id: 'a-1', title: 'Focus update', content: 'Body', unread: true }]),
    );

    render(<AnnouncementPopover compact />);
    const user = userEvent.setup();
    await screen.findByRole('dialog', { name: 'Focus update' });
    const closeButton = screen.getByRole('button', { name: '关闭公告详情' });
    const confirmButton = screen.getByRole('button', { name: '我知道了' });

    await waitFor(() => expect(closeButton).toHaveFocus());
    await user.tab();
    expect(confirmButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();
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

  it('closes the dialog with its close button and restores focus to the announcement entry', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/announcements/read'
        ? jsonResponse({ ok: true })
        : jsonResponse([{ _id: 'a-1', title: 'Close me', content: 'Body', unread: true }]),
    );

    render(<AnnouncementPopover compact />);
    const user = userEvent.setup();
    const entry = await screen.findByRole('button', { name: '公告' });
    const dialog = await screen.findByRole('dialog', { name: 'Close me' });

    await user.click(screen.getByRole('button', { name: '关闭公告详情' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(entry).toHaveFocus();
  });

  it('closes the dialog when its backdrop is clicked and restores focus to the entry', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/announcements/read'
        ? jsonResponse({ ok: true })
        : jsonResponse([{ _id: 'a-1', title: 'Backdrop update', content: 'Body', unread: true }]),
    );

    render(<AnnouncementPopover compact />);
    const user = userEvent.setup();
    const entry = await screen.findByRole('button', { name: '公告' });
    const dialog = await screen.findByRole('dialog', { name: 'Backdrop update' });

    await user.click(dialog);

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(entry).toHaveFocus();
  });

  it('closes the dialog with Escape while keeping the announcement entry usable', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/announcements/read'
        ? jsonResponse({ ok: true })
        : jsonResponse([{ _id: 'a-1', title: 'Escape me', content: 'Body', unread: true }]),
    );

    render(<AnnouncementPopover compact />);
    const user = userEvent.setup();
    const entry = await screen.findByRole('button', { name: '公告' });
    await screen.findByRole('dialog', { name: 'Escape me' });

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Escape me' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(entry).toHaveFocus();
    await user.click(entry);
    expect(screen.getByRole('menu')).toBeVisible();
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

    const dialog = await screen.findByRole('dialog', { name: 'New' });
    expect(within(dialog).getByText('New')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/announcements/read',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.getByLabelText('有新公告')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('button', { name: '我知道了' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/announcements/read',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
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

    const dialog = await screen.findByRole('dialog', { name: 'Read me' });
    expect(within(dialog).getByText('Read me')).toBeInTheDocument();
    await userEvent.setup().click(within(dialog).getByRole('button', { name: '我知道了' }));
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

    const dialog = await screen.findByRole('dialog', { name: 'Retry' });
    expect(within(dialog).getByText('Retry')).toBeInTheDocument();
    expect(screen.getByLabelText('有新公告')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('button', { name: '我知道了' }));
    await waitFor(() => expect(readAttempts).toBe(1));
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

    const dialog = await screen.findByRole('dialog', { name: 'Focus retry' });
    expect(within(dialog).getByText('Focus retry')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('button', { name: '我知道了' }));
    await waitFor(() => expect(readAttempts).toBe(1));
    await user.click(screen.getByRole('button', { name: '公告' }));
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(readAttempts).toBe(2));
    await waitFor(() => expect(screen.queryByLabelText('有新公告')).not.toBeInTheDocument());
  });

  it('opens for an announcement received while the window was unfocused', async () => {
    let loadCount = 0;
    let freshVisibleWhenReadStarts: boolean | undefined;
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/announcements/read') {
        if (loadCount > 1) {
          freshVisibleWhenReadStarts = Boolean(
            within(screen.getByRole('menu')).queryByText('Fresh'),
          );
        }
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

    const initialDialog = await screen.findByRole('dialog', { name: 'Initial' });
    expect(within(initialDialog).getByText('Initial')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(initialDialog).getByRole('button', { name: '我知道了' }));
    await user.click(screen.getByRole('button', { name: '公告' }));
    window.dispatchEvent(new Event('focus'));

    const freshDialog = await screen.findByRole('dialog', { name: 'Fresh' });
    await user.click(within(freshDialog).getByRole('button', { name: '我知道了' }));
    await user.click(screen.getByRole('button', { name: '公告' }));
    expect(within(await screen.findByRole('menu')).getByText('Fresh')).toBeInTheDocument();
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

    const oldDialog = await screen.findByRole('dialog', { name: 'Old' });
    expect(within(oldDialog).getByText('Old')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(oldDialog).getByRole('button', { name: '我知道了' }));
    await waitFor(() => expect(readAttempts).toBe(1));
    const button = screen.getByRole('button', { name: '公告' });
    await user.click(button);
    window.dispatchEvent(new Event('focus'));

    expect(
      within(await screen.findByRole('menu')).getByText('Fresh after failure'),
    ).toBeInTheDocument();
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

    expect(
      within(await screen.findByRole('dialog', { name: 'Newest' })).getByText('Newest'),
    ).toBeInTheDocument();
    await act(async () => resolveInitialLoad(jsonResponse([])));

    expect(
      within(screen.getByRole('dialog', { name: 'Newest' })).getByText('Newest'),
    ).toBeInTheDocument();
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

    const oldDialog = await screen.findByRole('dialog', { name: 'Old' });
    expect(within(oldDialog).getByText('Old')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(oldDialog).getByRole('button', { name: '我知道了' }));
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

    const freshDialog = await screen.findByRole('dialog', { name: 'Fresh' });
    await user.click(within(freshDialog).getByRole('button', { name: '我知道了' }));
    await user.click(screen.getByRole('button', { name: '公告' }));
    expect(within(await screen.findByRole('menu')).getByText('Fresh')).toBeInTheDocument();
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

    const oldDialog = await screen.findByRole('dialog', { name: 'Old' });
    expect(within(oldDialog).getByText('Old')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(oldDialog).getByRole('button', { name: '我知道了' }));
    await waitFor(() => expect(readAttempts).toBe(1));
    window.dispatchEvent(new Event('focus'));

    const freshDialog = await screen.findByRole('dialog', { name: 'Fresh' });
    await user.click(within(freshDialog).getByRole('button', { name: '我知道了' }));
    await user.click(screen.getByRole('button', { name: '公告' }));
    expect(within(await screen.findByRole('menu')).getByText('Fresh')).toBeInTheDocument();
    expect(readAttempts).toBe(1);
    resolveInitialRead(jsonResponse({ ok: true }));

    await waitFor(() => expect(readBodies).toContain(JSON.stringify({ announcementIds: ['a-2'] })));
  });

  it('does not let an older read response clear a newer unread list response', async () => {
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
      return jsonResponse([{ _id: 'a-1', title: 'Still unread', content: 'Body', unread: true }]);
    });

    render(<AnnouncementPopover compact />);

    const dialog = await screen.findByRole('dialog', { name: 'Still unread' });
    expect(within(dialog).getByText('Still unread')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('button', { name: '我知道了' }));
    await waitFor(() => expect(readAttempts).toBe(1));
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(loadCount).toBe(2));

    resolveInitialRead(jsonResponse({ ok: true }));

    expect(await screen.findByLabelText('有新公告')).toBeInTheDocument();
    expect(readBodies).toEqual([JSON.stringify({ announcementIds: ['a-1'] })]);
  });
});
