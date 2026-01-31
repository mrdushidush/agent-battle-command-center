# UI Feature Showcase

Visual guide to the enhanced Agent Battle Command Center UI.

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  COMMAND CENTER    [API] [Time] [Iter]  [Overseer|Micromanager|Dash]   │
│                                          [🔊] [⌨️] [💬] [🔔] [⚙️]      │
├──────────┬──────────────────────────────────────────────────────────────┤
│          │                                                               │
│ Minimap  │                  TASK QUEUE (Bounty Board)                   │
│          │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  (Radar  │  │Task 1│ │Task 2│ │Task 3│ │Task 4│ │Task 5│              │
│   View)  │  │Pend. │ │In Pr.│ │Pend. │ │Compl.│ │Failed│              │
│          │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
│          │                                                               │
├──────────┤  ... more tasks ...                                          │
│          │                                                               │
│ Sidebar  ├───────────────────────────────────────────────────────────────┤
│ (Agents  │                  ACTIVE MISSIONS (Enhanced)                   │
│  List)   │  ┌────────────────────────────────────────────────────┐      │
│          │  │🟢 coder-01 → Fix calculator bug                     │      │
│          │  │⚡3/5  ⚡45%  ⏱️12s                                   │      │
│          │  └────────────────────────────────────────────────────┘      │
└──────────┴───────────────────────────────────────────────────────────────┘
│                  TOOL LOG (Terminal View - Toggleable)                   │
│  [14:32:05] coder-01   ✓ file_write: tasks/calculator.py         234ms  │
│  [14:32:07] coder-01   ⏱ shell_command: python -c "from tasks... 1.2s   │
│  [14:32:09] coder-01   ✓ Test passed                             89ms   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdowns

### 1. TopBar (Enhanced)

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚡ COMMAND CENTER                                                  │
│                                                                    │
│ [━━━━━━━━━━░░░░] API Credits: 2450/5000                          │
│ [━━━━━░░░░░░░░░] Time: 4:23/8:00                                 │
│ [━━━━━━━░░░░░░░] Iterations: 47/100                              │
│                                                                    │
│             [Overseer] [Micromanager] [Dashboard]                 │
│                                                                    │
│              [🔊] [⌨️] [💬] [🔔] [⚙️]                           │
│               │    │    │    │    └─ Settings                     │
│               │    │    │    └────── Alerts                       │
│               │    │    └─────────── Chat                         │
│               │    └──────────────── Tool Log (NEW)               │
│               └───────────────────── Audio Mute (NEW)             │
└────────────────────────────────────────────────────────────────────┘
```

**New Features:**
- 🔊 **Audio Toggle**: Mute/unmute C&C voice feedback
- ⌨️ **Tool Log Toggle**: Show/hide execution log panel
- **Real Metrics**: ResourceBars now show actual data, not hardcoded

### 2. Active Missions Strip (Enhanced)

**Before:**
```
┌─────────────────────────────────────────────┐
│ 🟢 coder-01 → Fix calculator bug   ⏳ [==] 2/5 │
└─────────────────────────────────────────────┘
```

**After:**
```
┌──────────────────────────────────────────────────────────┐
│ 🟢 coder-01 → Fix calculator bug                   ⏳    │
│ ⚡3/5  [━━━━━░░░░░]  ⚡45%  ⏱️12s                       │
└──────────────────────────────────────────────────────────┘
```

**New Metrics:**
- `⚡3/5` - Iteration progress with icon
- `[━━━━━░░░░░]` - Visual progress bar
- `⚡45%` - Token usage percentage (red if >80%)
- `⏱️12s` - Response time (how long current action running)

**Loop Detection:**
```
┌──────────────────────────────────────────────────────────┐
│ 🟡 coder-02 → Complex refactor               ⚠️  LOOP   │
│ ⚡8/10  [━━━━━━━━░░]  ⚡89%  ⏱️45s                      │
└──────────────────────────────────────────────────────────┘
```
- Amber background + pulse animation
- "LOOP" label when agent repeating actions
- Plays "We're pinned down" audio

### 3. Tool Log Panel (New)

```
┌─────────────────────────────────────────────────────────────┐
│ ⌨️  TOOL EXECUTION LOG                    47 actions  [✓]  │
├─────────────────────────────────────────────────────────────┤
│ [14:32:05] coder-01-abc  ✓ file_write: tasks/calc.py  234ms│
│ [14:32:07] coder-01-abc  ⏱ shell_command: python -c... 1.2s│
│ [14:32:09] coder-01-abc  ✓ Test passed                89ms │
│ [14:32:11] qa-01-xyz     ✓ file_read: tasks/calc.py   45ms │
│ [14:32:13] qa-01-xyz     ✗ Error: Test failed        156ms │
│ [14:32:15] coder-01-abc  ✓ file_write: tasks/calc.py 201ms │
│ ... auto-scrolling ...                                      │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- **Timestamps**: Precise HH:MM:SS
- **Agent ID**: Truncated for readability
- **Status Icons**: ✓ (green), ✗ (red), ⏱ (yellow)
- **Smart Formatting**: Shows file paths, commands
- **Duration**: Milliseconds for performance tracking
- **Auto-scroll**: Pauses on hover
- **Color Coding**: Green/red/yellow text

### 4. Task Detail Panel (Code Review)

