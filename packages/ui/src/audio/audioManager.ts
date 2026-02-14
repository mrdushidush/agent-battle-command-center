/**
 * Audio Manager - Singleton for managing voice playback
 * Prevents audio overlap and manages volume/mute state
 */

import { VoiceEvent, getVoiceLineFromPack, AgentVoiceType, VoicePackId } from './voicePacks';

// Use window object to persist singleton across HMR and React.StrictMode
declare global {
  interface Window {
    __ABCC_AUDIO_MANAGER__?: AudioManager;
  }
}

interface QueuedSound {
  audioFile: string;
  text: string;
  priority: number;
}

class AudioManager {
  private static instance: AudioManager | null = null;
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private queue: QueuedSound[] = [];
  private isPlaying = false;
  private volume = 0.7;
  private muted = false;
  private selectedPack: VoicePackId = 'tactical';

  private constructor() {
    // Initialize AudioContext on first user interaction
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this.initAudioContext.bind(this), { once: true });
    }
  }

  public static getInstance(): AudioManager {
    // Check window global first (survives HMR and StrictMode)
    if (typeof window !== 'undefined' && window.__ABCC_AUDIO_MANAGER__) {
      AudioManager.instance = window.__ABCC_AUDIO_MANAGER__;
      return AudioManager.instance;
    }

    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
      // Store on window for persistence
      if (typeof window !== 'undefined') {
        window.__ABCC_AUDIO_MANAGER__ = AudioManager.instance;
      }
    }
    return AudioManager.instance;
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.muted ? 0 : this.volume;
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.currentAudio) {
      this.currentAudio.volume = this.muted ? 0 : this.volume;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVoicePack(packId: VoicePackId) {
    this.selectedPack = packId;
  }

  public getVoicePack(): VoicePackId {
    return this.selectedPack;
  }

  /**
   * Play a voice line for a specific event
   * Note: agentType reserved for future agent-specific voice packs
   */
  public playEvent(event: VoiceEvent, _agentType: AgentVoiceType = 'default', priority: number = 5) {
    const voiceLine = getVoiceLineFromPack(this.selectedPack, event);
    this.playSound(voiceLine.audioFile, voiceLine.text, priority);
  }

  /**
   * Play a voice line from a specific pack
   * Note: agentType reserved for future agent-specific voice packs
   */
  public playEventWithPack(packId: VoicePackId, event: VoiceEvent, _agentType: AgentVoiceType = 'default', priority: number = 5) {
    const voiceLine = getVoiceLineFromPack(packId, event);
    this.playSound(voiceLine.audioFile, voiceLine.text, priority);
  }

  /**
   * Play a sound file directly
   */
  public playSound(audioFile: string, text: string = '', priority: number = 5) {
    // Add to queue
    this.queue.push({ audioFile, text, priority });

    // Sort queue by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);

    // Start playing if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Play the next sound in the queue
   */
  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const sound = this.queue.shift()!;

    try {
      // Create audio element
      const audio = new Audio(sound.audioFile);
      audio.volume = this.muted ? 0 : this.volume;

      this.currentAudio = audio;

      // Play and wait for completion
      await audio.play();

      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => {
          console.warn(`[AudioManager] Failed to play: ${sound.audioFile}`);
          resolve();
        };
      });

    } catch (error) {
      console.warn(`[AudioManager] Error playing sound:`, error);
    } finally {
      this.currentAudio = null;
      // Play next sound after a short delay
      setTimeout(() => this.playNext(), 100);
    }
  }

  /**
   * Clear the queue and stop current playback
   */
  public stop() {
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }

  /**
   * Clear the queue without stopping current playback
   */
  public clearQueue() {
    this.queue = [];
  }
}

// Export singleton instance
export const audioManager = AudioManager.getInstance();

// Convenience functions
export function playTaskAssigned(agentType?: AgentVoiceType) {
  audioManager.playEvent('task_assigned', agentType, 7);
}

export function playTaskInProgress(agentType?: AgentVoiceType) {
  audioManager.playEvent('task_in_progress', agentType, 5);
}

export function playTaskMilestone(agentType?: AgentVoiceType) {
  audioManager.playEvent('task_milestone', agentType, 6);
}

export function playTaskCompleted(agentType?: AgentVoiceType) {
  audioManager.playEvent('task_completed', agentType, 8);
}

export function playTaskFailed(agentType?: AgentVoiceType) {
  audioManager.playEvent('task_failed', agentType, 9);
}

export function playAgentStuck(agentType?: AgentVoiceType) {
  audioManager.playEvent('agent_stuck', agentType, 10);
}

export function playLoopDetected(agentType?: AgentVoiceType) {
  audioManager.playEvent('loop_detected', agentType, 10);
}

export function playOpusReview(agentType?: AgentVoiceType) {
  audioManager.playEvent('opus_review', agentType, 6);
}

export function playDecomposition(agentType?: AgentVoiceType) {
  audioManager.playEvent('decomposition', agentType, 6);
}
