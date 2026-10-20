import '@testing-library/jest-dom/extend-expect';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import CompactAction from './CompactAction';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
  Spinner: () => <span data-testid="spinner" />,
  TooltipAnchor: ({ render }: { render: React.ReactNode }) => render,
}));

describe('CompactAction', () => {
  it('runs the compact command when enabled', async () => {
    const compact = jest.fn();
    render(<CompactAction compact={compact} canCompact isCompacting={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'com_ui_context_compact' }));

    expect(compact).toHaveBeenCalledTimes(1);
  });

  it('shows a busy disabled state while compacting', () => {
    render(<CompactAction compact={jest.fn()} canCompact={false} isCompacting />);

    expect(screen.getByRole('button', { name: 'com_ui_context_compacting' })).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