```
┌─────────────────────────────────────────────────────┐
│ Task Details                                    [X] │
├─────────────────────────────────────────────────────┤
│ Fix Calculator Addition Bug                         │
│ [Completed]                                         │
│                                                     │
│ ... task info ...                                   │
│                                                     │
│ ⭐ CODE REVIEW (Opus)                               │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [8.5/10] [APPROVED] 0 fix attempts              │ │
│ │                                                 │ │
│ │ "Well-structured solution with proper error    │ │
│ │  handling. Follows project conventions."       │ │
│ │                                                 │ │
│ │ 📋 Findings (2)                                 │ │
│ │ ┌─ [MEDIUM] Code Quality ─────────────────────┐ │ │
│ │ │ Consider adding type hints to function      │ │
│ │ │ → Add: def add(a: int, b: int) -> int:      │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ │ ┌─ [LOW] Documentation ────────────────────────┐ │ │
│ │ │ Missing docstring                            │ │
│ │ │ → Add brief description of function behavior│ │
│ │ └─────────────────────────────────────────────┘ │ │
│ │                                                 │ │
│ │ Complexity: Router 4.2 → Opus 3.8              │ │
│ │ Tokens: 1,234 in / 567 out                     │ │
│ │ Cost: $0.0042                                  │ │
│ │ Reviewed by: claude-opus-4                     │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Features:**
- **Quality Score**: 0-10 with color gradient
- **Status Badge**: Approved/Needs Fixes/Rejected
- **Summary**: AI-generated review summary
- **Findings**: Categorized by severity
- **Suggestions**: Expandable improvement hints
- **Complexity**: Router vs Opus assessment
- **Cost Tracking**: Token usage and $ cost

## Audio Events

### Task Assignment
```
User creates task → API assigns to agent
                    ↓
            [🔊 "Affirmative!"]
```

### Task Progress
```
Agent iteration 2 complete → Milestone
                            ↓
                    [🔊 "Cha-ching!"]
```

### Task Completion
```
Agent completes task successfully
                ↓
        [🔊 "Mission complete!"]
```

### Task Failure
```
Agent fails task after retries
                ↓
        [🔊 "We have a problem"]
```

### Loop Detection
```
Agent repeats same action 3x
                ↓
        [🔊 "We're pinned down!"]
        + Visual pulse animation
        + "LOOP" label
```

## Color Scheme

### Status Colors
- **Green** (#10B981): Success, completed, healthy
- **Blue** (#3B82F6): In progress, active
- **Amber** (#F59E0B): Warning, needs attention, stuck
- **Red** (#EF4444): Error, failed, critical
- **Purple** (#8B5CF6): Assigned, queued

### Agent Type Colors
- **Coder**: Blue (#3B82F6)
- **QA**: Green (#10B981)
- **CTO**: Purple (#8B5CF6)

### UI Theme
- **Background**: Dark command-bg
- **Panels**: command-panel
- **Borders**: command-border
- **Accents**: HUD colors (green, blue, amber, red)
- **Text**: Gray-100 (primary), Gray-500 (secondary)

## Interaction Flow

### Starting a Task with Audio

1. **User creates task** in UI
   ```
   [Create Task Modal]
   → Title: "Fix login bug"
   → Click "Create"
   ```

2. **System assigns to agent**
   ```
   Backend: Finds available coder agent
   → Assigns task
   → Emits 'task_updated' event
   ```

3. **UI responds**
   ```
   WebSocket receives update
   → Updates task in store
   → Detects status change to 'assigned'
   → Plays audio: "Affirmative!"
   → Shows in Active Missions strip
   ```

4. **Agent executes**
   ```
   Agent tool calls appear in Tool Log
   → Token usage updates
   → Response timer counts up
   → Progress bar advances
   ```

5. **Agent completes**
   ```
   Backend: Task status → 'completed'
   → Emits 'task_updated' event

   UI:
   → Plays audio: "Mission complete!"
   → Moves to completed section
   → Shows code review (if available)
   ```

### Toggling Panels

```
Click [⌨️] → Tool Log slides up from bottom
Click [⌨️] → Tool Log slides down (hidden)

Click [💬] → Chat panel slides in from right
Click [💬] → Chat panel slides out

Click [🔔] → Alerts panel slides in from right
Click [🔔] → Alerts panel slides out
```

## Responsive Behavior

### Desktop (1920x1080)
```
├─ Sidebar: 320px (full minimap + agent list)
├─ Main: ~1200px (task queue + active missions + tool log)
└─ Chat/Alerts: 320px (when open)
```

### Laptop (1440x900)
```
├─ Sidebar: 280px (smaller minimap)
├─ Main: ~900px (2-column task grid)
└─ Chat/Alerts: 280px overlay
```

### Small Screen (<1280px)
```
├─ Sidebar: Collapsible (64px icon bar)
├─ Main: Full width
└─ Panels: Full-screen overlay
```

## Performance Notes

- **Tool Log**: Polls every 2s, keeps last 50 entries
- **Agent Health**: Updates on every execution step
- **Audio Queue**: Max 5 sounds queued, priority-sorted
- **WebSocket**: Auto-reconnect on disconnect
- **React Re-renders**: Optimized with zustand selectors

## Future Enhancements Teased

### Coming Soon
- **Visual Audio Indicator**: Waveform animation when playing
- **Agent Health Dashboard**: Dedicated view for all agent metrics
- **Cost Budget Alerts**: Warnings when approaching limits
- **Custom Voice Packs**: Upload your own audio
- **Keyboard Shortcuts**: Quick access to all features
- **Dark/Light Mode Toggle**: Theme switcher
- **Task Templates**: Quick-create common tasks
- **Agent Performance History**: Time-series charts

---

**Built with:** React, TypeScript, Tailwind CSS, Zustand, Socket.IO
**Style:** C&C Red Alert inspired military command interface
**Audio:** Queue-based priority system with volume control
