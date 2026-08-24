import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notice } from '../../types';

const currentNotice: Notice = {
  id: 'notice-1',
  title: '8.18更新公告',
  content: '新增模型\n请及时体验',
  date: '2026-08-18T16:24:28.035Z',
  active: true,
  pinned: false,
};

const noticeState = vi.hoisted(() => ({
  isNoticeModalOpen: true,
  currentNoticeDetail: null as Notice | null,
  setNoticeModalOpen: vi.fn(),
}));

vi.mock('../../store', () => ({
  useStore: () => noticeState,
}));

import { NoticeModal } from '../../components/NoticeModal';

describe('NoticeModal', () => {
  beforeEach(() => {
    noticeState.isNoticeModalOpen = true;
    noticeState.currentNoticeDetail = currentNotice;
    noticeState.setNoticeModalOpen.mockReset();
  });

  it('renders an accessible announcement dialog with its content', () => {
    render(<NoticeModal />);

    const dialog = screen.getByRole('dialog', { name: currentNotice.title });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: currentNotice.title })).not.toBeNull();
    expect(screen.getByText(currentNotice.date)).not.toBeNull();
    const body = screen
      .getAllByText((_, element) => element?.textContent === currentNotice.content)
      .find((element) => element.tagName === 'P');
    expect(body?.className).toContain('whitespace-pre-wrap');
    expect(screen.getByLabelText('关闭公告')).not.toBeNull();
    expect(screen.getByRole('button', { name: '我知道了' })).not.toBeNull();
  });

  it('marks the displayed notice read when closed with the X button', () => {
    render(<NoticeModal />);

    fireEvent.click(screen.getByLabelText('关闭公告'));

    expect(noticeState.setNoticeModalOpen).toHaveBeenCalledWith(false, currentNotice);
  });

  it('marks the displayed notice read when confirmation is clicked', () => {
    render(<NoticeModal />);

    fireEvent.click(screen.getByRole('button', { name: '我知道了' }));

    expect(noticeState.setNoticeModalOpen).toHaveBeenCalledWith(false, currentNotice);
  });

  it('moves focus into the dialog when it opens', () => {
    render(<NoticeModal />);

    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: currentNotice.title }));
  });

  it('confirms the current notice when Escape is pressed', () => {
    render(<NoticeModal />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(noticeState.setNoticeModalOpen).toHaveBeenCalledWith(false, currentNotice);
  });

  it('renders nothing when closed or without a notice', () => {
    noticeState.isNoticeModalOpen = false;
    const { rerender } = render(<NoticeModal />);
    expect(screen.queryByRole('dialog')).toBeNull();

    noticeState.isNoticeModalOpen = true;
    noticeState.currentNoticeDetail = null;
    rerender(<NoticeModal />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
