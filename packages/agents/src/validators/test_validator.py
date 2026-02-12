"""Test output parser and validator.

Parses test framework outputs to extract actual test counts and results.
Prevents agents from hallucinating test success.
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class TestResult:
    """Parsed test execution results."""

    tests_run: int = 0
    tests_passed: int = 0
    tests_failed: int = 0
    tests_skipped: int = 0
    tests_errors: int = 0

    duration_seconds: Optional[float] = None
    framework: Optional[str] = None
    raw_output: str = ""

    @property
    def is_valid_success(self) -> bool:
        """Check if this represents a valid successful test run."""
        return (
            self.tests_run > 0 and
            self.tests_failed == 0 and
            self.tests_errors == 0 and
            self.tests_passed == self.tests_run - self.tests_skipped
        )

    @property
    def success_rate(self) -> float:
        """Calculate success rate (0.0-1.0)."""
        if self.tests_run == 0:
            return 0.0
        return self.tests_passed / self.tests_run

    @property
    def summary(self) -> str:
        """Generate human-readable summary."""
        if self.tests_run == 0:
            return "NO TESTS RAN - Test discovery failed or no tests found"

        if self.is_valid_success:
            return f"SUCCESS - All {self.tests_passed} tests passed"

        parts = []
        if self.tests_passed > 0:
            parts.append(f"{self.tests_passed} passed")
        if self.tests_failed > 0:
            parts.append(f"{self.tests_failed} failed")
        if self.tests_errors > 0:
            parts.append(f"{self.tests_errors} errors")
        if self.tests_skipped > 0:
            parts.append(f"{self.tests_skipped} skipped")

        return f"FAILURE - {', '.join(parts)} out of {self.tests_run} tests"


class TestResultValidator:
    """Validator for test execution outputs."""

    @staticmethod
    def parse_pytest_output(output: str) -> TestResult:
        """Parse pytest output.

        Examples:
        - "===== 5 passed in 0.03s ====="
        - "===== 3 passed, 2 failed in 0.05s ====="
        - "===== 10 passed, 1 skipped in 0.12s ====="
        """
        result = TestResult(framework="pytest", raw_output=output)

        # Look for final summary line
        # Pattern: "===== X passed, Y failed, Z skipped in W.WWs ====="
        pattern = r'={3,}\s*(?:(\d+)\s+passed)?(?:,?\s*(\d+)\s+failed)?(?:,?\s*(\d+)\s+skipped)?(?:,?\s*(\d+)\s+error)?.*?in\s+([\d.]+)s?\s*={3,}'

        match = re.search(pattern, output, re.IGNORECASE)
        if match:
            passed = int(match.group(1)) if match.group(1) else 0
            failed = int(match.group(2)) if match.group(2) else 0
            skipped = int(match.group(3)) if match.group(3) else 0
            errors = int(match.group(4)) if match.group(4) else 0
            duration = float(match.group(5)) if match.group(5) else None

            result.tests_passed = passed
            result.tests_failed = failed
            result.tests_skipped = skipped
            result.tests_errors = errors
            result.tests_run = passed + failed + skipped
            result.duration_seconds = duration

        return result

    @staticmethod
    def parse_unittest_output(output: str) -> TestResult:
        """Parse unittest output.

        Examples:
        - "Ran 5 tests in 0.002s\n\nOK"
        - "Ran 10 tests in 0.005s\n\nFAILED (failures=2)"
        - "Ran 0 tests in 0.000s\n\nOK"
        """
        result = TestResult(framework="unittest", raw_output=output)

        # Look for "Ran X tests in Y.YYs"
        ran_match = re.search(r'Ran\s+(\d+)\s+tests?\s+in\s+([\d.]+)s', output, re.IGNORECASE)
        if ran_match:
            tests_run = int(ran_match.group(1))
            duration = float(ran_match.group(2))

            result.tests_run = tests_run
            result.duration_seconds = duration

            # Check for OK or FAILED
            if re.search(r'\bOK\b', output):
                # All passed (if any ran)
                result.tests_passed = tests_run
            else:
                # Look for failure counts
                failures_match = re.search(r'failures?=(\d+)', output, re.IGNORECASE)
                errors_match = re.search(r'errors?=(\d+)', output, re.IGNORECASE)
                skipped_match = re.search(r'skipped?=(\d+)', output, re.IGNORECASE)

                failures = int(failures_match.group(1)) if failures_match else 0
                errors = int(errors_match.group(1)) if errors_match else 0
                skipped = int(skipped_match.group(1)) if skipped_match else 0

                result.tests_failed = failures
                result.tests_errors = errors
                result.tests_skipped = skipped
                result.tests_passed = tests_run - failures - errors - skipped

        return result

    @staticmethod
    def parse_generic_output(output: str) -> TestResult:
        """Parse generic test output with common patterns.

        Looks for patterns like:
        - "X tests passed"
        - "X of Y tests passed"
        - "X passed, Y failed"
        """
        result = TestResult(framework="generic", raw_output=output)

        # Try various patterns
        patterns = [
            r'(\d+)\s+of\s+(\d+)\s+tests?\s+passed',
            r'(\d+)\s+passed,\s+(\d+)\s+failed',
            r'(\d+)\s+tests?\s+passed',
            r'tests?:\s+(\d+)\s+passed',
        ]

        for pattern in patterns:
            match = re.search(pattern, output, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    # "X of Y" or "X passed, Y failed"
                    if 'failed' in pattern:
                        result.tests_passed = int(match.group(1))
                        result.tests_failed = int(match.group(2))
                        result.tests_run = result.tests_passed + result.tests_failed
                    else:
                        result.tests_passed = int(match.group(1))
                        result.tests_run = int(match.group(2))
                else:
                    # "X tests passed"
                    result.tests_passed = int(match.group(1))
                    result.tests_run = result.tests_passed
                break

        return result


def parse_test_output(output: str) -> TestResult:
    """Parse test output and return structured results.

    Automatically detects test framework and extracts results.

    Args:
        output: Raw test execution output

    Returns:
        TestResult with parsed data

    Example:
        >>> result = parse_test_output("Ran 5 tests in 0.002s\\n\\nOK")
        >>> result.is_valid_success
        True
        >>> result.tests_run
        5

        >>> result = parse_test_output("Ran 0 tests in 0.000s\\n\\nOK")
        >>> result.is_valid_success
        False
        >>> result.summary
        'NO TESTS RAN - Test discovery failed or no tests found'
    """
    validator = TestResultValidator()

    # Try pytest format first
    if '===' in output and 'passed' in output.lower():
        result = validator.parse_pytest_output(output)
        if result.tests_run > 0:
            return result

    # Try unittest format
    if 'Ran' in output and 'tests' in output.lower():
        result = validator.parse_unittest_output(output)
        if result.tests_run >= 0:  # Even 0 is valid for unittest
            return result

    # Try generic patterns
    result = validator.parse_generic_output(output)
    if result.tests_run > 0:
        return result

    # Fallback: detect failures from partial/truncated unittest output
    # Even if "Ran X tests" line is truncated, we can count FAIL: occurrences
    fail_lines = re.findall(r'^FAIL:\s+\w+', output, re.MULTILINE)
    error_lines = re.findall(r'^ERROR:\s+\w+', output, re.MULTILINE)
    if fail_lines or error_lines:
        result = TestResult(framework="unittest-partial", raw_output=output)
        result.tests_failed = len(fail_lines)
        result.tests_errors = len(error_lines)
        # Try to get total from truncated "Ran X t..." pattern
        ran_partial = re.search(r'Ran\s+(\d+)\s+t', output)
        if ran_partial:
            result.tests_run = int(ran_partial.group(1))
        else:
            result.tests_run = result.tests_failed + result.tests_errors
        result.tests_passed = max(0, result.tests_run - result.tests_failed - result.tests_errors)
        return result

    # No tests found - return empty result
    return TestResult(raw_output=output)
