import { Terminal } from 'lucide-react';

interface CTOWelcomeProps {
  onSendMessage: (message: string) => void;
}

const EXAMPLE_MISSIONS = [
  {
    label: 'Calculator module',
    prompt: 'Create a calculator module with add, subtract, multiply, and divide functions',
  },
  {
    label: 'Todo list API',
    prompt: 'Build a todo list with add, remove, complete, and list functions',
  },
  {
    label: 'String utilities',
    prompt: 'Create a string utility library with reverse, capitalize, truncate, and slug functions',
  },
];

export function CTOWelcome({ onSendMessage }: CTOWelcomeProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      {/* Icon */}
      <div className="w-14 h-14 rounded-full bg-hud-amber/15 border border-hud-amber/30 flex items-center justify-center mb-5">
        <Terminal className="w-7 h-7 text-hud-amber" />
      </div>

      {/* Heading */}
      <h2 className="font-display text-lg uppercase tracking-wider text-hud-green mb-2">
        Mission Briefing
      </h2>

      {/* Description */}
      <p className="text-sm text-gray-400 text-center mb-6 max-w-[320px] leading-relaxed">
        Describe what you want to build. The CTO will decompose it into subtasks, execute them with local AI, and review the results.
      </p>

      {/* Example Missions */}
      <div className="w-full space-y-2">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 text-center">
          Example Missions
        </div>
        {EXAMPLE_MISSIONS.map((example) => (
          <button
            key={example.label}
            onClick={() => onSendMessage(example.prompt)}
            className="w-full text-left px-4 py-3 rounded-lg border border-command-border bg-command-bg/50 hover:border-hud-green/30 hover:bg-command-accent transition-colors group"
          >
            <div className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
              {example.prompt}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
