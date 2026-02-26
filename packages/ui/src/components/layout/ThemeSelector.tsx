import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Palette } from 'lucide-react';
import { useUIStore } from '../../store/uiState';
import { getThemeList, useTheme } from '../../themes/index';

export function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const setTheme = useUIStore((s) => s.setTheme);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themes = getThemeList();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-command-accent rounded-sm transition-colors text-sm text-gray-300"
        onClick={() => setOpen(!open)}
        aria-label={`Theme: ${theme.name}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Palette className="w-4 h-4" aria-hidden="true" />
        <span className="text-xs hidden lg:inline">{theme.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-command-panel border border-command-border rounded-lg shadow-lg py-1 min-w-[200px] z-50">
          <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider border-b border-command-border">
            Themes
          </div>
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-command-accent transition-colors flex items-center gap-2 ${
                theme.id === t.id ? 'text-hud-green bg-hud-green/10' : 'text-gray-300'
              }`}
              role="option"
              aria-selected={theme.id === t.id}
            >
              <span className="flex-1">
                <span className="block">{t.name}</span>
                <span className="block text-[10px] text-gray-500">{t.description}</span>
              </span>
              {theme.id === t.id && (
                <span className="text-hud-green">&#10003;</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
