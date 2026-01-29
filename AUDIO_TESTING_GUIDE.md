# 🎮 Audio Testing Guide - Have Some Fun!

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
- Let you hear the C&C Red Alert sounds!

### Step 3: Watch and Listen! 🔊

**What to expect:**
1. **Task assigned** → 🔊 "Conscript reporting!" or "Aye commander!"
2. **Agent starts** → 🔊 "Operation underway!" or "Analyzing schematics!"
3. **Iteration 2** → 🔊 "Got the plans right here!"
4. **Task completes** → 🔊 **"SHAKE IT BABY!"** ⭐ (The best one!)

---

## 🎯 The 7 Easy Test Tasks

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

## 🎵 Audio Event Testing Checklist

### ✅ Sounds You Should Hear

- [ ] **Task Assignment** (when tasks are created)
  - "Conscript reporting!"
  - "Aye commander!"
  - "Order received!"
  - "Mission sir!"
  - etc. (random from 8 options)

- [ ] **Task In Progress** (when agent starts)
  - "Operation underway!"
  - "Analyzing schematics!"
  - "Main engines engaged!"
  - etc. (random from 5 options)

- [ ] **Milestone** (every 2 iterations)
  - "Got the plans right here!"
  - "Good to go!"

- [ ] **Task Completed** (THE BEST ONE!)
  - **"Shake it baby!"** ← Classic C&C sound! 🎉
  - "Commander"

### 🎚️ Audio Controls to Test

- [ ] **Mute Toggle** (🔊 icon in TopBar)
  - Click to mute → Icon changes to VolumeX (gray)
  - Click to unmute → Icon changes to Volume2 (green)
  - Sounds stop/start accordingly

- [ ] **Audio Persists** across UI interactions
  - Sounds don't interrupt each other
  - Queue system works (max 5 sounds queued)

---

## 🖥️ UI Features to Watch

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
Click the **Terminal icon (⌨️)** in TopBar to see:
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

## 🎬 Perfect Testing Sequence

### The Ultimate Audio Experience

1. **Start fresh**
   ```bash
   # Make sure UI is open at http://localhost:5173
   # Make sure audio is unmuted (🔊 icon should be green)
   ```

2. **Create all 7 tasks at once**
   ```bash
   node scripts/create-easy-test-tasks.js
   ```
   → You'll hear: **7 assignment sounds back-to-back!**
   - "Conscript reporting!"
   - "Aye commander!"
   - "Order received!"
   - etc.

3. **Watch the show**
   - Open Tool Log (⌨️ icon)
   - Watch Active Missions strip
   - Listen to the symphony of C&C sounds!

4. **Wait for the finale**
   - As each task completes...
   - 🔊 "SHAKE IT BABY!" 🎉
   - Multiple tasks = Multiple shake-it-babies!

---

## 🐛 Troubleshooting Audio

### No Sound?

**Check 1: Is mute off?**
- Look at TopBar - is the volume icon green (🔊)?
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
ls -la packages/ui/public/audio/
# Should show all .mp3 files
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

## 🎯 Advanced: Create Your Own Test Task

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
4. 🔊 "Aye commander!"

---

## 🎊 Expected Audio Timeline

```
00:00 - Run create-easy-test-tasks.js
00:01 - 🔊 "Conscript reporting!"
00:02 - 🔊 "Aye commander!"
00:03 - 🔊 "Order received!"
00:04 - 🔊 "Mission sir!"
00:05 - 🔊 "Good to go!"
00:06 - 🔊 "Agent ready!"
00:07 - 🔊 "Anytime boss!"

00:10 - First agent starts
00:11 - 🔊 "Operation underway!"

00:15 - Another agent starts
00:16 - 🔊 "Analyzing schematics!"

00:30 - First task iteration 2
00:31 - 🔊 "Got the plans right here!"

00:45 - First task completes
00:46 - 🔊 "SHAKE IT BABY!" 🎉

01:00 - Second task completes
01:01 - 🔊 "SHAKE IT BABY!" 🎉

... more shake-it-babies as tasks complete ...

02:00 - All tasks done
       You: 😄 "This is awesome!"
```

---

## 🎮 Pro Tips for Maximum Fun

1. **Create all 7 tasks at once** - Hear a barrage of assignment sounds!

2. **Watch the Active Missions** - See them light up with activity

3. **Open the Tool Log** - Watch the terminal-style action feed

4. **Test the mute toggle** - Turn audio on/off during execution

5. **Create more tasks** - The more tasks, the more sounds!

6. **Try different agents** - Coder vs QA agents (same sounds for now, but could customize)

7. **Celebrate each "Shake it baby!"** - It's the best sound! 🎉

---

## 🎵 Sound Quality Tips

All your audio files are C&C Red Alert originals! They should sound crisp and nostalgic.

**If a sound is too loud/quiet:**
```typescript
// In packages/ui/src/store/uiState.ts
audioSettings: {
  muted: false,
  volume: 0.7,  // Adjust: 0.0 (silent) to 1.0 (max)
}
```

**If you want different sounds:**
1. Replace files in `packages/ui/public/audio/`
2. Keep same filenames (or update voicePacks.ts)
3. Refresh page

---

## 🏆 Achievement Unlocked

When you hear your first "Shake it baby!" you'll know the system is working perfectly! 🎉

Enjoy commanding your elite team of coding agents with authentic C&C Red Alert audio! 🎖️

---

**Questions?** Check the `AUDIO_EVENT_MAPPING.md` for detailed sound mappings!
