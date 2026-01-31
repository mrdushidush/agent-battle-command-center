# Quick Start Guide - UI Enhancements

## Installation & Setup

### 1. Install Dependencies
```bash
# From project root
npm install

# Or install UI packages specifically
cd packages/ui
npm install
cd ../..
```

### 2. Add Audio Files (Optional but Recommended)

Place audio samples in `packages/ui/public/audio/`. See `packages/ui/public/audio/README.md` for the complete list.

**Quick Test Audio:**
You can create placeholder audio files for testing:
```bash
cd packages/ui/public/audio

# On Mac/Linux with `say` command:
say "Affirmative" -o affirmative.mp3
say "Mission complete" -o mission-complete.mp3
say "We have a problem" -o problem.mp3

# Or download free military-style sound effects from:
# - freesound.org
# - zapsplat.com
# - soundjay.com
```

**Minimum Files for Testing:**
- `affirmative.mp3` - Plays when task assigned
- `mission-complete.mp3` - Plays when task completes
- `problem.mp3` - Plays when task fails
- `pinned-down.mp3` - Plays when agent stuck/loop detected

### 3. Start the Development Server

```bash
# Start all services with Docker
docker compose up

# Or start UI only (if backend is already running)
cd packages/ui
npm run dev
```

### 4. Open the Application

Navigate to: http://localhost:5173

## Features Overview

### 🔊 Audio System

**Controls:**
- **Mute Toggle**: Click the volume icon in the top-right of TopBar
- **Volume**: Defaults to 70% (can adjust in code: `audioSettings.volume`)

**Events that Trigger Audio:**
1. Task assigned → "Affirmative" / "Acknowledged"
2. Task completes → "Mission complete" / "Job done"
3. Task fails → "We have a problem" / "Need backup"
4. Agent stuck/loop → "We're pinned down" / "Taking fire"
5. Iteration milestone (every 2 iterations) → "Cha-ching!"

**Testing Audio:**
1. Create a task via UI or API
2. Assign it to an agent
3. Listen for "Affirmative" sound
4. Wait for task to complete/fail
5. Hear completion/failure sound

### 📊 Active Missions Enhancement

**Location:** Bottom strip in Overseer mode

**New Metrics Displayed:**
- **Token Usage**: Percentage with color (red when >80%)
- **Iteration Progress**: Visual bar with X/Y iterations
- **Response Time**: Live counter showing action duration
- **Loop Detection**: Pulse animation + "LOOP" label

**Testing:**
1. Switch to Overseer mode (default)
2. Start a task
3. Watch the Active Missions strip update in real-time
4. Metrics should update every few seconds

### 🖥️ Tool Log Panel

**Access:** Click the Terminal icon (⌨️) in TopBar

**Features:**
- Scrolling log of all agent actions
- Color-coded by status (green/red/yellow)
- Auto-scroll with pause on hover
- Shows timestamps, agent IDs, actions, and durations

**Testing:**
1. Click Terminal icon in TopBar
2. Panel appears at bottom of screen
3. Execute a task
4. See real-time action logs appear
5. Hover over log to pause scrolling

### 📈 Real-Time Metrics (TopBar)

**ResourceBars now show:**
- **API Credits**: From actual task execution
- **Time**: Total time spent on tasks (minutes)
- **Iterations**: Total iterations across all tasks

**Note:** These update when tasks execute and metrics are tracked.

## Keyboard Shortcuts

None yet, but suggested for future:
- `Ctrl+M` - Toggle mute
- `Ctrl+L` - Toggle tool log
- `Ctrl+T` - Toggle chat

## Troubleshooting

### Audio Not Playing

**Check:**
1. Is the mute icon showing VolumeX (muted)? Click to unmute
2. Are audio files in `packages/ui/public/audio/`?
3. Check browser console for errors
4. Verify browser allows autoplay (some browsers block it)
5. Try clicking anywhere on the page first (user interaction required)

**Debug:**
```javascript
// In browser console:
localStorage.setItem('debug-audio', 'true');
// Reload page - audio manager will log all events
```

