import { render, screen, waitFor } from '@testing-library/react';
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
});
