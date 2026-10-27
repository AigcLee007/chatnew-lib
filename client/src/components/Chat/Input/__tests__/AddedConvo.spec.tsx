import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AddedConvo from '../AddedConvo';

jest.mock('~/data-provider', () => ({ useGetEndpointsQuery: () => ({ data: {} }) }));
jest.mock('~/Providers', () => ({ useAgentsMapContext: () => ({}) }));
jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/components/Endpoints', () => ({ EndpointIcon: () => null }));
jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  TooltipAnchor: ({ description, render }: { description: string; render: React.ReactElement }) =>
    jest
      .requireActual<typeof import('react')>('react')
      .cloneElement(render, { title: description }),
}));

describe('AddedConvo', () => {
  it('provides an explicit accessible close action for a model comparison', () => {
    const setAddedConvo = jest.fn();
    render(
      <AddedConvo
        addedConvo={{ endpoint: 'openAI', model: 'gpt-4o' } as never}
        setAddedConvo={setAddedConvo}
      />,
    );

    const close = screen.getByRole('button', { name: 'com_ui_close' });
    expect(close).toHaveAttribute('title', 'com_ui_close');
    fireEvent.click(close);
    expect(setAddedConvo).toHaveBeenCalledWith(null);
  });
});
