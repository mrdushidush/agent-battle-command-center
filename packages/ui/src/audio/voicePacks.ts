/**
 * C&C Red Alert style voice packs for agent events
 */

export type VoiceEvent =
  | 'task_assigned'
  | 'task_in_progress'
  | 'task_milestone'
  | 'task_completed'
  | 'task_failed'
  | 'agent_stuck'
  | 'loop_detected';

export type AgentVoiceType = 'coder' | 'qa' | 'cto' | 'default';

export interface VoiceLine {
  event: VoiceEvent;
  audioFile: string;
  text: string;
}

/**
 * Default voice pack - C&C Red Alert style (using actual user audio files)
 */
export const defaultVoicePack: Record<VoiceEvent, VoiceLine[]> = {
  task_assigned: [
    { event: 'task_assigned', audioFile: '/audio/conscript-reporting.mp3', text: 'Conscript reporting' },
    { event: 'task_assigned', audioFile: '/audio/agent-ready.mp3', text: 'Agent ready' },
    { event: 'task_assigned', audioFile: '/audio/aye-commander.mp3', text: 'Aye commander' },
    { event: 'task_assigned', audioFile: '/audio/assignment-sir.mp3', text: 'Assignment sir' },
    { event: 'task_assigned', audioFile: '/audio/order-received.mp3', text: 'Order received' },
    { event: 'task_assigned', audioFile: '/audio/mission-sir.mp3', text: 'Mission sir' },
    { event: 'task_assigned', audioFile: '/audio/anytime-boss.mp3', text: 'Anytime boss' },
    { event: 'task_assigned', audioFile: '/audio/good-to-go.mp3', text: 'Good to go' },
  ],
  task_in_progress: [
    { event: 'task_in_progress', audioFile: '/audio/operation-underway.mp3', text: 'Operation underway' },
    { event: 'task_in_progress', audioFile: '/audio/analyzing-schematics.mp3', text: 'Analyzing schematics' },
    { event: 'task_in_progress', audioFile: '/audio/obtaining-intelligence.mp3', text: 'Obtaining intelligence' },
    { event: 'task_in_progress', audioFile: '/audio/on-our-way-sir.mp3', text: 'On our way sir' },
    { event: 'task_in_progress', audioFile: '/audio/main-engines-engaged.mp3', text: 'Main engines engaged' },
  ],
  task_milestone: [
    { event: 'task_milestone', audioFile: '/audio/got-the-plans-right-here.mp3', text: 'Got the plans right here' },
    { event: 'task_milestone', audioFile: '/audio/good-to-go.mp3', text: 'Good to go' },
  ],
  task_completed: [
    { event: 'task_completed', audioFile: '/audio/shake-it-baby.mp3', text: 'Shake it baby!' },
    { event: 'task_completed', audioFile: '/audio/commander.mp3', text: 'Commander' },
  ],
  task_failed: [
    { event: 'task_failed', audioFile: '/audio/give-me-a-job.mp3', text: 'Give me a job' },
    { event: 'task_failed', audioFile: '/audio/agent-ready.mp3', text: 'Agent ready' },
  ],
  agent_stuck: [
    { event: 'agent_stuck', audioFile: '/audio/give-me-a-job.mp3', text: 'Give me a job' },
  ],
  loop_detected: [
    { event: 'loop_detected', audioFile: '/audio/give-me-a-job.mp3', text: 'Give me a job' },
  ],
};

/**
 * Agent-specific voice packs (can be customized per agent type)
 */
export const agentVoicePacks: Record<AgentVoiceType, Record<VoiceEvent, VoiceLine[]>> = {
  default: defaultVoicePack,
  coder: defaultVoicePack, // Can customize later
  qa: defaultVoicePack,    // Can customize later
  cto: defaultVoicePack,   // Can customize later
};

/**
 * Get random voice line for an event
 */
export function getVoiceLine(event: VoiceEvent, agentType: AgentVoiceType = 'default'): VoiceLine {
  const lines = agentVoicePacks[agentType][event];
  return lines[Math.floor(Math.random() * lines.length)];
}
