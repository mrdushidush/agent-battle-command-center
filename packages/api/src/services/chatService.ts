import { config } from '../config.js';
import { prisma } from '../db/client.js';
import type { Server as SocketIOServer } from 'socket.io';
import type { Conversation, ChatMessage } from '../types/index.js';
import type { OrchestratorService } from './orchestratorService.js';

interface ChatStreamMessage {
  chunk?: string;
  done?: boolean;
}

export class ChatService {
  private baseUrl: string;
  private io: SocketIOServer;
  private orchestratorService: OrchestratorService | null = null;

  constructor(io: SocketIOServer) {
    this.baseUrl = config.agents.url;
    this.io = io;
  }

  /**
   * Inject orchestrator service (called from index.ts after both are instantiated).
   * Avoids circular dependency.
   */
  setOrchestratorService(service: OrchestratorService): void {
    this.orchestratorService = service;
  }

  async createConversation(
    agentId: string,
    taskId?: string,
    title?: string
  ): Promise<Conversation> {
    const conversation = await prisma.conversation.create({
      data: {
        agentId,
        taskId,
        title,
      },
      include: {
        messages: true,
      },
    });

    return this.mapConversation(conversation);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) return null;
    return this.mapConversation(conversation);
  }

  async listConversations(agentId?: string): Promise<Conversation[]> {
    const conversations = await prisma.conversation.findMany({
      where: agentId ? { agentId } : undefined,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((c) => this.mapConversation(c));
  }

  async deleteConversation(id: string): Promise<void> {
    await prisma.conversation.delete({
      where: { id },
    });
  }

  async sendMessage(conversationId: string, content: string): Promise<void> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'user',
        content,
      },
    });

    // ── 1. Check for mission awaiting approval on this conversation ────
    if (this.orchestratorService) {
      const activeMission = await prisma.mission.findFirst({
        where: { conversationId, status: 'awaiting_approval' },
      });

      if (activeMission) {
        const normalized = content.trim().toLowerCase();
        if (['approve', 'yes', 'lgtm', 'looks good'].includes(normalized)) {
          await this.orchestratorService.approveMission(activeMission.id);
        } else if (['reject', 'no', 'cancel'].includes(normalized)) {
          await this.orchestratorService.rejectMission(activeMission.id, content);
        } else {
          await this.postNonStreamingMessage(
            conversationId,
            'Type **"approve"** to accept the mission, or **"reject"** to cancel it. You can also describe specific changes needed.',
          );
        }

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
        return;
      }
    }

    // ── 2. CTO conversation → start new mission ────────────────────────
    if (this.orchestratorService && conversation.agentId.startsWith('cto')) {
      // Check if there's already an active mission on this conversation
      const existingMission = await prisma.mission.findFirst({
        where: {
          conversationId,
          status: { in: ['decomposing', 'executing', 'reviewing'] },
        },
      });

      if (existingMission) {
        await this.postNonStreamingMessage(
          conversationId,
          '⏳ A mission is already in progress on this conversation. Please wait for it to complete.',
        );
      } else {
        await this.orchestratorService.startMission({
          prompt: content,
          conversationId,
          autoApprove: false,
        });
      }

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return;
    }

    // ── 3. Default: existing streaming chat (coder/qa agents) ──────────

    // Get task context if linked
    let taskContext: string | undefined;
    if (conversation.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: conversation.taskId },
      });
      if (task) {
        taskContext = `Task: ${task.title}\nDescription: ${task.description || 'No description'}`;
      }
    }

    // Prepare messages for the agent
    const messages = [
      ...conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content },
    ];

    // Create placeholder for assistant message
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: '',
      },
    });

    // Stream response from Python agent
    try {
      await this.streamChatResponse(
        conversationId,
        assistantMessage.id,
        conversation.agentId,
        messages,
        taskContext
      );
    } catch (error) {
      // Emit error event
      this.io.emit('chat_error', {
        type: 'chat_error',
        payload: {
          conversationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      });

      // Update message with error
      await prisma.chatMessage.update({
        where: { id: assistantMessage.id },
        data: { content: '[Error: Failed to get response]' },
      });
    }

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  /**
   * Post a non-streaming assistant message and emit via WebSocket.
   */
  private async postNonStreamingMessage(conversationId: string, content: string): Promise<void> {
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content,
      },
    });

    this.io.emit('chat_message_complete', {
      type: 'chat_message_complete',
      payload: {
        conversationId,
        messageId: message.id,
        fullContent: content,
      },
      timestamp: new Date(),
    });
  }

  private async streamChatResponse(
    conversationId: string,
    messageId: string,
    agentId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    taskContext?: string
  ): Promise<void> {
    const agentType = agentId.includes('coder') ? 'coder' : 'qa';

    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_type: agentType,
        messages,
        stream: true,
        task_context: taskContext,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chat request failed: ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    let fullContent = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as ChatStreamMessage;

              if (data.chunk) {
                fullContent += data.chunk;

                // Emit chunk event
                this.io.emit('chat_message_chunk', {
                  type: 'chat_message_chunk',
                  payload: {
                    conversationId,
                    messageId,
                    chunk: data.chunk,
                  },
                  timestamp: new Date(),
                });
              }

              if (data.done) {
                // Save final content
                await prisma.chatMessage.update({
                  where: { id: messageId },
                  data: { content: fullContent },
                });

                // Emit complete event
                this.io.emit('chat_message_complete', {
                  type: 'chat_message_complete',
                  payload: {
                    conversationId,
                    messageId,
                    fullContent,
                  },
                  timestamp: new Date(),
                });
              }
            } catch {
              // Ignore parse errors for partial data
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private mapConversation(conversation: {
    id: string;
    agentId: string;
    taskId: string | null;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
    messages: Array<{
      id: string;
      conversationId: string;
      role: string;
      content: string;
      createdAt: Date;
    }>;
  }): Conversation {
    return {
      id: conversation.id,
      agentId: conversation.agentId,
      taskId: conversation.taskId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }
}
