# Fix False-Positive Task Completions

> **Status:** IMPLEMENTED (Feb 12, 2026) - All 3 verification tests pass
> **Priority:** High — Tasks with failing tests are silently marked "completed"
> **Estimated effort:** ~30 min implementation, ~30 min testing

## Problem

Tasks are marked "completed" even when all tests fail. Example: File Upload Handler had 3/3 tests fail but was reported SUCCESS with confidence 1.0. This undermines the system's reliability metrics and prevents the retry/escalation cycle from triggering.

## Root Cause Analysis

Three bugs form a chain that allows test failures to be silently ignored:

### Bug 1 (Root Cause) — `packages/agents/src/schemas/output.py`
**"Files created = SUCCESS" override**

Both `_parse_from_execution_logs()` (~line 289) and `parse_agent_output()` (~line 509) have:
```python
elif has_meaningful_output:
    status = "SUCCESS"  # Ignores test failures!
    confidence = max(0.7, success_ratio)
```

The test validator (`test_validator.py`) correctly parses failures into `what_failed` and `test_results`, but this branch overrides everything when files exist. The `TestResult.is_valid_success` property (line 27-34 of `test_validator.py`) already correctly identifies test failures — it's just never checked during status determination.

### Bug 2 — `packages/agents/src/main.py` line 376
**Hardcoded `success=True`**

```python
return ExecuteResponse(success=True, ...)  # Always True if no exception!
```

Ignores `structured_output.success` which could correctly be `False` after Bug 1 is fixed.

### Bug 3 — `packages/api/src/services/taskExecutor.ts`
**No validation before marking complete**

`handleTaskCompletion()` (line 76) blindly marks tasks "completed" without checking execution logs for test failures. All three call sites (`autoAssignNextTask`, execute route, complete endpoint) trust `result.success` without validation.

### End-to-End Flow (Current, Broken)
```
Agent creates files + runs tests (tests FAIL)
  → output.py: files exist → status = SUCCESS (Bug 1)
  → main.py: success = True (hardcoded, Bug 2)
  → executor.ts: passes through success = True
  → taskExecutor.ts: marks task "completed" (Bug 3, no validation)
```

## Implementation Plan

### Step 1: Fix `packages/agents/src/schemas/output.py`

**In BOTH `_parse_from_execution_logs()` and `parse_agent_output()`:**

**A.** Add `parsed_test_result = None` alongside existing tracking vars (after `actual_test_output = None`, around lines 168 and 352)

**B.** Where `parse_test_output()` is called (lines ~229 and ~449), store the TestResult object:
```python
parsed = parse_test_output(observation)
parsed_test_result = parsed  # ADD: keep TestResult reference for status check
if parsed.tests_run > 0:
    test_results = parsed.summary
# ... rest unchanged
```

**C.** Replace the `elif has_meaningful_output:` branch (~lines 289-304 and ~509-524) with test-failure-aware logic:
```python
elif has_meaningful_output:
    # Files were created - but check if tests FAILED
    if parsed_test_result and parsed_test_result.tests_run > 0 and not parsed_test_result.is_valid_success:
        # Tests ran and FAILED - this is NOT success even if files exist
        status = "SOFT_FAILURE"
        confidence = parsed_test_result.success_rate
        failure_reason = f"Tests failed: {parsed_test_result.summary}"
        if parsed_test_result.tests_failed > 0:
            suggestions.append(f"{parsed_test_result.tests_failed} test(s) failed - review test output")
        if parsed_test_result.tests_errors > 0:
            suggestions.append(f"{parsed_test_result.tests_errors} test error(s) - check for exceptions")
    else:
        # No tests ran or all tests passed = SUCCESS
        status = "SUCCESS"
        confidence = max(0.7, success_ratio)
    if hit_iteration_limit:
        suggestions.append("Task completed but hit iteration limit - consider optimizing")
    if hit_loop:
        suggestions.append("Some loops detected but task completed")
```

**Behavior matrix after fix:**
| Scenario | Before | After |
|----------|--------|-------|
| Files created + no tests ran | SUCCESS | SUCCESS (unchanged) |
| Files created + all tests pass | SUCCESS | SUCCESS (unchanged) |
| Files created + some tests fail | SUCCESS | **SOFT_FAILURE** |
| Files created + all tests fail | SUCCESS | **SOFT_FAILURE** |
| No files + tests fail | SOFT_FAILURE | SOFT_FAILURE (unchanged) |

