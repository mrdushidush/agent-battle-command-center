import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatRole } from '@abcc/shared';
import type { Components } from 'react-markdown';

interface ChatMessageProps {
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
}

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

export function ChatMessage({ role, content, isStreaming, timestamp }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-hud-blue/20' : 'bg-hud-green/20'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-hud-blue" />
        ) : (
          <Bot className="w-4 h-4 text-hud-green" />
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
