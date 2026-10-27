import { fireEvent, render, screen } from '@testing-library/react';
import type { SettingDefinition } from 'librechat-data-provider';
import ReasoningControl, { getScopedReasoningOverride } from '../ReasoningControl';

describe('ReasoningControl', () => {
  it('emits a selected enum value and supports returning to auto', () => {
    const onChange = jest.fn();
    const setting: SettingDefinition = {
      key: 'reasoning_effort',
      label: 'com_endpoint_reasoning_effort',
      type: 'enum',
      options: ['', 'low', 'high'],
      enumMappings: { low: 'com_ui_low', high: 'com_ui_high' },
      component: 'slider',
    };
    render(<ReasoningControl setting={setting} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'high' } });
    expect(onChange).toHaveBeenLastCalledWith({ key: 'reasoning_effort', value: 'high' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('emits numeric thinking budgets and can clear back to auto', () => {
    const onChange = jest.fn();
    const setting: SettingDefinition = {
      key: 'thinkingBudget',
      label: 'com_endpoint_thinking_budget',
      type: 'number',
      range: { min: 0, max: 32768, step: 1024 },
      component: 'input',
    };
    render(<ReasoningControl setting={setting} onChange={onChange} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '32768');
    fireEvent.change(input, { target: { value: '4096' } });
    expect(onChange).toHaveBeenLastCalledWith({ key: 'thinkingBudget', value: 4096 });
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('does not offer Auto when the provider requires a reasoning effort', () => {
    render(
      <ReasoningControl
        setting={{
          key: 'reasoning_effort',
          type: 'enum',
          options: ['low', 'high'],
          component: 'slider',
        }}
        autoAllowed={false}
        onChange={jest.fn()}
      />,
    );
    expect(screen.queryByRole('option', { name: 'Auto' })).not.toBeInTheDocument();
  });

  it('does not expose an override bound to a different pane or target', () => {
    const scoped = {
      targetKey: 'pane-0:openAI:o3-mini',
      override: { key: 'reasoning_effort', value: 'high' },
    } as const;
    expect(getScopedReasoningOverride(scoped, 'pane-0:openAI:o3-mini')).toEqual(scoped.override);
    expect(getScopedReasoningOverride(scoped, 'pane-1:openAI:o3-mini')).toBeUndefined();
    expect(getScopedReasoningOverride(scoped, 'pane-0:openAI:gpt-4.1')).toBeUndefined();
  });
});