### Step 2: Fix `packages/agents/src/main.py`

**One-line change at line 376:**

```python
# Before:
return ExecuteResponse(
    success=True,

# After:
return ExecuteResponse(
    success=structured_output.success,
```

### Step 3: Fix `packages/api/src/services/taskExecutor.ts`

**A.** Add validation at the top of `handleTaskCompletion()`, after the task lookup (line 83) but before file lock release (line 86):

```typescript
// === SAFETY NET: Validate test results from agent output ===
if (result.output && typeof result.output === 'string') {
  try {
    const agentOutput = JSON.parse(result.output);
    if (this.detectTestFailures(agentOutput)) {
      console.warn(
        `[TaskExecutor] Task ${taskId} reported success but has test failures - redirecting to failure handler`
      );
      const failureReason = agentOutput.failure_reason
        || agentOutput.test_results
        || 'Tests failed but task was reported as successful';
      await this.handleTaskFailure(taskId, failureReason);
      return;
    }
  } catch {
    // If output isn't valid JSON, skip validation
  }
}
```

**B.** Add private `detectTestFailures()` method to the `TaskExecutor` class:

```typescript
/**
 * Detect test failures in agent output JSON.
 * Returns true if tests were run and failed.
 * Returns false if no tests ran or all tests passed.
 */
private detectTestFailures(agentOutput: Record<string, unknown>): boolean {
  // Check 1: success field is explicitly false
  if (agentOutput.success === false) {
    return true;
  }

  // Check 2: test_results string contains FAILURE indicator
  if (typeof agentOutput.test_results === 'string') {
    const tr = agentOutput.test_results.toUpperCase();
    if (tr.includes('FAILURE -') && (tr.includes('FAILED') || tr.includes('ERRORS'))) {
      return true;
    }
  }

  return false;
}
```

### Step 4: Clean Up + Verify

1. Delete the 4 stale pending tasks from before the crash
2. Rebuild Docker containers (`docker compose up --build -d`)
3. Run verification tests (see below)

## Verification Plan

### Test 1: Files + failing tests → should get SOFT_FAILURE
Create a task like: "Create a Python function that adds two numbers, include a test that deliberately fails"
- Expected: status = SOFT_FAILURE, success = false, task enters retry cycle

### Test 2: Files + passing tests → should get SUCCESS
Create a task like: "Create a greet(name) function with a test that verifies it works"
- Expected: status = SUCCESS, success = true, task marked completed (no regression)

### Test 3: Files + no tests → should get SUCCESS
Create a task like: "Create a hello_world.py that prints hello"
- Expected: status = SUCCESS, success = true, task marked completed (no regression)

### Test 4: Re-run File Upload Handler
Re-create the original failing task and verify it gets caught this time.

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `packages/agents/src/schemas/output.py` | Add test failure check in status determination (2 functions) | ~168, 229, 289-304, 352, 449, 509-524 |
| `packages/agents/src/main.py` | Use `structured_output.success` instead of hardcoded `True` | 376 |
| `packages/api/src/services/taskExecutor.ts` | Add `detectTestFailures()` + validation in `handleTaskCompletion()` | 76-83 (insert), new method |

## Key Dependencies (No Changes Needed)

| File | Why Referenced |
|------|----------------|
| `packages/agents/src/validators/test_validator.py` | `TestResult.is_valid_success` property — already works correctly |
| `packages/api/src/services/codeReviewService.ts` | Escalation path (Ollama→Haiku→Human) — already works, will trigger once failures are properly reported |

## Risk Assessment

- **False negatives (marking passing tasks as failures):** Low risk. The condition requires `parsed_test_result.tests_run > 0 AND NOT is_valid_success`. Tasks without tests are unaffected. The test validator only returns `is_valid_success=False` when `tests_failed > 0` or `tests_errors > 0`.
- **Multiple test runs:** If agent runs tests, fixes code, runs again — only the last `parsed_test_result` is kept. This is correct (we want the final result).
- **Performance:** Negligible. One JSON.parse in the API safety net per task completion.
