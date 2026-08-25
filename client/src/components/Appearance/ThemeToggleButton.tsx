import { useContext } from 'react';
import { Sun, Moon } from 'lucide-react';
import { ThemeContext, isDark, Button, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';

export const ThemeToggleButton = () => {
  const localize = useLocalize();
  const { theme, setTheme } = useContext(ThemeContext);
  const dark = isDark(theme);

  const label = localize('com_ui_toggle_theme');

  return (
    <TooltipAnchor
      description={label}
      render={
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9 flex-shrink-0 rounded-xl bg-presentation hover:bg-surface-active-alt"
          aria-label={label}
          aria-pressed={dark}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      }
    />
  );
};

export default ThemeToggleButton;
