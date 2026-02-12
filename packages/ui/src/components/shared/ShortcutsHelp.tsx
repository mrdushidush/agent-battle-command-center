import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutItem {
  key: string;
  description: string;
}

interface ShortcutsHelpProps {
  shortcuts: ShortcutItem[];
}

export function ShortcutsHelp({ shortcuts }: ShortcutsHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleShowHelp = () => setIsOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('show-shortcuts-help', handleShowHelp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('show-shortcuts-help', handleShowHelp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-command-panel border border-command-border rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-command-border">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-hud-green" />
            <h2 className="font-display text-lg uppercase tracking-wider">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-command-accent rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 rounded bg-command-accent/50"
            >
              <span className="text-gray-300">{shortcut.description}</span>
              <kbd className="px-2 py-1 bg-command-panel border border-command-border rounded text-hud-green font-mono text-sm">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-command-border text-center text-sm text-gray-500">
          Press <kbd className="px-1 py-0.5 bg-command-accent rounded text-hud-green">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
