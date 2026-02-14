# Audio Event Mapping - Military Voice Packs

## When You'll Hear Each Sound

### Task Assignment (When you create/assign a task)
**Trigger:** Task status changes to `assigned`

**Tactical Ops sounds (random selection):**
1. **acknowledged.mp3** - "Acknowledged"
2. **standing-by.mp3** - "Standing by for orders"
3. **ready-to-deploy.mp3** - "Ready to deploy"
4. **orders-received.mp3** - "Orders received"
5. **on-it.mp3** - "On it, commander"
6. **locked-in.mp3** - "Locked in"

**Example Flow:**
```
You: Create task "Fix calculator"
→ System assigns to coder-01
→ "Acknowledged!" or "Orders received!"
```

---

### Task In Progress (When agent starts working)
**Trigger:** Task status changes to `in_progress`

**Tactical Ops sounds (random selection):**
1. **moving-out.mp3** - "Moving out"
2. **operation-underway.mp3** - "Operation underway"
3. **executing-now.mp3** - "Executing now"
4. **engaging-target.mp3** - "Engaging target"
5. **in-position.mp3** - "In position"
6. **proceeding.mp3** - "Proceeding to objective"

**Example Flow:**
```
Task assigned → Agent starts execution
→ "Moving out!" or "Operation underway!"
```

---

### Milestone Reached (Progress checkpoint)
**Trigger:** Agent completes a progress checkpoint

**Tactical Ops sounds (random selection):**
1. **making-progress.mp3** - "Making progress"
2. **halfway-there.mp3** - "Halfway there"
3. **on-track.mp3** - "On track, commander"

**Example Flow:**
```
Progress checkpoint reached
→ "Making progress!" or "On track, commander!"
```

---

### Task Completed (Success!)
**Trigger:** Task status changes to `completed`

**Tactical Ops sounds (random selection):**
1. **mission-complete.mp3** - "Mission complete"
2. **objective-secured.mp3** - "Objective secured"
3. **target-neutralized.mp3** - "Target neutralized"

**Example Flow:**
```
Agent finishes successfully
→ "Mission complete!"
```

---

### Task Failed
**Trigger:** Task status changes to `failed`

**Tactical Ops sounds (random selection):**
1. **mission-failed.mp3** - "Mission failed"
2. **pulling-back.mp3** - "Pulling back"

**Example Flow:**
```
Agent hits error and fails
→ "Mission failed" or "Pulling back"
```

---

### Agent Stuck (Needs help)
**Trigger:** Task status changes to `needs_human`

**Tactical Ops sounds:**
1. **requesting-backup.mp3** - "Requesting backup"
2. **need-assistance.mp3** - "Need assistance"
3. **pinned-down.mp3** - "Pinned down"

**Example Flow:**
```
Agent needs human approval
→ "Requesting backup"
```

---

### Loop Detected (Agent repeating itself)
**Trigger:** Execution step event with `isLoop: true`

**Tactical Ops sounds:**
1. **going-in-circles.mp3** - "Going in circles"
2. **something-wrong.mp3** - "Something's not right"
3. **abort-abort.mp3** - "Abort. Abort."
4. **recalibrating.mp3** - "Recalibrating"

**Example Flow:**
```
Agent runs same command 3x in a row
→ "Going in circles" or "Abort. Abort."
→ Visual: LOOP warning + pulse animation
```

---

### Opus Review (Code review started)
**Trigger:** Code review initiated

**Tactical Ops sounds:**
1. **analyzing.mp3** - "Analyzing"
2. **running-diagnostics.mp3** - "Running diagnostics"
3. **checking-intel.mp3** - "Checking intel"

---

### Decomposition (Task decomposition)
**Trigger:** Task decomposition started

**Tactical Ops sounds:**
1. **breaking-it-down.mp3** - "Breaking it down"
2. **planning-approach.mp3** - "Planning approach"

---

## Voice Pack Comparison

Each pack has 32 lines covering the same 9 events with different voices:

| Event | Tactical Ops | Mission Control | Field Command |
|-------|-------------|-----------------|---------------|
| Assigned | "Acknowledged" | "Assignment confirmed" | "Understood" |
| In Progress | "Moving out" | "Commencing operations" | "Pressing forward" |
| Milestone | "Making progress" | "Checkpoint reached" | "Solid progress" |
| Completed | "Mission complete" | "Task complete" | "Job done" |
| Failed | "Mission failed" | "Task unsuccessful" | "No joy" |
| Stuck | "Requesting backup" | "Anomaly detected" | "Bogged down" |
| Loop | "Going in circles" | "Pattern detected" | "Bit of deja vu" |
| Review | "Analyzing" | "Initiating review" | "Under review" |
| Decompose | "Breaking it down" | "Decomposing task" | "Splitting it up" |

---

## Testing the Audio System

### Quick Test Sequence

1. **Create a simple task** (complexity 0)
   ```
   Title: "Add 2+2 function"
   → Hear: "Acknowledged!" or similar
   ```

2. **Watch it execute**
   ```
   Agent starts → "Moving out!"
   Milestone → "Making progress!"
   ```

3. **Task completes**
   ```
   Success! → "Mission complete!"
   ```

### Mute Controls

**Toggle Mute:**
- Click the speaker icon in TopBar
- Muted = VolumeX icon (gray)
- Unmuted = Volume2 icon (green)

**Volume Adjustment:**
Currently hardcoded to 70%. To change:
```typescript
// In packages/ui/src/store/uiState.ts
audioSettings: {
  muted: false,
  volume: 0.7,  // Change this (0.0 to 1.0)
}
```

---

## Sound Mapping Summary

| Event | When | Example Sound | Frequency |
|-------|------|---------------|-----------|
| **Task Assigned** | You create/assign task | "Acknowledged!" | Once per task |
| **In Progress** | Agent starts work | "Moving out!" | Once per task |
| **Milestone** | Progress checkpoint | "Making progress!" | Per checkpoint |
| **Completed** | Task succeeds | "Mission complete!" | Once per task |
| **Failed** | Task fails | "Mission failed" | Once per task |
| **Stuck** | Needs human | "Requesting backup" | Once when stuck |
| **Loop** | Agent repeating | "Going in circles" | Once when detected |
| **Review** | Code review starts | "Analyzing" | Once per review |
| **Decompose** | Task split | "Breaking it down" | Once per decomposition |

---

## Sample Audio Timeline

```
00:00 - User creates task "Add numbers"
00:01 - "Acknowledged!"
00:02 - Agent assigned, starts execution
00:03 - "Moving out!"
00:08 - Progress checkpoint
00:09 - "Making progress!"
00:12 - Task completes successfully
00:13 - "Mission complete!"
```

---

Enjoy commanding your team of elite coding agents with military voice feedback!
