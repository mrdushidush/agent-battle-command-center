# 🔊 Audio Event Mapping - C&C Red Alert Edition

## When You'll Hear Each Sound

### 🎯 Task Assignment (When you create/assign a task)
**Trigger:** Task status changes to `assigned`

**Sounds (random selection):**
1. **conscript-reporting.mp3** - "Conscript reporting"
2. **agent-ready.mp3** - "Agent ready"
3. **aye-commander.mp3** - "Aye commander"
4. **assignment-sir.mp3** - "Assignment sir"
5. **order-received.mp3** - "Order received"
6. **mission-sir.mp3** - "Mission sir"
7. **anytime-boss.mp3** - "Anytime boss"
8. **good-to-go.mp3** - "Good to go"

**Example Flow:**
```
You: Create task "Fix calculator"
→ System assigns to coder-01
→ 🔊 "Conscript reporting!" or "Aye commander!"
```

---

### ⚙️ Task In Progress (When agent starts working)
**Trigger:** Task status changes to `in_progress`

**Sounds (random selection):**
1. **operation-underway.mp3** - "Operation underway"
2. **analyzing-schematics.mp3** - "Analyzing schematics"
3. **obtaining-intelligence.mp3** - "Obtaining intelligence"
4. **on-our-way-sir.mp3** - "On our way sir"
5. **main-engines-engaged.mp3** - "Main engines engaged"

**Example Flow:**
```
Task assigned → Agent starts execution
→ 🔊 "Operation underway!" or "Analyzing schematics!"
```

---

### 🎖️ Milestone Reached (Every 2 iterations)
**Trigger:** Agent completes an iteration, and `currentIteration % 2 === 0`

**Sounds (random selection):**
1. **got-the-plans-right-here.mp3** - "Got the plans right here"
2. **good-to-go.mp3** - "Good to go"

**Example Flow:**
```
Iteration 1 complete → (no sound)
Iteration 2 complete → 🔊 "Got the plans right here!"
Iteration 3 complete → (no sound)
Iteration 4 complete → 🔊 "Good to go!"
```

---

### ✅ Task Completed (Success!)
**Trigger:** Task status changes to `completed`

**Sounds (random selection):**
1. **shake-it-baby.mp3** - "Shake it baby!" (CLASSIC C&C!)
2. **commander.mp3** - "Commander"

**Example Flow:**
```
Agent finishes successfully
→ 🔊 "Shake it baby!" ← You'll love this one!
```

---

### ❌ Task Failed (Uh oh...)
**Trigger:** Task status changes to `failed`

**Sounds (random selection):**
1. **give-me-a-job.mp3** - "Give me a job"
2. **agent-ready.mp3** - "Agent ready"

**Example Flow:**
```
Agent hits error and fails
→ 🔊 "Give me a job" (agent wants to try again)
```

---

### ⚠️ Agent Stuck (Needs human help)
**Trigger:** Task status changes to `needs_human`

**Sounds:**
1. **give-me-a-job.mp3** - "Give me a job"

**Example Flow:**
```
Agent needs human approval
→ 🔊 "Give me a job"
```

---

### 🔁 Loop Detected (Agent repeating itself)
**Trigger:** Execution step event with `isLoop: true`

**Sounds:**
1. **give-me-a-job.mp3** - "Give me a job"

**Example Flow:**
```
Agent runs same command 3x in a row
→ 🔊 "Give me a job"
→ Visual: LOOP warning + pulse animation
```

---

## 🎮 Testing the Audio System

### Quick Test Sequence

1. **Create a simple task** (complexity 0)
   ```
   Title: "Add 2+2 function"
   → Hear: "Conscript reporting!" or similar
   ```

2. **Watch it execute**
   ```
   Agent starts → "Operation underway!"
   Iteration 2 → "Got the plans right here!"
   ```

3. **Task completes**
   ```
   Success! → "SHAKE IT BABY!" 🎉
   ```

### Mute Controls

**Toggle Mute:**
- Click the 🔊 icon in TopBar
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

## 🎯 Pro Tips for Maximum Fun

### 1. Create Multiple Tasks Quickly
Create 3-5 simple tasks at once to hear different assignment sounds back-to-back!

### 2. Watch the Active Missions Strip
You'll see:
- Token usage updating
- Iteration progress bars moving
- Response time ticking up
- AND hear sounds as agents work!

### 3. Enable Tool Log
Click the Terminal icon (⌨️) to see what agents do while hearing the sounds

### 4. Test the "Shake it baby!" Sound
This is the BEST sound - the classic C&C construction complete!
- Create a super easy task
- Watch it succeed
- 🔊 "SHAKE IT BABY!"

### 5. Trigger Loop Detection
Create a task that might make the agent repeat itself:
- "Write an impossible function"
- Agent will retry same thing
- 🔊 "Give me a job" + LOOP warning

---

## 🔧 Sound Mapping Summary

| Event | When | Example Sound | Frequency |
|-------|------|---------------|-----------|
| **Task Assigned** | You create/assign task | "Conscript reporting!" | Once per task |
| **In Progress** | Agent starts work | "Operation underway!" | Once per task |
| **Milestone** | Every 2 iterations | "Got the plans!" | Every 2 iters |
| **Completed** | Task succeeds | "Shake it baby!" ⭐ | Once per task |
| **Failed** | Task fails | "Give me a job" | Once per task |
| **Stuck** | Needs human | "Give me a job" | Once when stuck |
| **Loop** | Agent repeating | "Give me a job" | Once when detected |

---

## 🎬 Sample Audio Timeline

```
00:00 - User creates task "Add numbers"
00:01 - 🔊 "Aye commander!"
00:02 - Agent assigned, starts execution
00:03 - 🔊 "Analyzing schematics!"
00:05 - Iteration 1 complete (silent)
00:08 - Iteration 2 complete
00:09 - 🔊 "Got the plans right here!"
00:12 - Task completes successfully
00:13 - 🔊 "SHAKE IT BABY!" 🎉
00:14 - You smile :)
```

---

Enjoy your C&C Red Alert command center! The audio makes it feel like you're really commanding a team of elite coding agents! 🎖️
