# Voice Packs for Agent Battle Command Center

Original TTS-generated military voice lines. No copyrighted game audio.

## Voice Packs

| Pack | Voice | Description |
|------|-------|-------------|
| **Tactical Ops** (default) | US male (Guy) | Commanding military operator |
| **Mission Control** | US female (Jenny) | NASA-style mission controller |
| **Field Command** | UK male (Ryan) | British field operations commander |

Each pack has 32 voice lines covering 9 events:
- `task_assigned` (6 lines) - Agent receives a task
- `task_in_progress` (6 lines) - Execution starts
- `task_milestone` (3 lines) - Progress checkpoint
- `task_completed` (3 lines) - Task succeeds
- `task_failed` (2 lines) - Task fails
- `agent_stuck` (3 lines) - Agent hangs
- `loop_detected` (4 lines) - Infinite loop
- `opus_review` (3 lines) - Code review started
- `decomposition` (2 lines) - Task decomposition

## Regenerating Voice Lines

Voice lines are generated using `edge-tts` (Microsoft Edge TTS, free):

```bash
pip install edge-tts
python scripts/generate-voice-packs.py
```

## Creating Custom Voice Packs

1. Create a new directory under `packages/ui/public/audio/your-pack-name/`
2. Add 32 `.mp3` files matching the event structure above
3. Add your pack to `packages/ui/src/audio/voicePacks.ts`
4. Community voice pack contributions are welcome!
