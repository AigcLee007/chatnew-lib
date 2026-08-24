import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notice } from '../../types';

const notices: Notice[] = [
  {
    id: 'notice-pinned',
    title: '重要更新公告',
    content: '第一行内容\n第二行内容\n第三行内容',
    date: '2026-08-18T16:24:28.035Z',
    active: true,
    pinned: true,
  },
  {
    id: 'notice-normal',
    title: '普通公告',
    content: '普通公告内容',
    date: '2026-08-17T16:24:28.035Z',
    active: true,
    pinned: false,
  },
];

const noticeState = vi.hoisted(() => ({
  notices: [] as Notice[],
  hasUnreadNotice: false,
  setNoticeModalOpen: vi.fn(),
  markAllAsRead: vi.fn(),
}));

vi.mock('../../store', () => ({
  useStore: () => noticeState,
}));

import { NoticePopover } from '../../components/NoticePopover';

describe('NoticePopover', () => {
  beforeEach(() => {
    noticeState.notices = notices;
    noticeState.hasUnreadNotice = false;
    noticeState.setNoticeModalOpen.mockReset();
    noticeState.markAllAsRead.mockReset();
  });

  it('exposes the notification center label and a static unread dot', () => {
    noticeState.hasUnreadNotice = true;

    render(<NoticePopover />);

    const entry = screen.getByRole('button', { name: '通知中心' });
    expect(entry.getAttribute('title')).toBe('通知中心');
    expect(screen.getByLabelText('有新公告')).not.toBeNull();
    expect(screen.getByLabelText('有新公告').className).not.toMatch(/animate-(bounce|pulse)/);
  });

  it('opens the announcement center and renders its list details', () => {
    render(<NoticePopover />);

    fireEvent.click(screen.getByRole('button', { name: '通知中心' }));

    expect(screen.getByRole('heading', { name: '通知公告中心' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '标注已读' })).not.toBeNull();
    expect(screen.getByRole('button', { name: /重要更新公告/ })).not.toBeNull();
    expect(screen.getByLabelText('置顶公告')).not.toBeNull();
    expect(screen.getByText(/第一行内容/)).not.toBeNull();
    expect(screen.getAllByText(/2026|8月|08/).length).toBeGreaterThan(0);
    expect(screen.getByText('© Aittco Notification System')).not.toBeNull();
  });

  it('opens the selected notice detail and closes the center', () => {
    render(<NoticePopover />);
    fireEvent.click(screen.getByRole('button', { name: '通知中心' }));

    fireEvent.click(screen.getByRole('button', { name: /重要更新公告/ }));

    expect(noticeState.setNoticeModalOpen).toHaveBeenCalledWith(true, notices[0]);
    expect(screen.queryByRole('heading', { name: '通知公告中心' })).toBeNull();
  });

  it('marks all notices read from the center action', () => {
    render(<NoticePopover />);
    fireEvent.click(screen.getByRole('button', { name: '通知中心' }));
    fireEvent.click(screen.getByRole('button', { name: '标注已读' }));

    expect(noticeState.markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking outside the center', () => {
    render(<NoticePopover />);
    fireEvent.click(screen.getByRole('button', { name: '通知中心' }));
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('heading', { name: '通知公告中心' })).toBeNull();
  });

  it('renders an empty state when there are no notices', () => {
    noticeState.notices = [];
    render(<NoticePopover />);
    fireEvent.click(screen.getByRole('button', { name: '通知中心' }));

    expect(screen.getByText('当前暂无全站公告')).not.toBeNull();
  });

  it('uses a full-width inset panel on small screens and a right-aligned desktop panel', () => {
    render(<NoticePopover />);
    fireEvent.click(screen.getByRole('button', { name: '通知中心' }));

    const panel = screen.getByRole('heading', { name: '通知公告中心' }).parentElement?.parentElement
      ?.parentElement;
    expect(panel?.classList.contains('left-4')).toBe(true);
    expect(panel?.classList.contains('right-4')).toBe(true);
    expect(panel?.classList.contains('w-auto')).toBe(true);
    expect(panel?.classList.contains('sm:right-0')).toBe(true);
    expect(panel?.classList.contains('sm:left-auto')).toBe(true);
    expect(panel?.classList.contains('sm:w-80')).toBe(true);
  });
});
