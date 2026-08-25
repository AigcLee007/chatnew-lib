import 'test/matchMedia.mock';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { ThemeContext } from '@librechat/client';
import { ThemeToggleButton } from './ThemeToggleButton';

describe('ThemeToggleButton', () => {
  const renderWithTheme = (theme: 'dark' | 'light' | 'system') => {
    const setTheme = jest.fn();

    const utils = render(
      <ThemeContext.Provider
        value={{
          theme,
          setTheme,
          setThemeRGB: jest.fn(),
          setThemeDefinition: jest.fn(),
          setThemeName: jest.fn(),
          resetTheme: jest.fn(),
        }}
      >
        <ThemeToggleButton />
      </ThemeContext.Provider>,
    );

    return { ...utils, setTheme };
  };

  it('switches from dark to light when clicked', () => {
    const { getByRole, setTheme } = renderWithTheme('dark');

    fireEvent.click(getByRole('button', { name: /theme/i }));

    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('switches from light to dark when clicked', () => {
    const { getByRole, setTheme } = renderWithTheme('light');

    fireEvent.click(getByRole('button', { name: /theme/i }));

    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('switches from system to dark when the system preference is light', () => {
    const { getByRole, setTheme } = renderWithTheme('system');

    fireEvent.click(getByRole('button', { name: /theme/i }));

    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