### Metrics Not Updating

**Check:**
1. Is WebSocket connected? (Look for connection status in bottom-right)
2. Are tasks actually executing?
3. Check browser console for WebSocket errors
4. Verify backend is emitting events

**Debug:**
```javascript
// In browser console:
useUIStore.getState().metrics
// Should show current metrics

useUIStore.getState().agentHealth
// Should show per-agent health data
```

### Tool Log Empty

**Check:**
1. Are there any execution logs? API: `GET http://localhost:3001/api/execution-logs`
2. Is the backend running?
3. Check browser network tab for failed API calls

### Loop Detection Not Working

**Check:**
1. Backend must emit `execution_step` events with `isLoop: true`
2. Check WebSocket events in browser dev tools
3. Verify `agentHealth` state updates: `useUIStore.getState().agentHealth`

## Configuration

### Audio Settings

**Location:** `packages/ui/src/store/uiState.ts`

```typescript
audioSettings: {
  muted: false,    // Change to true to start muted
  volume: 0.7,     // Change to 0.0-1.0 for different volume
}
```

### Tool Log Polling Interval

**Location:** `packages/ui/src/components/main-view/ToolLog.tsx`

```typescript
const interval = setInterval(fetchLogs, 2000); // Change 2000 to adjust milliseconds
```

### Agent Health Token Limits

**Location:** `packages/ui/src/store/uiState.ts`

```typescript
tokenBudget: {
  input: 0,
  output: 0,
  maxInput: 100000,   // Adjust max token limits
  maxOutput: 100000,
}
```

## Development Tips

### Adding New Audio Events

1. Add event type to `VoiceEvent` in `voicePacks.ts`
2. Add voice lines to `defaultVoicePack`
3. Create convenience function in `audioManager.ts`
4. Call it from appropriate WebSocket event handler in `useSocket.ts`

### Customizing Voice Packs

**Location:** `packages/ui/src/audio/voicePacks.ts`

```typescript
// Add custom voice pack
export const myCustomPack: Record<VoiceEvent, VoiceLine[]> = {
  task_assigned: [
    { event: 'task_assigned', audioFile: '/audio/custom/yes.mp3', text: 'Yes sir!' }
  ],
  // ... more events
};

// Use it
export const agentVoicePacks = {
  default: defaultVoicePack,
  coder: myCustomPack,  // Custom pack for coder agents
  // ...
};
```

### Testing Without Audio Files

The system gracefully fails if audio files are missing - it will log a warning but won't crash:

```
[AudioManager] Error playing sound: [error details]
```

The app will function normally, just without audio feedback.

## Next Steps

### Recommended Enhancements

1. **Add Cost Dashboard**: Complete the cost tracking visualization
2. **Agent Performance Charts**: Historical performance graphs
3. **Persistent Settings**: Save audio preferences to localStorage
4. **Custom Audio Upload**: UI for uploading custom voice packs
5. **Visual Audio Indicator**: Show which sound is playing
6. **Keyboard Shortcuts**: Quick access to features

### Backend Integration

For full functionality, ensure your backend emits these WebSocket events:

```typescript
// On task status change
socket.emit('task_updated', { payload: taskObject });

// On execution step
socket.emit('execution_step', {
  payload: {
    agentId: 'agent-123',
    action: 'file_write',
    input: '...',
    observation: '...',
    isLoop: false,        // Important for loop detection
    durationMs: 1234,     // Important for response time
    inputTokens: 100,     // Optional
    outputTokens: 200,    // Optional
  }
});

// On cost update
socket.emit('cost_updated', {
  payload: {
    totalCost: 1.23,
    byModelTier: { free: 0, haiku: 0.5, sonnet: 0.6, opus: 0.13 },
    totalTokens: { input: 10000, output: 5000, total: 15000 }
  }
});
```

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all dependencies installed
3. Ensure backend is running and accessible
4. Check WebSocket connection status
5. Review the `UI_ENHANCEMENTS_SUMMARY.md` for implementation details

Enjoy the enhanced Agent Battle Command Center! 🎮🔊
