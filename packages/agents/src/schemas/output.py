"""Structured output schemas for agent execution results."""
import os
from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class AgentOutput(BaseModel):
    """Structured output format that all agents must follow."""

    # Status classification
    status: Literal["SUCCESS", "SOFT_FAILURE", "HARD_FAILURE", "UNCERTAIN"] = Field(
        default="SUCCESS",
        description="Task completion status: SUCCESS (verified complete), SOFT_FAILURE (partial), HARD_FAILURE (blocked), UNCERTAIN (unverified)"
    )

    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence in result (0.0-1.0). Use <1.0 if uncertain about success."
    )

    summary: str = Field(
        description="Brief summary of what was accomplished (1-2 sentences)"
    )

    # File tracking
    files_created: List[str] = Field(
        default_factory=list,
        description="List of file paths created during execution"
    )

    files_modified: List[str] = Field(
        default_factory=list,
        description="List of file paths modified during execution"
    )

    files_read: List[str] = Field(
        default_factory=list,
        description="List of file paths read during execution"
    )

    # Execution tracking
    commands_executed: List[str] = Field(
        default_factory=list,
        description="List of shell commands executed"
    )

    test_results: Optional[str] = Field(
        None,
        description="Results from running tests (if applicable) - include actual test counts"
    )

    # Legacy field (kept for backwards compatibility)
    success: bool = Field(
        default=True,
        description="Whether the task completed successfully (legacy field, use status instead)"
    )

    details: Optional[str] = Field(
        None,
        description="Additional details, code snippets, or explanations"
    )

    # NEW: Failure tracking fields
    what_was_attempted: List[str] = Field(
        default_factory=list,
        description="List of steps/actions attempted during execution"
    )

    what_succeeded: List[str] = Field(
        default_factory=list,
        description="List of steps/actions that completed successfully"
    )

    what_failed: List[str] = Field(
        default_factory=list,
        description="List of steps/actions that failed"
    )

    actual_output: Optional[str] = Field(
        None,
        description="Actual command/test output for verification (especially important for failures)"
    )

    failure_reason: Optional[str] = Field(
        None,
        description="Clear explanation of why task failed or is uncertain"
    )

    suggestions: List[str] = Field(
        default_factory=list,
        description="Actionable suggestions for fixing issues or continuing work"
    )

    requires_human_review: bool = Field(
        default=False,
        description="Whether this result needs human review (set true for UNCERTAIN or complex failures)"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "status": "SUCCESS",
                    "confidence": 1.0,
                    "summary": "Created a prime number module with 3 Python files and verified all tests pass",
                    "files_created": ["tasks/prime_checker.py", "tasks/prime_generator.py", "tests/test_primes.py"],
                    "files_modified": [],
                    "files_read": [],
                    "commands_executed": ["python tests/test_primes.py"],
                    "test_results": "Ran 4 tests in 0.002s. All passed. First 10 primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]",
                    "success": True,
                    "details": "The is_prime function uses trial division up to sqrt(n). The generate_primes function uses is_prime to find the first N primes.",
                    "what_was_attempted": ["Create prime_checker.py", "Create prime_generator.py", "Create test file", "Run tests"],
                    "what_succeeded": ["Created all 3 files", "Tests executed successfully", "All assertions passed"],
                    "what_failed": [],
                    "actual_output": "Ran 4 tests in 0.002s\n\nOK",
                    "failure_reason": None,
                    "suggestions": [],
                    "requires_human_review": False
                },
                {
                    "status": "SOFT_FAILURE",
                    "confidence": 0.5,
                    "summary": "Created test file but tests did not execute due to import error",
                    "files_created": ["tests/test_module.py"],
                    "files_modified": [],
                    "files_read": ["tasks/module.py"],
                    "commands_executed": ["python tests/test_module.py"],
                    "test_results": "Ran 0 tests in 0.000s",
                    "success": False,
                    "details": "Test file was created with proper structure, but test discovery failed.",
                    "what_was_attempted": ["Create test file", "Run tests", "Verify results"],
                    "what_succeeded": ["Created test file with proper naming"],
                    "what_failed": ["Test execution - no tests discovered"],
                    "actual_output": "Ran 0 tests in 0.000s\n\nOK",
                    "failure_reason": "Test discovery failed - possibly due to incorrect imports or test file not in correct location",
                    "suggestions": [
                        "Verify test file is in tests/ folder",
                        "Check that imports use: sys.path.insert(0, '/app/workspace')",
                        "Verify test functions start with 'test_'",
                        "Run with pytest -v for more details"
                    ],
                    "requires_human_review": True
                }
            ]
        }


