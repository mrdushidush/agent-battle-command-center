import { useEffect, useRef, useState, useMemo } from 'react';
import { X, MessageSquare, Plus, Trash2, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '../../hooks/useChat';
import { useUIStore } from '../../store/uiState';
import type { Agent } from '@abcc/shared';

interface ChatPanelProps {
  agents: Agent[];
  onClose: () => void;
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

  const { activeChatAgentId, setActiveChatAgent, missions } = useUIStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showAgentSelect, setShowAgentSelect] = useState(false);

  // Check if current conversation has a mission awaiting approval
  const missionAwaitingApproval = useMemo(() => {
    if (!activeConversation) return null;
    return Object.entries(missions).find(
      ([, m]) => m.status === 'awaiting_approval'
    )?.[0] || null;
  }, [activeConversation, missions]);

  // Get the currently selected agent
  const selectedAgent = agents.find((a) => a.id === activeChatAgentId) || agents[0];

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

  // Set up WebSocket handlers (these would be connected via useSocket in parent)
  useEffect(() => {
    // Expose handlers for parent to call
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
      // Create new conversation first
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
      {/* Header */}
      <div className="p-3 border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-hud-green" />
          <span className="font-display text-sm uppercase tracking-wider">Chat</span>
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

      {/* Agent Selector */}
      <div className="p-2 border-b border-command-border">
        <div className="relative">
          <button
            onClick={() => setShowAgentSelect(!showAgentSelect)}
            className="w-full flex items-center justify-between px-3 py-2 bg-command-bg border border-command-border rounded-lg hover:border-hud-green/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    selectedAgent?.type === 'coder' ? '#3B82F6' : selectedAgent?.type === 'cto' ? '#F59E0B' : '#10B981',
                }}
              />
              <span className="text-sm text-gray-200">
                {selectedAgent?.name || 'Select Agent'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {showAgentSelect && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-command-bg border border-command-border rounded-lg shadow-lg z-10 overflow-hidden">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-command-accent transition-colors text-left"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        agent.type === 'coder' ? '#3B82F6' : agent.type === 'cto' ? '#F59E0B' : '#10B981',
                    }}
                  />
                  <span className="text-sm text-gray-200">{agent.name}</span>
                  <span className="text-xs text-gray-500 capitalize">
                    ({agent.type})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversation List (collapsed view) */}
      {!activeConversation && (
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
          )}
          {error && (
            <div className="p-4 text-center text-hud-red text-sm">{error}</div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No conversations yet.
              <br />
              Start a new one!
            </div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-command-accent border-b border-command-border transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">
                  {conv.title || 'Untitled conversation'}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(conv.updatedAt).toLocaleDateString()}
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

          {/* Mission Approval Bar */}
          {missionAwaitingApproval && (
            <div className="mx-3 mb-2 p-3 border border-amber-500/30 bg-amber-500/5 rounded-lg flex items-center justify-between gap-2">
              <span className="text-sm text-amber-400">Mission awaiting approval</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSendMessage('approve')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded text-sm transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => handleSendMessage('reject')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded text-sm transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={streamingMessage?.isStreaming}
            placeholder={`Message ${selectedAgent?.name || 'agent'}...`}
          />
        </>
      )}

      {/* Quick message when no conversation */}
      {!activeConversation && (
        <ChatInput
          onSend={handleSendMessage}
          placeholder={`Start a chat with ${selectedAgent?.name || 'agent'}...`}
        />
      )}
    </div>
  );
}
