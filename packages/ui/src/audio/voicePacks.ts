/**
 * RTS-style voice packs for agent events
 * Supports multiple voice packs: C&C Red Alert, StarCraft, Age of Empires
 */

export type VoiceEvent =
  | 'task_assigned'
  | 'task_in_progress'
  | 'task_milestone'
  | 'task_completed'
  | 'task_failed'
  | 'agent_stuck'
  | 'loop_detected'
  | 'opus_review'
  | 'decomposition';

export type AgentVoiceType = 'coder' | 'qa' | 'cto' | 'default';

export type VoicePackId = 'red-alert' | 'starcraft' | 'age-of-empires';

export interface VoiceLine {
  event: VoiceEvent;
  audioFile: string;
  text: string;
}

export interface VoicePack {
  id: VoicePackId;
  name: string;
  description: string;
  lines: Record<VoiceEvent, VoiceLine[]>;
}

/**
 * C&C Red Alert voice pack (default)
 */
export const redAlertVoicePack: VoicePack = {
  id: 'red-alert',
  name: 'C&C Red Alert',
  description: 'Classic Command & Conquer: Red Alert unit responses',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/red-alert/aye-commander.mp3', text: 'Aye commander' },
      { event: 'task_assigned', audioFile: '/audio/red-alert/conscript-reporting.mp3', text: 'Conscript reporting' },
      { event: 'task_assigned', audioFile: '/audio/red-alert/acknowledged.mp3', text: 'Acknowledged' },
      { event: 'task_assigned', audioFile: '/audio/red-alert/mission-sir.mp3', text: 'Mission sir' },
      { event: 'task_assigned', audioFile: '/audio/red-alert/can-do.mp3', text: 'Can do' },
      { event: 'task_assigned', audioFile: '/audio/red-alert/i-hear-and-obey.mp3', text: 'I hear and obey' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/red-alert/operation-underway.mp3', text: 'Operation underway' },
      { event: 'task_in_progress', audioFile: '/audio/red-alert/main-engines-engaged.mp3', text: 'Main engines engaged' },
      { event: 'task_in_progress', audioFile: '/audio/red-alert/course-set.mp3', text: 'Course set' },
      { event: 'task_in_progress', audioFile: '/audio/red-alert/battle-stations.mp3', text: 'Battle stations' },
      { event: 'task_in_progress', audioFile: '/audio/red-alert/engineering.mp3', text: 'Engineering' },
      { event: 'task_in_progress', audioFile: '/audio/red-alert/closing-in.mp3', text: 'Closing in' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/red-alert/shake-it-baby.mp3', text: 'Shake it baby!' },
      { event: 'task_milestone', audioFile: '/audio/red-alert/got-a-clear-view-sir.mp3', text: 'Got a clear view sir' },
      { event: 'task_milestone', audioFile: '/audio/red-alert/checking-designs.mp3', text: 'Checking designs' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/red-alert/adios-amigos.mp3', text: 'Adios amigos' },
      { event: 'task_completed', audioFile: '/audio/red-alert/already-there.mp3', text: 'Already there' },
      { event: 'task_completed', audioFile: '/audio/red-alert/commander.mp3', text: 'Commander' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/red-alert/going-down.mp3', text: 'Going down' },
      { event: 'task_failed', audioFile: '/audio/red-alert/but-i-was-working.mp3', text: 'But I was working' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/red-alert/eject-eject.mp3', text: 'Eject eject!' },
      { event: 'agent_stuck', audioFile: '/audio/red-alert/changing-vector.mp3', text: 'Changing vector' },
      { event: 'agent_stuck', audioFile: '/audio/red-alert/give-me-a-plan.mp3', text: 'Give me a plan' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/red-alert/i-knew-this-would-happen.mp3', text: 'I knew this would happen' },
      { event: 'loop_detected', audioFile: '/audio/red-alert/are-you-kgb.mp3', text: 'Are you KGB?' },
      { event: 'loop_detected', audioFile: '/audio/red-alert/checking-connection.mp3', text: 'Checking connection' },
      { event: 'loop_detected', audioFile: '/audio/red-alert/da.mp3', text: 'Da' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/red-alert/checking-designs.mp3', text: 'Checking designs' },
      { event: 'opus_review', audioFile: '/audio/red-alert/obtaining-intelligence.mp3', text: 'Obtaining intelligence' },
      { event: 'opus_review', audioFile: '/audio/red-alert/analyzing-schematics.mp3', text: 'Analyzing schematics' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/red-alert/deconstructing.mp3', text: 'Deconstructing' },
      { event: 'decomposition', audioFile: '/audio/red-alert/engineering.mp3', text: 'Engineering' },
    ],
  },
};

/**
 * StarCraft voice pack
 */
export const starcraftVoicePack: VoicePack = {
  id: 'starcraft',
  name: 'StarCraft',
  description: 'Terran unit responses from StarCraft',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/starcraft/scv-ready.mp3', text: 'SCV ready' },
      { event: 'task_assigned', audioFile: '/audio/starcraft/reportin.mp3', text: 'Reportin\'' },
      { event: 'task_assigned', audioFile: '/audio/starcraft/go-ahead.mp3', text: 'Go ahead' },
      { event: 'task_assigned', audioFile: '/audio/starcraft/affirmative.mp3', text: 'Affirmative' },
      { event: 'task_assigned', audioFile: '/audio/starcraft/ready.mp3', text: 'Ready' },
      { event: 'task_assigned', audioFile: '/audio/starcraft/say-the-word.mp3', text: 'Say the word' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/starcraft/ill-take-care-of-it.mp3', text: 'I\'ll take care of it' },
      { event: 'task_in_progress', audioFile: '/audio/starcraft/ive-got-orders.mp3', text: 'I\'ve got orders' },
      { event: 'task_in_progress', audioFile: '/audio/starcraft/moving-out.mp3', text: 'Moving out' },
      { event: 'task_in_progress', audioFile: '/audio/starcraft/on-my-way.mp3', text: 'On my way' },
      { event: 'task_in_progress', audioFile: '/audio/starcraft/roger.mp3', text: 'Roger' },
      { event: 'task_in_progress', audioFile: '/audio/starcraft/understood.mp3', text: 'Understood' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/starcraft/excellent.mp3', text: 'Excellent' },
      { event: 'task_milestone', audioFile: '/audio/starcraft/nice-work.mp3', text: 'Nice work' },
      { event: 'task_milestone', audioFile: '/audio/starcraft/outstanding.mp3', text: 'Outstanding' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/starcraft/job-done.mp3', text: 'Job done' },
      { event: 'task_completed', audioFile: '/audio/starcraft/complete.mp3', text: 'Complete' },
      { event: 'task_completed', audioFile: '/audio/starcraft/work-complete.mp3', text: 'Work complete' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/starcraft/abort-mission.mp3', text: 'Abort mission' },
      { event: 'task_failed', audioFile: '/audio/starcraft/mission-failed.mp3', text: 'Mission failed' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/starcraft/nuclear-launch-detected.mp3', text: 'Nuclear launch detected' },
      { event: 'agent_stuck', audioFile: '/audio/starcraft/we-cant-hold-it.mp3', text: 'We can\'t hold it!' },
      { event: 'agent_stuck', audioFile: '/audio/starcraft/were-under-attack.mp3', text: 'We\'re under attack!' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/starcraft/you-want-a-piece-of-me.mp3', text: 'You want a piece of me, boy?' },
      { event: 'loop_detected', audioFile: '/audio/starcraft/stop-poking-me.mp3', text: 'Stop poking me!' },
      { event: 'loop_detected', audioFile: '/audio/starcraft/what-is-it.mp3', text: 'What is it?' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/starcraft/scanning.mp3', text: 'Scanning' },
      { event: 'opus_review', audioFile: '/audio/starcraft/sensors-online.mp3', text: 'Sensors online' },
      { event: 'opus_review', audioFile: '/audio/starcraft/analysis-complete.mp3', text: 'Analysis complete' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/starcraft/construction-complete.mp3', text: 'Construction complete' },
      { event: 'decomposition', audioFile: '/audio/starcraft/building.mp3', text: 'Building' },
    ],
  },
};

/**
 * Age of Empires voice pack
 */
export const ageOfEmpiresVoicePack: VoicePack = {
  id: 'age-of-empires',
  name: 'Age of Empires',
  description: 'Classic AoE unit responses and priest sounds',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/aoe/wololo.mp3', text: 'Wololo' },
      { event: 'task_assigned', audioFile: '/audio/aoe/yes.mp3', text: 'Yes?' },
      { event: 'task_assigned', audioFile: '/audio/aoe/my-liege.mp3', text: 'My liege?' },
      { event: 'task_assigned', audioFile: '/audio/aoe/your-command.mp3', text: 'Your command?' },
      { event: 'task_assigned', audioFile: '/audio/aoe/how-may-i-serve.mp3', text: 'How may I serve?' },
      { event: 'task_assigned', audioFile: '/audio/aoe/at-your-service.mp3', text: 'At your service' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/aoe/i-will-do-it.mp3', text: 'I will do it' },
      { event: 'task_in_progress', audioFile: '/audio/aoe/as-you-wish.mp3', text: 'As you wish' },
      { event: 'task_in_progress', audioFile: '/audio/aoe/im-going.mp3', text: 'I\'m going' },
      { event: 'task_in_progress', audioFile: '/audio/aoe/moving.mp3', text: 'Moving' },
      { event: 'task_in_progress', audioFile: '/audio/aoe/very-well.mp3', text: 'Very well' },
      { event: 'task_in_progress', audioFile: '/audio/aoe/starting-task.mp3', text: 'Starting task' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/aoe/excellent.mp3', text: 'Excellent' },
      { event: 'task_milestone', audioFile: '/audio/aoe/well-done.mp3', text: 'Well done' },
      { event: 'task_milestone', audioFile: '/audio/aoe/victory.mp3', text: 'Victory' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/aoe/job-done.mp3', text: 'Job done' },
      { event: 'task_completed', audioFile: '/audio/aoe/complete.mp3', text: 'Complete' },
      { event: 'task_completed', audioFile: '/audio/aoe/finished.mp3', text: 'Finished' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/aoe/retreat.mp3', text: 'Retreat!' },
      { event: 'task_failed', audioFile: '/audio/aoe/defeated.mp3', text: 'Defeated' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/aoe/i-cannot-reach-there.mp3', text: 'I cannot reach there' },
      { event: 'agent_stuck', audioFile: '/audio/aoe/i-need-help.mp3', text: 'I need help' },
      { event: 'agent_stuck', audioFile: '/audio/aoe/under-attack.mp3', text: 'We are under attack!' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/aoe/what-is-it-now.mp3', text: 'What is it now?' },
      { event: 'loop_detected', audioFile: '/audio/aoe/yes-yes.mp3', text: 'Yes, yes?' },
      { event: 'loop_detected', audioFile: '/audio/aoe/wololo.mp3', text: 'Wololo' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/aoe/gathering-resources.mp3', text: 'Gathering resources' },
      { event: 'opus_review', audioFile: '/audio/aoe/researching.mp3', text: 'Researching' },
      { event: 'opus_review', audioFile: '/audio/aoe/studying.mp3', text: 'Studying' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/aoe/building.mp3', text: 'Building' },
      { event: 'decomposition', audioFile: '/audio/aoe/constructing.mp3', text: 'Constructing' },
    ],
  },
};

/**
 * Voice pack registry
 */
export const voicePacks: Record<VoicePackId, VoicePack> = {
  'red-alert': redAlertVoicePack,
  'starcraft': starcraftVoicePack,
  'age-of-empires': ageOfEmpiresVoicePack,
};

/**
 * Get voice pack by ID
 */
export function getVoicePack(packId: VoicePackId): VoicePack {
  return voicePacks[packId] || redAlertVoicePack;
}

/**
 * Get list of available voice packs
 */
export function getAvailableVoicePacks(): VoicePack[] {
  return Object.values(voicePacks);
}

/**
 * Legacy default voice pack (for backward compatibility)
 */
export const defaultVoicePack = redAlertVoicePack.lines;

/**
 * Agent-specific voice packs (can be customized per agent type)
 */
export const agentVoicePacks: Record<AgentVoiceType, Record<VoiceEvent, VoiceLine[]>> = {
  default: defaultVoicePack,
  coder: defaultVoicePack,
  qa: defaultVoicePack,
  cto: defaultVoicePack,
};

/**
 * Get random voice line for an event
 */
export function getVoiceLine(event: VoiceEvent, agentType: AgentVoiceType = 'default'): VoiceLine {
  const lines = agentVoicePacks[agentType][event];
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Get random voice line from a specific pack
 */
export function getVoiceLineFromPack(packId: VoicePackId, event: VoiceEvent): VoiceLine {
  const pack = getVoicePack(packId);
  const lines = pack.lines[event];
  return lines[Math.floor(Math.random() * lines.length)];
}
