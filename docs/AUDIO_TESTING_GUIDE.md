# Audio Testing Guide

## Quick Start - Hear the Sounds!

### Step 1: Make Sure Everything is Running
```bash
# Start the full stack
docker compose up

# Or if already running, just verify:
# - UI: http://localhost:5173
# - API: http://localhost:3001
# - Agents: http://localhost:8000
```

### Step 2: Create Easy Test Tasks
```bash
# From project root
node scripts/create-easy-test-tasks.js
```

This creates 7 super easy tasks (complexity ~0) that will:
- Complete quickly (30 seconds - 2 minutes each)
- Trigger ALL the audio events
- Let you hear the military voice packs!

### Step 3: Watch and Listen!

**What to expect:**
1. **Task assigned** → "Acknowledged!" or "Orders received!"
2. **Agent starts** → "Moving out!" or "Operation underway!"
3. **Milestone** → "Making progress!" or "Halfway there!"
4. **Task completes** → "Mission complete!" or "Objective secured!"

---

## The 7 Easy Test Tasks

All these tasks are ridiculously simple - perfect for testing!

### 1. Add Two Numbers (2+2)
**What it does:** Creates `def add(a, b): return a + b`
**Complexity:** 0 - Trivial
**Expected time:** 30-60 seconds

### 2. Hello World
**What it does:** Creates `def hello(): return "Hello, World!"`
**Complexity:** 0 - Trivial
**Expected time:** 30 seconds

### 3. Multiply Function
**What it does:** Creates `def multiply(a, b): return a * b`
**Complexity:** 0 - Trivial
**Expected time:** 30-60 seconds

### 4. Get Timestamp
**What it does:** Returns current Unix timestamp
**Complexity:** 1 - Super easy (imports time module)
**Expected time:** 60 seconds

### 5. Reverse a String
**What it does:** Uses Python slice `[::-1]` to reverse
**Complexity:** 0 - Trivial
**Expected time:** 30 seconds

### 6. Check if Even
**What it does:** Returns `n % 2 == 0`
**Complexity:** 0 - Trivial
**Expected time:** 30 seconds

### 7. Get List Length
**What it does:** Returns `len(items)`
**Complexity:** 0 - Trivial
**Expected time:** 30 seconds

---

## Audio Event Testing Checklist

### Sounds You Should Hear

- [ ] **Task Assignment** (when tasks are created)
  - "Acknowledged" / "Standing by for orders" / "Ready to deploy"
  - "Orders received" / "On it, commander" / "Locked in"
  - (random from 6 options per voice pack)

- [ ] **Task In Progress** (when agent starts)
  - "Moving out" / "Operation underway" / "Executing now"
  - "Engaging target" / "In position" / "Proceeding to objective"

- [ ] **Milestone** (progress checkpoint)
  - "Making progress" / "Halfway there" / "On track, commander"

- [ ] **Task Completed**
  - "Mission complete" / "Objective secured" / "Target neutralized"

### Audio Controls to Test

- [ ] **Mute Toggle** (speaker icon in TopBar)
  - Click to mute → Icon changes to VolumeX (gray)
  - Click to unmute → Icon changes to Volume2 (green)
  - Sounds stop/start accordingly

- [ ] **Voice Pack Selector** - Switch between Tactical Ops, Mission Control, Field Command

- [ ] **Audio Persists** across UI interactions
  - Sounds don't interrupt each other
  - Queue system works (priority-based)

---

## UI Features to Watch

While testing audio, also check out:

### 1. Active Missions Strip (bottom)
```
┌────────────────────────────────────────────────┐
│ 🟢 coder-01 → Add two numbers           ⏳    │
│ ⚡2/3  [━━━━━░░░░░]  ⚡23%  ⏱️8s              │
└────────────────────────────────────────────────┘
```
Watch these update in real-time:
- **⚡2/3** - Iteration counter
- **Progress bar** - Visual iteration progress
- **⚡23%** - Token usage (turns red >80%)
- **⏱️8s** - Response time counter

### 2. Tool Log Panel
Click the **Terminal icon** in TopBar to see:
```
[14:32:05] coder-01   ✓ file_write: tasks/add_numbers.py    234ms
[14:32:07] coder-01   ⏱ shell_command: python -c "from...   1.2s
[14:32:09] coder-01   ✓ Success!                             89ms
```

