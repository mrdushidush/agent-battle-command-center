/**
 * Model Resolver Service
 *
 * Resolves per-agent model overrides into concrete execution parameters.
 * When an agent has a preferredModel other than 'auto', this service
 * translates it into the useClaude/model/env/resourceType values needed
 * by the task executor.
 */

import type { ModelOverride } from '@abcc/shared';
import type { ResourceType } from './resourcePool.js';

export interface ResolvedModel {
  useClaude: boolean;
  model: string;
  env?: Record<string, string>;
  resourceType: ResourceType | 'grok';
}

/**
 * Check if Grok (xAI) API is available
 */
export function isGrokEnabled(): boolean {
  return !!(process.env.XAI_API_KEY && process.env.XAI_API_KEY.length > 0);
}

/**
 * Resolve a model override into concrete execution parameters.
 * Returns null for 'auto' (caller should use default routing).
 */
export function resolveModelOverride(
  preferredModel: ModelOverride | string | undefined,
  complexity: number
): ResolvedModel | null {
  if (!preferredModel || preferredModel === 'auto') {
    return null;
  }

  switch (preferredModel) {
    case 'ollama': {
      // Dynamic context routing by complexity (16K default, 32K for C7+)
      // 8K context deprecated - insufficient for complex multi-component projects
      const model = complexity >= 7
        ? 'qwen2.5-coder:32k'
        : 'qwen2.5-coder:16k';
      return {
        useClaude: false,
        model,
        resourceType: 'ollama',
      };
    }

    case 'grok':
      return {
        useClaude: false,
        model: 'xai/grok-3-mini-fast',
        resourceType: 'grok',
      };

    case 'haiku':
      return {
        useClaude: true,
        model: 'anthropic/claude-haiku-4-5-20251001',
        resourceType: 'claude',
      };

    case 'sonnet':
      return {
        useClaude: true,
        model: 'anthropic/claude-sonnet-4-20250514',
        resourceType: 'claude',
      };

    case 'opus':
      return {
        useClaude: true,
        model: 'anthropic/claude-opus-4-5-20251101',
        resourceType: 'claude',
      };

    default:
      console.warn(`[ModelResolver] Unknown model override: ${preferredModel}, falling back to auto`);
      return null;
  }
}