def _parse_from_execution_logs(logs: List[dict], raw_output: str) -> AgentOutput:
    """
    Parse structured output from execution logs fetched from API.

    This provides accurate tracking since logs are captured in real-time
    as tools execute, rather than parsing potentially truncated output.
    """
    from ..validators.test_validator import parse_test_output

    # Initialize tracking lists
    files_created = []
    files_modified = []
    files_read = []
    commands_executed = []
    what_was_attempted = []
    what_succeeded = []
    what_failed = []
    test_results = None
    actual_test_output = None
    parsed_test_result = None

    # Process each logged action
    for log in logs:
        action = log.get('action', 'unknown')
        action_input = log.get('actionInput', {})
        observation = log.get('observation', '')
        is_loop = log.get('isLoop', False)
        error_trace = log.get('errorTrace')

        # Track what was attempted
        path_or_cmd = action_input.get('path', action_input.get('command', ''))
        what_was_attempted.append(f"{action}: {path_or_cmd}")

        # Check if action succeeded or failed
        # Strip [stderr] prefix before checking - stderr is just a stream name, not an error
        observation_for_check = observation.lower()
        if observation_for_check.startswith('[stderr]'):
            observation_for_check = observation_for_check[8:].strip()

        success_indicators = ['successfully', 'success', 'created', 'wrote', 'passed', ' ok', '\nok']
        # Use more specific fail indicators to avoid false positives
        # 'error:' and ' error' avoid matching 'stderr', 'error' in variable names, etc.
        fail_indicators = ['error:', ' error', 'failed', 'failure', 'exception', 'traceback', 'not found', 'no such file']

        has_success = any(ind in observation_for_check for ind in success_indicators)
        has_failure = any(ind in observation_for_check for ind in fail_indicators) or error_trace

        if has_success and not has_failure:
            what_succeeded.append(f"{action}: {path_or_cmd}")
        elif has_failure and not has_success:
            # Only mark as failed if there's no success indicator
            what_failed.append(f"{action}: {observation[:100]}")

        # Extract based on action type
        if action == 'file_write':
            path = action_input.get('path', '')
            # Check for successful write - look for 'successfully wrote' or similar
            write_success = 'successfully' in observation.lower() or 'wrote' in observation.lower()
            if path and (write_success or (has_success and not has_failure)):
                files_created.append(path)

        elif action == 'file_edit':
            path = action_input.get('path', '')
            if path and has_success:
                files_modified.append(path)

        elif action == 'file_read':
            path = action_input.get('path', '')
            if path:
                files_read.append(path)

        elif action == 'shell_run':
            command = action_input.get('command', '')
            if command:
                commands_executed.append(command)

                # Check if this is a test command
                if any(test_cmd in command for test_cmd in ['pytest', 'python -m unittest', 'test', 'python tests/']):
                    actual_test_output = observation
                    # Parse test results
                    parsed = parse_test_output(observation)
                    parsed_test_result = parsed  # Keep TestResult reference for status check
                    if parsed.tests_run > 0:
                        test_results = parsed.summary
                    else:
                        test_results = "Tests ran but no test results found in output"
                        if parsed.tests_run == 0:
                            what_failed.append(f"Test execution: {parsed.summary}")

    # Deduplicate lists
    files_created = list(dict.fromkeys(files_created))
    files_modified = list(dict.fromkeys(files_modified))
    files_read = list(dict.fromkeys(files_read))
    commands_executed = list(dict.fromkeys(commands_executed))

    # Generate summary
    summary_parts = []
    if files_created:
        summary_parts.append(f"Created {len(files_created)} file(s)")
    if files_modified:
        summary_parts.append(f"modified {len(files_modified)}")
    if commands_executed:
        summary_parts.append(f"ran {len(commands_executed)} command(s)")
    if test_results:
        summary_parts.append(f"tests: {test_results}")

    summary = ", ".join(summary_parts) if summary_parts else "Task completed"

    # Determine status
    status = "SUCCESS"
    confidence = 1.0
    failure_reason = None
    suggestions = []

    # Check for issues
    raw_output_lower = raw_output.lower()
    hit_iteration_limit = "iteration limit" in raw_output_lower or "time limit" in raw_output_lower
    hit_loop = any(log.get('isLoop') for log in logs) or "loop detected" in raw_output_lower

    # Calculate actual success metrics
    has_meaningful_output = bool(files_created or files_modified)
    success_ratio = len(what_succeeded) / max(len(what_succeeded) + len(what_failed), 1)

    # Determine status based on ACTUAL OUTCOMES, not just iteration limit
    if hit_loop and not has_meaningful_output:
        # Loop with no output = definite failure
        status = "SOFT_FAILURE"
        confidence = 0.3
        failure_reason = "Agent detected action loop - repeated same action multiple times"
        suggestions.append("Agent got stuck repeating same action")
    elif what_failed and not has_meaningful_output:
        # Failures with no output
        status = "SOFT_FAILURE" if what_succeeded else "HARD_FAILURE"
        confidence = success_ratio
        failure_reason = "; ".join(what_failed[:3])  # Limit to first 3 failures
    elif test_results and "NO TESTS RAN" in test_results and not has_meaningful_output:
        status = "SOFT_FAILURE"
        confidence = 0.3
        failure_reason = "Tests executed but no tests were discovered or ran"
        suggestions.append("Check test file location and naming")
        suggestions.append("Verify test functions start with 'test_'")
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
    elif hit_iteration_limit:
        # Hit limit with NO meaningful output = actual failure
        status = "SOFT_FAILURE"
        confidence = 0.4
        failure_reason = "Agent stopped due to iteration or time limit before completing task"
        suggestions.append("Increase maxIterations for complex tasks")
        suggestions.append("Break down into smaller subtasks")

    return AgentOutput(
        status=status,
        confidence=confidence,
        summary=summary,
        files_created=files_created,
        files_modified=files_modified,
        files_read=files_read,
        commands_executed=commands_executed,
        test_results=test_results,
        success=(status == "SUCCESS"),
        details=raw_output[:2000] + "..." if len(raw_output) > 2000 else raw_output,
        what_was_attempted=what_was_attempted,
        what_succeeded=what_succeeded,
        what_failed=what_failed,
        actual_output=actual_test_output,
        failure_reason=failure_reason,
        suggestions=suggestions,
        requires_human_review=(status != "SUCCESS")
    )


