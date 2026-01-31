# Agent Workflow Quality Enhancement Plan

## Overview

This plan addresses common agent failures: repeated actions, loop detection, hallucinated results, and dishonest success reporting. Priority is quality over speed - tasks can take longer, but failures must be clearly reported.

---

## Core Problems to Solve

1. Agent repeats same action multiple times without realizing
2. Agent claims success when actual output shows failure (e.g., "All tests passed" when "Ran 0 tests")
3. Agent gets stuck in loops without stopping to reflect
4. No clear distinction between real success and assumed success

---

## Solution 1: Action History & Duplicate Detection

Track every action in a history buffer. Before executing any action:

```
Check if EXACT duplicate (same action + same input) in last 5 actions
  → If yes: HARD STOP, enter reflection mode

Check if SIMILAR duplicate (same action, >80% similar input)
  → If yes: WARNING, require justification

Check if LOOP pattern (same action 3+ times, all failing)
  → If yes: HARD STOP, analyze root cause
```

When duplicate detected, agent must:
1. Stop execution immediately
2. State: What was I trying to do? Why did I repeat this?
3. Generate 3 alternative approaches
4. Pick best one with reasoning, or fail gracefully

---

## Solution 2: Honest Result Parsing

NEVER assume success. Parse actual output:

```
For test results:
- Extract actual numbers: tests_run, passed, failed, skipped
- "Ran 0 tests" means 0 tests, NOT success
- "OK" only valid if tests_run > 0

For command output:
- Empty output ≠ success
- Check exit codes
- Analyze stderr, don't ignore it

For file operations:
- Verify file exists after write
- Verify content matches intent
```

Forbidden behaviors:
- Claiming tests passed when output shows 0 tests ran
- Inventing test names not in actual output
- "Correcting" final answer without re-running verification
- Assuming success because no error was shown

---

## Solution 3: Failure Classification

Every task ends with one of these statuses:

```
SUCCESS: All criteria met AND verified with actual output
SOFT_FAILURE: Partial completion, some things worked
HARD_FAILURE: Cannot complete, clear blocker
UNCERTAIN: Could not verify, need human review
```

Never report SUCCESS without verification. When uncertain, say UNCERTAIN.

---

## Solution 4: Structured Failure Reports

When task fails or is uncertain, output:

```json
{
  "status": "HARD_FAILURE | SOFT_FAILURE | UNCERTAIN | SUCCESS",
  "confidence": 0.0-1.0,
  "summary": "One honest line",
  "what_was_attempted": ["step 1", "step 2"],
  "what_succeeded": ["file created"],
  "what_failed": ["tests did not run"],
  "actual_output": "Ran 0 tests in 0.000s",
  "failure_reason": "Test discovery failed - no tests found",
  "suggestions": ["Check test file naming", "Verify imports"],
  "requires_human_review": true
}
```

---

## Solution 5: Reflection Protocol

When triggered (by duplicate, failure, or unexpected result):

```
1. STOP all execution
2. Print state summary:
   - Goal: What am I trying to achieve?
   - Progress: What have I done so far?
   - Problem: What just went wrong?
   - Analysis: Why did this happen?
3. Generate alternatives (at least 3)
4. Select best approach with clear reasoning
5. If no good option: FAIL with detailed report
```

---

## Solution 6: Pre/Post Execution Checks

Before any action:
- Is this necessary for the goal?
- Have I already done this?
- What do I expect to happen?
- How will I verify success?

After any action:
- Did output match expectations?
- Parse ACTUAL results
- If mismatch: enter reflection mode
- Log verified result

---

## Configuration Recommendations

```yaml
quality_settings:
  max_duplicate_actions: 2        # stop after 2 identical actions
  max_similar_actions: 3          # stop after 3 similar actions  
  max_total_retries: 10           # give up after 10 total retries
  require_verification: true      # must verify before claiming success
  allow_uncertain_success: false  # uncertain = fail, not success

timeouts:
  task_timeout_minutes: 30        # quality over speed
  action_timeout_seconds: 300
  reflection_timeout_seconds: 60
```

---

## Example: Correct Behavior

Bad (current):
```
Action: file_write greeting.py → success
Action: file_write greeting.py → success (duplicate, no stop)
Action: file_write greeting.py → success (duplicate, no stop)
Action: run tests → "Ran 0 tests"
Final: "SUCCESS - All tests passed" ← WRONG, hallucinated
```

Good (with this plan):
```
Action: file_write greeting.py → success, logged
Action: file_write greeting.py → DUPLICATE DETECTED
  → STOP
  → Reflection: "Already created this file. Moving to next step."
Action: run tests → "Ran 0 tests"
  → Parse: tests_run=0
  → VALIDATION FAILED
  → Reflection: "No tests discovered. Check test structure."
Action: fix test file, re-run → "Ran 2 tests... OK"
  → Parse: tests_run=2, passed=2
  → VALIDATION PASSED
Final: "SUCCESS - 2 tests passed" ← Correct, verified
```

If fix fails:
```
Final: {
  "status": "SOFT_FAILURE",
  "summary": "Created files but tests did not execute",
  "actual_output": "Ran 0 tests in 0.000s",
  "failure_reason": "Test discovery failed",
  "requires_human_review": true
}
```

---

## Key Principles

1. **TRUST OUTPUT, NOT ASSUMPTIONS** - Parse what actually happened
2. **STOP ON REPETITION** - Loops mean confusion, not persistence  
3. **FAIL HONESTLY** - "I don't know" beats false "success"
4. **QUALITY OVER SPEED** - Take time to verify and reflect
5. **HELP HUMANS CONTINUE** - Good failure reports enable recovery

---

## Implementation Priority

1. Duplicate/loop detector (catches repeated actions)
2. Result parser (catches hallucinated success)
3. Reflection protocol (enables self-correction)
4. Structured failure reports (enables human review)
5. Pre/post validation hooks (prevents bad actions)
