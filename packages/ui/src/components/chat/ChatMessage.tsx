import { User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatRole } from '@abcc/shared';
import type { Components } from 'react-markdown';

interface ChatMessageProps {
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  agentType?: 'coder' | 'qa' | 'cto';
}

// Military rank icons as SVG components
function GeneralStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 6.9L12 17.8l-6.2 3.2L7 14.1 2 9.2l7.1-0.9L12 2z" />
    </svg>
  );
}

function MajorChevrons({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 15 12 9 20 15" />
      <polyline points="4 20 12 14 20 20" />
    </svg>
  );
}

function PrivateChevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 18 12 10 20 18" />
    </svg>
  );
}

const RANK_CONFIG = {
  cto: { Icon: GeneralStar, color: 'text-hud-amber', bg: 'bg-hud-amber/20', label: 'General' },
  qa: { Icon: MajorChevrons, color: 'text-hud-green', bg: 'bg-hud-green/20', label: 'Major' },
  coder: { Icon: PrivateChevron, color: 'text-hud-blue', bg: 'bg-hud-blue/20', label: 'Private' },
} as const;

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="font-display text-lg text-hud-green mt-3 mb-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display text-base text-hud-green mt-2 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display text-sm text-hud-green mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-gray-200 mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-gray-100 font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-gray-300 italic">{children}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-hud-blue underline hover:text-hud-blue/80 transition-colors"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-hud-amber/50 pl-3 my-2 text-gray-300">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-2 space-y-0.5 text-gray-200">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-2 space-y-0.5 text-gray-200">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-200">{children}</li>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block bg-command-bg border border-command-border rounded px-3 py-2 my-2 text-hud-green/90 text-xs font-mono overflow-x-auto whitespace-pre">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-command-accent px-1.5 py-0.5 rounded text-hud-amber text-xs font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-command-bg border border-command-border rounded my-2 overflow-x-auto">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs border-collapse border border-command-border w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-command-border px-2 py-1 text-left text-hud-green font-display text-xs">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-command-border px-2 py-1 text-gray-300 text-xs">{children}</td>
  ),
  hr: () => <hr className="border-command-border my-3" />,
};

export function ChatMessage({ role, content, isStreaming, timestamp, agentType }: ChatMessageProps) {
  const isUser = role === 'user';
  const rank = !isUser && agentType ? RANK_CONFIG[agentType] : null;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-hud-blue/20' : rank?.bg || 'bg-hud-green/20'
        }`}
        title={rank?.label}
      >
        {isUser ? (
          <User className="w-4 h-4 text-hud-blue" />
        ) : rank ? (
          <rank.Icon className={`w-4 h-4 ${rank.color}`} />
        ) : (
          <PrivateChevron className="w-4 h-4 text-hud-green" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-hud-blue/20 border border-hud-blue/30'
            : 'bg-command-accent border border-command-border'
        }`}
      >
        <div className="text-sm wrap-break-word">
          {isUser ? (
            <span className="text-gray-200 whitespace-pre-wrap">{content}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          )}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-hud-green animate-pulse" />
          )}
        </div>
        {timestamp && (
          <div className="text-xs text-gray-500 mt-1">
            {new Date(timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
