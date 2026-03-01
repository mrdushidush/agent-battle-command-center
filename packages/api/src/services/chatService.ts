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
  private pendingClarifications: Map<string, { originalPrompt: string; conversationId: string }> = new Map();
  private pendingPublish: Map<string, string> = new Map(); // conversationId -> missionId

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

    // ── 0. Check for pending publish request ────────────────────────────────
    if (this.pendingPublish.has(conversationId)) {
      const missionId = this.pendingPublish.get(conversationId)!;
      const normalized = content.trim().toLowerCase();

      if (normalized === 'zip' || normalized === 'download') {
        this.pendingPublish.delete(conversationId);
        try {
          const downloadUrl = `${config.api.publicUrl}/api/missions/${missionId}/download`;
          await this.postNonStreamingMessage(
            conversationId,
            `📦 **[Download Mission Files](${downloadUrl})** — Click the link to get your code as a ZIP bundle.`,
          );
        } catch (error) {
          console.error('Failed to generate download link:', error);
          await this.postNonStreamingMessage(conversationId, '❌ Failed to generate download link.');
        }

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
        return;
      } else if (normalized === 'github') {
        this.pendingPublish.delete(conversationId);
        const githubToken = process.env.GITHUB_TOKEN;

        if (!githubToken) {
          await this.postNonStreamingMessage(
            conversationId,
            '⚠️ **GitHub integration not configured.** Set `GITHUB_TOKEN` environment variable to enable repository creation.',
          );
        } else {
          try {
            // Get mission files
            if (!this.orchestratorService) {
              throw new Error('Orchestrator service not initialized');
            }
            const files = await this.orchestratorService.getMissionFiles(missionId);
            const mission = await prisma.mission.findUnique({ where: { id: missionId } });

            if (!mission) {
              throw new Error('Mission not found');
            }

            // Create GitHub repo and push files
            const repoUrl = await this.createGitHubRepository(
              githubToken,
              mission.prompt,
              files
            );

            await this.postNonStreamingMessage(
              conversationId,
              `🚀 **[GitHub Repository Created](${repoUrl})** — Your code has been pushed to a new GitHub repository.`,
            );
          } catch (error) {
            console.error('Failed to create GitHub repository:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            await this.postNonStreamingMessage(
              conversationId,
              `❌ Failed to create GitHub repository: ${errorMsg}`,
            );
          }
        }

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
        return;
      } else {
        await this.postNonStreamingMessage(
          conversationId,
          'Reply **zip** to download or **github** to create a repository.',
        );

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
        return;
      }
    }

    // ── 1. Check for mission awaiting approval on this conversation ────
    if (this.orchestratorService) {
      const activeMission = await prisma.mission.findFirst({
        where: { conversationId, status: 'awaiting_approval' },
      });

      if (activeMission) {
        const normalized = content.trim().toLowerCase();

        // Check if this is a quoted message (retry instruction)
        if (content.trim().startsWith('>')) {
          // Extract the instruction part after the quote block
          const lines = content.split('\n');
          let instructionStart = -1;
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i].startsWith('>')) {
              instructionStart = i;
              break;
            }
          }

          if (instructionStart > 0 && instructionStart < lines.length) {
            const instruction = lines.slice(instructionStart).join('\n').trim();
            if (instruction && activeMission.failedCount && activeMission.failedCount > 0) {
              // This is a retry instruction for failed tasks
              await this.orchestratorService.retryFailedSubtasks(activeMission.id, instruction);
            } else {
              await this.postNonStreamingMessage(
                conversationId,
                '⚠️ No failed subtasks to retry. Type **"approve"** to accept the mission.',
              );
            }
          } else {
            await this.postNonStreamingMessage(
              conversationId,
              'Please provide instructions for the retry after the quoted message.',
            );
          }
        } else if (['approve', 'yes', 'lgtm', 'looks good'].includes(normalized)) {
          await this.orchestratorService.approveMission(activeMission.id);
          // Set pending publish for next interaction
          this.pendingPublish.set(conversationId, activeMission.id);
        } else if (['reject', 'no', 'cancel'].includes(normalized)) {
          await this.orchestratorService.rejectMission(activeMission.id, content);
        } else {
          await this.postNonStreamingMessage(
            conversationId,
            'Type **"approve"** to accept the mission, **"reject"** to cancel, or quote a failed task with retry instructions.',
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

    // ── 2. CTO conversation → clarification flow or start mission ────────
    if (this.orchestratorService && conversation.agentId.startsWith('cto')) {
      // Check if there's a pending clarification on this conversation
      if (this.pendingClarifications.has(conversationId)) {
        const pending = this.pendingClarifications.get(conversationId)!;
        this.pendingClarifications.delete(conversationId);

        const normalized = content.trim().toLowerCase();
        let finalPrompt = pending.originalPrompt;

        // If user typed anything other than "Let's Build" magic string, append as context
        if (normalized !== '__lets_build__') {
          finalPrompt += `\n\nUser context:\n${content}`;
        }

        // Start mission with potentially augmented prompt
        await this.orchestratorService.startMission({
          prompt: finalPrompt,
          conversationId,
          autoApprove: false,
        });
      } else {
        // Check if there's already an active mission on this conversation
        const existingMission = await prisma.mission.findFirst({
          where: {
            conversationId,
            status: { in: ['decomposing', 'executing', 'reviewing', 'awaiting_approval'] },
          },
        });

        if (existingMission) {
          await this.postNonStreamingMessage(
            conversationId,
            '⏳ A mission is already in progress on this conversation. Please wait for it to complete.',
          );
        } else {
          // Call /orchestrate/clarify to get adaptive questions
          try {
            const clarifyResponse = await fetch(`${this.baseUrl}/orchestrate/clarify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: content }),
            });

            if (!clarifyResponse.ok) {
              throw new Error(`Clarify failed: ${clarifyResponse.statusText}`);
            }

            const clarifyData = await clarifyResponse.json();

            if (clarifyData.questions && clarifyData.questions.length > 0) {
              // Save pending clarification
              this.pendingClarifications.set(conversationId, {
                originalPrompt: content,
                conversationId,
              });

              // Post questions to chat
              const questionsText = clarifyData.questions
                .map((q: string, i: number) => `${i + 1}. ${q}`)
                .join('\n');

              await this.postNonStreamingMessage(
                conversationId,
                `🤔 **I have some questions to clarify your request:**\n\n${questionsText}\n\nYou can answer these questions or click **"Let's Build"** to proceed as-is.`,
              );

              // Emit clarification event
              this.io.emit('clarification_requested', {
                type: 'clarification_requested',
                payload: {
                  conversationId,
                  questions: clarifyData.questions,
                },
                timestamp: new Date(),
              });
            } else {
              // No questions needed, start mission immediately
              await this.orchestratorService.startMission({
                prompt: content,
                conversationId,
                autoApprove: false,
              });
            }
          } catch (error) {
            console.error('Failed to clarify intent:', error);
            // Fallback: start mission without clarification
            await this.orchestratorService.startMission({
              prompt: content,
              conversationId,
              autoApprove: false,
            });
          }
        }
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
   * Create a GitHub repository and push mission files.
   */
  private async createGitHubRepository(
    githubToken: string,
    prompt: string,
    files: Record<string, string>
  ): Promise<string> {
    const repoName = `mission-${Date.now().toString(36).slice(-6)}`;
    const description = prompt.slice(0, 100);

    // Create repository via GitHub API
    const createRepoResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        description,
        private: false,
        auto_init: true,
      }),
    });

    if (!createRepoResponse.ok) {
      const error = await createRepoResponse.json();
      throw new Error(`GitHub API error: ${error.message || createRepoResponse.statusText}`);
    }

    const repo = (await createRepoResponse.json()) as { html_url: string; owner: { login: string }; name: string };

    // Push files to the repository (simplified: just create files via GitHub API)
    // In production, you'd use git/libgit2 or GitHub's contents API to commit files
    for (const [fileName, content] of Object.entries(files)) {
      const encodedContent = Buffer.from(content).toString('base64');

      const pushResponse = await fetch(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents/${fileName}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Add ${fileName}`,
            content: encodedContent,
          }),
        }
      );

      if (!pushResponse.ok) {
        console.error(`Failed to push file ${fileName}:`, await pushResponse.text());
        // Continue pushing other files even if one fails
      }
    }

    return repo.html_url;
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