def parse_agent_output(raw_output: str, task_id: Optional[str] = None, api_url: str = "http://api:3001") -> AgentOutput:
    """
    Parse agent output text into structured format.

    First tries to fetch execution logs from API for accurate tracking.
    Falls back to parsing raw output if logs unavailable.

    Args:
        raw_output: Raw CrewAI output text
        task_id: Optional task ID to fetch execution logs
        api_url: API base URL for fetching logs
    """
    import json
    import re
    from ..validators.test_validator import parse_test_output

    # Initialize tracking lists
    files_created = []
    files_modified = []
    files_read = []
    commands_executed = []
    what_was_attempted = []
    what_succeeded = []
    what_failed = []
    test_results = None
    actual_test_output = None
    parsed_test_result = None

    # Try to fetch execution logs from API if task_id provided
    if task_id:
        try:
            import requests
            api_key = os.environ.get("API_KEY", "")
            headers = {"X-API-Key": api_key} if api_key else {}
            response = requests.get(f"{api_url}/api/execution-logs/task/{task_id}", headers=headers, timeout=5)
            if response.status_code == 200:
                logs = response.json()
                return _parse_from_execution_logs(logs, raw_output)
        except Exception as e:
            print(f"⚠️  Could not fetch execution logs: {e}")
            print("   Falling back to parsing raw output...")
            # Fall through to parse raw output

    # Try to find structured JSON output first
    json_match = re.search(r'\{[\s\S]*"summary"[\s\S]*\}', raw_output)
    if json_match:
        try:
            data = json.loads(json_match.group())
            # If it has populated fields, use it directly
            if data.get('files_created') or data.get('commands_executed'):
                return AgentOutput(**data)
        except (json.JSONDecodeError, ValueError):
            pass

    # Extract all action blocks (both JSON and text format)
    # Pattern 1: JSON blocks with Action/Action Input/Observation
    json_blocks = re.finditer(
        r'\{[^}]*"(?:Thought|Action)"[^}]*"Action":\s*"([^"]+)"[^}]*"Action Input":\s*(\{[^}]+\})[^}]*"Observation":\s*"([^"]+)"[^}]*\}',
        raw_output,
        re.DOTALL
    )

    # Pattern 2: Text format "Action: tool\nAction Input: {...}\nObservation: ..."
    text_blocks = re.finditer(
        r'Action:\s*(\w+)\s*\n\s*Action Input:\s*(\{[^\n]+\})\s*(?:\n|$).*?Observation:\s*([^\n]+)',
        raw_output,
        re.DOTALL | re.IGNORECASE
    )

    for match in list(json_blocks) + list(text_blocks):
        action = match.group(1).strip()
        try:
            action_input = json.loads(match.group(2))
        except (json.JSONDecodeError, ValueError, TypeError):
            action_input = {}
        observation = match.group(3).strip()

        # Track what was attempted
        what_was_attempted.append(f"{action}: {action_input.get('path', action_input.get('command', 'unknown'))}")

        # Check if action succeeded or failed
        # Strip [stderr] prefix before checking - stderr is just a stream name, not an error
        observation_for_check = observation.lower()
        if observation_for_check.startswith('[stderr]'):
            observation_for_check = observation_for_check[8:].strip()

        success_indicators = ['successfully', 'success', 'created', 'wrote', 'passed', ' ok', '\nok']
        # Use more specific fail indicators to avoid false positives
        fail_indicators = ['error:', ' error', 'failed', 'failure', 'exception', 'traceback', 'not found', 'no such file']

        has_success = any(ind in observation_for_check for ind in success_indicators)
        has_failure = any(ind in observation_for_check for ind in fail_indicators)

        if has_success and not has_failure:
            what_succeeded.append(f"{action}: {action_input.get('path', action_input.get('command', ''))}")
        elif has_failure and not has_success:
            what_failed.append(f"{action}: {observation}")

        # Extract based on action type
        if action == 'file_write':
            path = action_input.get('path', '')
            # Check for successful write
            write_success = 'successfully' in observation.lower() or 'wrote' in observation.lower()
            if path and (write_success or (has_success and not has_failure)):
                files_created.append(path)

        elif action == 'file_edit':
            path = action_input.get('path', '')
            if path and 'successfully' in observation_for_check:
                files_modified.append(path)

        elif action == 'file_read':
            path = action_input.get('path', '')
            if path:
                files_read.append(path)

        elif action == 'shell_run':
            command = action_input.get('command', '')
            if command:
                commands_executed.append(command)

                # Check if this is a test command
                if any(test_cmd in command for test_cmd in ['pytest', 'python -m unittest', 'test', 'python tests/']):
                    actual_test_output = observation
                    # Parse test results
                    parsed = parse_test_output(observation)
                    parsed_test_result = parsed  # Keep TestResult reference for status check
                    if parsed.tests_run > 0:
                        test_results = parsed.summary
                    else:
                        test_results = "Tests ran but no test results found in output"
                        if parsed.tests_run == 0:
                            what_failed.append(f"Test execution: {parsed.summary}")

    # Deduplicate lists
    files_created = list(dict.fromkeys(files_created))
    files_modified = list(dict.fromkeys(files_modified))
    files_read = list(dict.fromkeys(files_read))
    commands_executed = list(dict.fromkeys(commands_executed))

    # Generate summary
    summary_parts = []
    if files_created:
        summary_parts.append(f"Created {len(files_created)} file(s)")
    if files_modified:
        summary_parts.append(f"modified {len(files_modified)}")
    if commands_executed:
        summary_parts.append(f"ran {len(commands_executed)} command(s)")
    if test_results:
        summary_parts.append(f"tests: {test_results}")

    summary = ", ".join(summary_parts) if summary_parts else "Task completed"

    # Determine status
    status = "SUCCESS"
    confidence = 1.0
    failure_reason = None
    suggestions = []

    # Check for iteration/time limit
    raw_output_lower = raw_output.lower()
    hit_iteration_limit = "iteration limit" in raw_output_lower or "time limit" in raw_output_lower
    hit_loop = "i tried reusing the same input" in raw_output_lower or "must stop using this action" in raw_output_lower

    # Calculate actual success metrics
    has_meaningful_output = bool(files_created or files_modified)
    success_ratio = len(what_succeeded) / max(len(what_succeeded) + len(what_failed), 1)

    # Determine status based on ACTUAL OUTCOMES, not just iteration limit
    if hit_loop and not has_meaningful_output:
        # Loop with no output = definite failure
        status = "SOFT_FAILURE"
        confidence = 0.3
        failure_reason = "Agent detected action loop - repeated same action multiple times"
        suggestions.append("Agent got stuck repeating same action")
    elif what_failed and not has_meaningful_output:
        # Failures with no output
        status = "SOFT_FAILURE" if what_succeeded else "HARD_FAILURE"
        confidence = success_ratio
        failure_reason = "; ".join(what_failed[:3])  # Limit to first 3 failures
    elif test_results and "NO TESTS RAN" in test_results and not has_meaningful_output:
        status = "SOFT_FAILURE"
        confidence = 0.3
        failure_reason = "Tests executed but no tests were discovered or ran"
        suggestions.append("Check test file location and naming")
        suggestions.append("Verify test functions start with 'test_'")
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
    elif hit_iteration_limit:
        # Hit limit with NO meaningful output = actual failure
        status = "SOFT_FAILURE"
        confidence = 0.4
        failure_reason = "Agent stopped due to iteration or time limit before completing task"
        suggestions.append("Increase maxIterations for complex tasks")
        suggestions.append("Break down into smaller subtasks")

    return AgentOutput(
        status=status,
        confidence=confidence,
        summary=summary,
        files_created=files_created,
        files_modified=files_modified,
        files_read=files_read,
        commands_executed=commands_executed,
        test_results=test_results,
        success=(status == "SUCCESS"),
        details=raw_output[:2000] + "..." if len(raw_output) > 2000 else raw_output,
        what_was_attempted=what_was_attempted,
        what_succeeded=what_succeeded,
        what_failed=what_failed,
        actual_output=actual_test_output,
        failure_reason=failure_reason,
        suggestions=suggestions,
        requires_human_review=(status != "SUCCESS")
    )
