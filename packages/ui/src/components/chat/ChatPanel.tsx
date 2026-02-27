import { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, ChevronDown, Crosshair } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { MissionProgressTracker } from './MissionProgressTracker';
import { CTOWelcome } from './CTOWelcome';
import { useChat } from '../../hooks/useChat';
import { useUIStore } from '../../store/uiState';
import type { Agent } from '@abcc/shared';

interface ChatPanelProps {
  agents: Agent[];
  onClose: () => void;
}

function formatConversationDate(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` ${time}`;
}

export function ChatPanel({ agents, onClose }: ChatPanelProps) {
  const {
    conversations,
    activeConversation,
    streamingMessage,
    loading,
    error,
    fetchConversations,
    fetchConversation,
    createConversation,
    deleteConversation,
    sendMessage,
    selectConversation,
    handleStreamChunk,
    handleStreamComplete,
    handleStreamError,
  } = useChat();

  const { activeChatAgentId, setActiveChatAgent } = useUIStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showAgentSelect, setShowAgentSelect] = useState(false);

  // Get the currently selected agent
  const selectedAgent = agents.find((a) => a.id === activeChatAgentId) || agents[0];

  // Agent color helper
  const agentColor = (agent?: Agent) => {
    if (!agent) return '#6B7280';
    return agent.type === 'coder' ? '#3B82F6' : agent.type === 'cto' ? '#F59E0B' : '#10B981';
  };

  // Fetch conversations when panel opens or agent changes
  useEffect(() => {
    if (activeChatAgentId) {
      fetchConversations(activeChatAgentId);
    }
  }, [activeChatAgentId, fetchConversations]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, streamingMessage]);

  // WebSocket handlers
  useEffect(() => {
    (window as unknown as { chatHandlers?: object }).chatHandlers = {
      handleStreamChunk,
      handleStreamComplete,
      handleStreamError,
    };
    return () => {
      delete (window as unknown as { chatHandlers?: object }).chatHandlers;
    };
  }, [handleStreamChunk, handleStreamComplete, handleStreamError]);

  const handleNewConversation = async () => {
    if (!selectedAgent) return;
    try {
      await createConversation(selectedAgent.id);
    } catch {
      // Error handled in hook
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeConversation) {
      if (!selectedAgent) return;
      try {
        const conv = await createConversation(selectedAgent.id);
        await sendMessage(conv.id, content);
      } catch {
        // Error handled in hook
      }
    } else {
      try {
        await sendMessage(activeConversation.id, content);
      } catch {
        // Error handled in hook
      }
    }
  };

  const handleSelectConversation = async (id: string) => {
    try {
      await fetchConversation(id);
    } catch {
      // Error handled in hook
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
    } catch {
      // Error handled in hook
    }
  };

  const handleAgentSelect = (agent: Agent) => {
    setActiveChatAgent(agent.id);
    selectConversation(null);
    setShowAgentSelect(false);
  };

  return (
    <div className="h-full flex flex-col bg-command-panel">
      {/* Header — compact with inline agent selector */}
      <div className="p-3 border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crosshair className="w-4 h-4 text-hud-green" />
          <span className="font-display text-sm uppercase tracking-wider text-hud-green">
            Mission Control
          </span>

          {/* Inline Agent Selector */}
          <div className="relative">
            <button
              onClick={() => setShowAgentSelect(!showAgentSelect)}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-command-bg border border-command-border hover:border-hud-green/40 transition-colors text-xs"
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: agentColor(selectedAgent) }}
              />
              <span className="text-gray-300">{selectedAgent?.name || 'Agent'}</span>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>

            {showAgentSelect && (
              <div className="absolute top-full left-0 mt-1 bg-command-bg border border-command-border rounded-lg shadow-lg z-20 overflow-hidden min-w-[160px]">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAgentSelect(agent)}
                    className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-command-accent transition-colors text-left ${
                      agent.id === activeChatAgentId ? 'bg-command-accent' : ''
                    }`}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: agentColor(agent) }}
                    />
                    <span className="text-sm text-gray-200">{agent.name}</span>
                    <span className="text-xs text-gray-500 capitalize">({agent.type})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            className="p-1 hover:bg-command-accent rounded-sm transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-command-accent rounded-sm transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Conversation List (when no active conversation) */}
      {!activeConversation && (
        <>
          {loading && (
            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
          )}
          {error && (
            <div className="p-4 text-center text-hud-red text-sm">{error}</div>
          )}

          {/* No conversations: show CTO Welcome hero */}
          {!loading && conversations.length === 0 && (
            <CTOWelcome onSendMessage={handleSendMessage} />
          )}

          {/* Has conversations: show list */}
          {!loading && conversations.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-command-accent border-b border-command-border transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">
                      {conv.title || 'Untitled mission'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatConversationDate(conv.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-hud-red/20 rounded-sm transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-hud-red" />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Quick-start input */}
          <ChatInput
            onSend={handleSendMessage}
            placeholder="What do you want to build?"
          />
        </>
      )}

      {/* Active Conversation */}
      {activeConversation && (
        <>
          {/* Back button */}
          <div className="p-2 border-b border-command-border">
            <button
              onClick={() => selectConversation(null)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              &larr; Back to conversations
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {activeConversation.messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.createdAt}
              />
            ))}
            {streamingMessage && streamingMessage.isStreaming && (
              <ChatMessage
                role="assistant"
                content={streamingMessage.content}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Mission Progress Tracker */}
          <MissionProgressTracker conversationId={activeConversation.id} />

          {/* Input */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={streamingMessage?.isStreaming}
            placeholder={`Message ${selectedAgent?.name || 'agent'}...`}
          />
        </>
      )}
    </div>
  );
}
