/**
 * RTS-style voice packs for agent events
 * Original TTS-generated military voice lines (no copyrighted game audio)
 * Voices: Tactical Ops (US male), Mission Control (US female), Field Command (UK male)
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

export type VoicePackId = 'tactical' | 'mission-control' | 'field-command';

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
 * Tactical Ops voice pack (default) — US male, commanding
 */
export const tacticalVoicePack: VoicePack = {
  id: 'tactical',
  name: 'Tactical Ops',
  description: 'Commanding US military operator',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/tactical/acknowledged.mp3', text: 'Acknowledged' },
      { event: 'task_assigned', audioFile: '/audio/tactical/standing-by.mp3', text: 'Standing by for orders' },
      { event: 'task_assigned', audioFile: '/audio/tactical/ready-to-deploy.mp3', text: 'Ready to deploy' },
      { event: 'task_assigned', audioFile: '/audio/tactical/orders-received.mp3', text: 'Orders received' },
      { event: 'task_assigned', audioFile: '/audio/tactical/on-it.mp3', text: 'On it, commander' },
      { event: 'task_assigned', audioFile: '/audio/tactical/locked-in.mp3', text: 'Locked in' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/tactical/moving-out.mp3', text: 'Moving out' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/operation-underway.mp3', text: 'Operation underway' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/executing-now.mp3', text: 'Executing now' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/engaging-target.mp3', text: 'Engaging target' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/in-position.mp3', text: 'In position' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/proceeding.mp3', text: 'Proceeding to objective' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/tactical/making-progress.mp3', text: 'Making progress' },
      { event: 'task_milestone', audioFile: '/audio/tactical/halfway-there.mp3', text: 'Halfway there' },
      { event: 'task_milestone', audioFile: '/audio/tactical/on-track.mp3', text: 'On track, commander' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/tactical/mission-complete.mp3', text: 'Mission complete' },
      { event: 'task_completed', audioFile: '/audio/tactical/objective-secured.mp3', text: 'Objective secured' },
      { event: 'task_completed', audioFile: '/audio/tactical/target-neutralized.mp3', text: 'Target neutralized' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/tactical/mission-failed.mp3', text: 'Mission failed' },
      { event: 'task_failed', audioFile: '/audio/tactical/pulling-back.mp3', text: 'Pulling back' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/tactical/requesting-backup.mp3', text: 'Requesting backup' },
      { event: 'agent_stuck', audioFile: '/audio/tactical/need-assistance.mp3', text: 'Need assistance' },
      { event: 'agent_stuck', audioFile: '/audio/tactical/pinned-down.mp3', text: 'Pinned down' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/tactical/going-in-circles.mp3', text: 'Going in circles' },
      { event: 'loop_detected', audioFile: '/audio/tactical/something-wrong.mp3', text: "Something's not right" },
      { event: 'loop_detected', audioFile: '/audio/tactical/abort-abort.mp3', text: 'Abort. Abort.' },
      { event: 'loop_detected', audioFile: '/audio/tactical/recalibrating.mp3', text: 'Recalibrating' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/tactical/analyzing.mp3', text: 'Analyzing' },
      { event: 'opus_review', audioFile: '/audio/tactical/running-diagnostics.mp3', text: 'Running diagnostics' },
      { event: 'opus_review', audioFile: '/audio/tactical/checking-intel.mp3', text: 'Checking intel' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/tactical/breaking-it-down.mp3', text: 'Breaking it down' },
      { event: 'decomposition', audioFile: '/audio/tactical/planning-approach.mp3', text: 'Planning approach' },
    ],
  },
};

/**
 * Mission Control voice pack — US female, professional
 */
export const missionControlVoicePack: VoicePack = {
  id: 'mission-control',
  name: 'Mission Control',
  description: 'Professional NASA-style mission controller',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/mission-control/assignment-confirmed.mp3', text: 'Assignment confirmed' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/task-accepted.mp3', text: 'Task accepted' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/ready-for-tasking.mp3', text: 'Ready for tasking' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/copy-that.mp3', text: 'Copy that' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/roger-that.mp3', text: 'Roger that' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/affirmative.mp3', text: 'Affirmative' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/mission-control/commencing-operations.mp3', text: 'Commencing operations' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/systems-nominal.mp3', text: 'Systems nominal' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/on-approach.mp3', text: 'On approach' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/telemetry-is-good.mp3', text: 'Telemetry is good' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/all-systems-go.mp3', text: 'All systems go' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/in-the-pipeline.mp3', text: 'In the pipeline' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/mission-control/checkpoint-reached.mp3', text: 'Checkpoint reached' },
      { event: 'task_milestone', audioFile: '/audio/mission-control/looking-good.mp3', text: 'Looking good' },
      { event: 'task_milestone', audioFile: '/audio/mission-control/steady-progress.mp3', text: 'Steady progress' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/mission-control/task-complete.mp3', text: 'Task complete' },
      { event: 'task_completed', audioFile: '/audio/mission-control/well-done.mp3', text: 'Well done' },
      { event: 'task_completed', audioFile: '/audio/mission-control/success-confirmed.mp3', text: 'Success confirmed' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/mission-control/task-unsuccessful.mp3', text: 'Task unsuccessful' },
      { event: 'task_failed', audioFile: '/audio/mission-control/negative-result.mp3', text: 'Negative result' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/mission-control/anomaly-detected.mp3', text: 'Anomaly detected' },
      { event: 'agent_stuck', audioFile: '/audio/mission-control/system-unresponsive.mp3', text: 'System unresponsive' },
      { event: 'agent_stuck', audioFile: '/audio/mission-control/intervention-required.mp3', text: 'Intervention required' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/mission-control/pattern-detected.mp3', text: 'Repeating pattern detected' },
      { event: 'loop_detected', audioFile: '/audio/mission-control/loop-identified.mp3', text: 'Loop identified' },
      { event: 'loop_detected', audioFile: '/audio/mission-control/cycle-detected.mp3', text: 'Cycle detected' },
      { event: 'loop_detected', audioFile: '/audio/mission-control/breaking-loop.mp3', text: 'Breaking the loop' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/mission-control/initiating-review.mp3', text: 'Initiating review' },
      { event: 'opus_review', audioFile: '/audio/mission-control/quality-check.mp3', text: 'Quality check in progress' },
      { event: 'opus_review', audioFile: '/audio/mission-control/scanning-output.mp3', text: 'Scanning output' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/mission-control/decomposing-task.mp3', text: 'Decomposing task' },
      { event: 'decomposition', audioFile: '/audio/mission-control/analyzing-structure.mp3', text: 'Analyzing structure' },
    ],
  },
};

/**
 * Field Command voice pack — UK male, authoritative
 */
export const fieldCommandVoicePack: VoicePack = {
  id: 'field-command',
  name: 'Field Command',
  description: 'British field operations commander',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/field-command/understood.mp3', text: 'Understood' },
      { event: 'task_assigned', audioFile: '/audio/field-command/right-away.mp3', text: 'Right away' },
      { event: 'task_assigned', audioFile: '/audio/field-command/consider-it-done.mp3', text: 'Consider it done' },
      { event: 'task_assigned', audioFile: '/audio/field-command/at-once.mp3', text: 'At once' },
      { event: 'task_assigned', audioFile: '/audio/field-command/straight-away.mp3', text: 'Straight away, sir' },
      { event: 'task_assigned', audioFile: '/audio/field-command/on-the-case.mp3', text: 'On the case' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/field-command/pressing-forward.mp3', text: 'Pressing forward' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/boots-on-ground.mp3', text: 'Boots on the ground' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/operational.mp3', text: 'Operational' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/en-route.mp3', text: 'En route' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/making-headway.mp3', text: 'Making headway' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/underway.mp3', text: 'Underway' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/field-command/solid-progress.mp3', text: 'Solid progress' },
      { event: 'task_milestone', audioFile: '/audio/field-command/getting-there.mp3', text: 'Getting there' },
      { event: 'task_milestone', audioFile: '/audio/field-command/phase-complete.mp3', text: 'Phase complete' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/field-command/job-done.mp3', text: 'Job done' },
      { event: 'task_completed', audioFile: '/audio/field-command/mission-accomplished.mp3', text: 'Mission accomplished' },
      { event: 'task_completed', audioFile: '/audio/field-command/all-clear.mp3', text: 'All clear' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/field-command/no-joy.mp3', text: 'No joy' },
      { event: 'task_failed', audioFile: '/audio/field-command/falling-back.mp3', text: 'Falling back' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/field-command/bogged-down.mp3', text: 'Bogged down' },
      { event: 'agent_stuck', audioFile: '/audio/field-command/need-reinforcements.mp3', text: 'Need reinforcements' },
      { event: 'agent_stuck', audioFile: '/audio/field-command/taking-fire.mp3', text: 'Taking fire' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/field-command/deja-vu.mp3', text: 'Bit of deja vu here' },
      { event: 'loop_detected', audioFile: '/audio/field-command/stuck-in-a-rut.mp3', text: 'Stuck in a rut' },
      { event: 'loop_detected', audioFile: '/audio/field-command/not-again.mp3', text: 'Not again' },
      { event: 'loop_detected', audioFile: '/audio/field-command/change-of-plan.mp3', text: 'Change of plan' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/field-command/under-review.mp3', text: 'Under review' },
      { event: 'opus_review', audioFile: '/audio/field-command/inspecting.mp3', text: 'Inspecting' },
      { event: 'opus_review', audioFile: '/audio/field-command/double-checking.mp3', text: 'Double checking' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/field-command/splitting-up.mp3', text: 'Splitting it up' },
      { event: 'decomposition', audioFile: '/audio/field-command/dividing-forces.mp3', text: 'Dividing forces' },
    ],
  },
};

/**
 * Voice pack registry
 */
export const voicePacks: Record<VoicePackId, VoicePack> = {
  'tactical': tacticalVoicePack,
  'mission-control': missionControlVoicePack,
  'field-command': fieldCommandVoicePack,
};

/**
 * Get voice pack by ID
 */
export function getVoicePack(packId: VoicePackId): VoicePack {
  return voicePacks[packId] || tacticalVoicePack;
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
export const defaultVoicePack = tacticalVoicePack.lines;

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
