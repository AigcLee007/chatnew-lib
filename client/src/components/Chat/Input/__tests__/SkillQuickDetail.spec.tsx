import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';
import SkillQuickDetail from '../SkillQuickDetail';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    ({
      com_ui_skill_when_to_use: 'When to use',
      com_ui_skill_use_this: 'Use this skill',
      com_ui_skill_open_details: 'Open full details',
      com_ui_cancel: 'Cancel',
    })[key] ?? key,
}));
jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const skill = {
  _id: 'skill-1', name: 'paper-helper', displayTitle: 'Paper helper',
  description: 'Helps write papers', body: '---\nwhen-to-use: For papers\ninputs: Topic\noutputs: Draft\nexample: Try it\n---\nInstructions',
  author: 'user-1', authorName: 'Me', source: 'inline', version: 1, fileCount: 1,
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
} as never;

describe('SkillQuickDetail', () => {
  it('is read-only and exposes use and full-detail actions', () => {
    const onUse = jest.fn();
    const onOpenDetails = jest.fn();
    render(<SkillQuickDetail skill={skill} onUse={onUse} onOpenDetails={onOpenDetails} />);
    expect(screen.getByText('When to use')).toBeInTheDocument();
    expect(screen.getByText('Topic')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Try it')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use this skill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open full details' }));
    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
