"""Generate original military-themed voice packs using edge-tts.
Original TTS-generated military voice lines for agent events."""

import asyncio
import os
import edge_tts

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "packages", "ui", "public", "audio")

# Three original voice packs with different voices
PACKS = {
    "tactical": {
        "voice": "en-US-GuyNeural",
        "rate": "+5%",
        "lines": {
            "task_assigned": [
                ("acknowledged", "Acknowledged."),
                ("standing-by", "Standing by for orders."),
                ("ready-to-deploy", "Ready to deploy."),
                ("orders-received", "Orders received."),
                ("on-it", "On it, commander."),
                ("locked-in", "Locked in."),
            ],
            "task_in_progress": [
                ("moving-out", "Moving out."),
                ("operation-underway", "Operation underway."),
                ("executing-now", "Executing now."),
                ("engaging-target", "Engaging target."),
                ("in-position", "In position."),
                ("proceeding", "Proceeding to objective."),
            ],
            "task_milestone": [
                ("making-progress", "Making progress."),
                ("halfway-there", "Halfway there."),
                ("on-track", "On track, commander."),
            ],
            "task_completed": [
                ("mission-complete", "Mission complete."),
                ("objective-secured", "Objective secured."),
                ("target-neutralized", "Target neutralized."),
            ],
            "task_failed": [
                ("mission-failed", "Mission failed."),
                ("pulling-back", "Pulling back."),
            ],
            "agent_stuck": [
                ("requesting-backup", "Requesting backup."),
                ("need-assistance", "Need assistance."),
                ("pinned-down", "Pinned down."),
            ],
            "loop_detected": [
                ("going-in-circles", "Going in circles."),
                ("something-wrong", "Something's not right."),
                ("abort-abort", "Abort. Abort."),
                ("recalibrating", "Recalibrating."),
            ],
            "opus_review": [
                ("analyzing", "Analyzing."),
                ("running-diagnostics", "Running diagnostics."),
                ("checking-intel", "Checking intel."),
            ],
            "decomposition": [
                ("breaking-it-down", "Breaking it down."),
                ("planning-approach", "Planning approach."),
            ],
        },
    },
    "mission-control": {
        "voice": "en-US-JennyNeural",
        "rate": "+0%",
        "lines": {
            "task_assigned": [
                ("assignment-confirmed", "Assignment confirmed."),
                ("task-accepted", "Task accepted."),
                ("ready-for-tasking", "Ready for tasking."),
                ("copy-that", "Copy that."),
                ("roger-that", "Roger that."),
                ("affirmative", "Affirmative."),
            ],
            "task_in_progress": [
                ("commencing-operations", "Commencing operations."),
                ("systems-nominal", "Systems nominal."),
                ("on-approach", "On approach."),
                ("telemetry-is-good", "Telemetry is good."),
                ("all-systems-go", "All systems go."),
                ("in-the-pipeline", "In the pipeline."),
            ],
            "task_milestone": [
                ("checkpoint-reached", "Checkpoint reached."),
                ("looking-good", "Looking good."),
                ("steady-progress", "Steady progress."),
            ],
            "task_completed": [
                ("task-complete", "Task complete."),
                ("well-done", "Well done."),
                ("success-confirmed", "Success confirmed."),
            ],
            "task_failed": [
                ("task-unsuccessful", "Task unsuccessful."),
                ("negative-result", "Negative result."),
            ],
            "agent_stuck": [
                ("anomaly-detected", "Anomaly detected."),
                ("system-unresponsive", "System unresponsive."),
                ("intervention-required", "Intervention required."),
            ],
            "loop_detected": [
                ("pattern-detected", "Repeating pattern detected."),
                ("loop-identified", "Loop identified."),
                ("cycle-detected", "Cycle detected."),
                ("breaking-loop", "Breaking the loop."),
            ],
            "opus_review": [
                ("initiating-review", "Initiating review."),
                ("quality-check", "Quality check in progress."),
                ("scanning-output", "Scanning output."),
            ],
            "decomposition": [
                ("decomposing-task", "Decomposing task."),
                ("analyzing-structure", "Analyzing structure."),
            ],
        },
    },
    "field-command": {
        "voice": "en-GB-RyanNeural",
        "rate": "+3%",
        "lines": {
            "task_assigned": [
                ("understood", "Understood."),
                ("right-away", "Right away."),
                ("consider-it-done", "Consider it done."),
                ("at-once", "At once."),
                ("straight-away", "Straight away, sir."),
                ("on-the-case", "On the case."),
            ],
            "task_in_progress": [
                ("pressing-forward", "Pressing forward."),
                ("boots-on-ground", "Boots on the ground."),
                ("operational", "Operational."),
                ("en-route", "En route."),
                ("making-headway", "Making headway."),
                ("underway", "Underway."),
            ],
            "task_milestone": [
                ("solid-progress", "Solid progress."),
                ("getting-there", "Getting there."),
                ("phase-complete", "Phase complete."),
            ],
            "task_completed": [
                ("job-done", "Job done."),
                ("mission-accomplished", "Mission accomplished."),
                ("all-clear", "All clear."),
            ],
            "task_failed": [
                ("no-joy", "No joy."),
                ("falling-back", "Falling back."),
            ],
            "agent_stuck": [
                ("bogged-down", "Bogged down."),
                ("need-reinforcements", "Need reinforcements."),
                ("taking-fire", "Taking fire."),
            ],
            "loop_detected": [
                ("deja-vu", "Bit of deja vu here."),
                ("stuck-in-a-rut", "Stuck in a rut."),
                ("not-again", "Not again."),
                ("change-of-plan", "Change of plan."),
            ],
            "opus_review": [
                ("under-review", "Under review."),
                ("inspecting", "Inspecting."),
                ("double-checking", "Double checking."),
            ],
            "decomposition": [
                ("splitting-up", "Splitting it up."),
                ("dividing-forces", "Dividing forces."),
            ],
        },
    },
}


async def generate_pack(pack_name: str, config: dict):
    pack_dir = os.path.join(AUDIO_DIR, pack_name)
    os.makedirs(pack_dir, exist_ok=True)

    voice = config["voice"]
    rate = config["rate"]
    total = sum(len(lines) for lines in config["lines"].values())
    done = 0

    for event, lines in config["lines"].items():
        for filename, text in lines:
            filepath = os.path.join(pack_dir, f"{filename}.mp3")
            if os.path.exists(filepath):
                done += 1
                continue

            communicate = edge_tts.Communicate(text, voice, rate=rate)
            await communicate.save(filepath)
            done += 1
            print(f"  [{done}/{total}] {pack_name}/{filename}.mp3")


async def main():
    for pack_name, config in PACKS.items():
        print(f"\n=== Generating {pack_name} pack ({config['voice']}) ===")
        await generate_pack(pack_name, config)

    print("\n=== All packs generated! ===")


if __name__ == "__main__":
    asyncio.run(main())