### 3. TopBar Metrics
Watch these update as tasks execute:
- **API Credits** bar
- **Time** counter
- **Iterations** counter

---

## Perfect Testing Sequence

### The Ultimate Audio Experience

1. **Start fresh**
   ```bash
   # Make sure UI is open at http://localhost:5173
   # Make sure audio is unmuted (speaker icon should be green)
   ```

2. **Create all 7 tasks at once**
   ```bash
   node scripts/create-easy-test-tasks.js
   ```
   → You'll hear: **7 assignment sounds back-to-back!**
   - "Acknowledged!"
   - "Standing by for orders!"
   - "Ready to deploy!"
   - etc.

3. **Watch the show**
   - Open Tool Log (terminal icon)
   - Watch Active Missions strip
   - Listen to the military voice callouts!

4. **Wait for the finale**
   - As each task completes...
   - "Mission complete!" / "Objective secured!"

---

## Troubleshooting Audio

### No Sound?

**Check 1: Is mute off?**
- Look at TopBar - is the volume icon green?
- If gray (VolumeX), click to unmute

**Check 2: Browser audio**
- Some browsers block autoplay
- Click anywhere on the page first
- Check browser's site permissions (allow audio)

**Check 3: System volume**
- Make sure your computer isn't muted
- Check Windows/Mac volume mixer

**Check 4: Console errors**
- Open browser DevTools (F12)
- Look for errors in Console tab
- Should see: `[AudioManager] Playing: ...`

**Check 5: Audio files**
```bash
# Verify files exist
ls packages/ui/public/audio/tactical/
ls packages/ui/public/audio/mission-control/
ls packages/ui/public/audio/field-command/
# Should show 32 .mp3 files per directory
```

### Wrong Sounds Playing?

The mapping is in `packages/ui/src/audio/voicePacks.ts`
- Edit that file to change which sound plays when
- Changes take effect after page refresh

### Sounds Overlapping?

This shouldn't happen (queue system), but if it does:
- Open browser console
- Look for AudioManager logs
- May indicate multiple events firing simultaneously

---

## Advanced: Create Your Own Test Task

Want to create a custom task? Here's the API call:

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Custom Task",
    "description": "Create a simple function...",
    "taskType": "code",
    "requiredAgent": "coder",
    "priority": 3,
    "maxIterations": 3
  }'
```

**Or via UI:**
1. Click "Create Task" button
2. Fill in the form
3. Submit
4. "Acknowledged!" plays

---

## Expected Audio Timeline

```
00:00 - Run create-easy-test-tasks.js
00:01 - "Acknowledged!"
00:02 - "Standing by for orders!"
00:03 - "Ready to deploy!"
00:04 - "Orders received!"
00:05 - "On it, commander!"
00:06 - "Locked in!"

00:10 - First agent starts
00:11 - "Moving out!"

00:15 - Another agent starts
00:16 - "Operation underway!"

00:30 - Milestone reached
00:31 - "Making progress!"

00:45 - First task completes
00:46 - "Mission complete!"

01:00 - Second task completes
01:01 - "Objective secured!"

... more completions ...

02:00 - All tasks done
```

---

## Voice Packs

Three voice packs are included, each with 32 original TTS-generated lines:

| Pack | Voice | Style |
|------|-------|-------|
| **Tactical Ops** (default) | US male (Guy) | Commanding military operator |
| **Mission Control** | US female (Jenny) | NASA-style mission controller |
| **Field Command** | UK male (Ryan) | British field operations commander |

Switch between packs in the audio settings.

---

## Sound Quality Tips

All audio files are original TTS-generated military voice lines.

**If a sound is too loud/quiet:**
```typescript
// In packages/ui/src/store/uiState.ts
audioSettings: {
  muted: false,
  volume: 0.7,  // Adjust: 0.0 (silent) to 1.0 (max)
}
```

**If you want different sounds:**
1. Replace files in `packages/ui/public/audio/<pack-name>/`
2. Keep same filenames (or update voicePacks.ts)
3. Refresh page

**To regenerate voice lines:**
```bash
pip install edge-tts
python scripts/generate-voice-packs.py
```

---

**Questions?** Check the `AUDIO_EVENT_MAPPING.md` for detailed sound mappings!
