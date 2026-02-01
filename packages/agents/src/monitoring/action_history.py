"""Action history tracker for detecting loops and repeated actions."""
import json
from typing import Dict, List, Tuple
from datetime import datetime
from difflib import SequenceMatcher
from collections import defaultdict


class ActionLoopDetected(Exception):
    """Raised when an action loop is detected."""
    pass


# Tool-specific call limits to prevent runaway agents
TOOL_SPECIFIC_LIMITS = {
    'file_write': 3,   # Max 3 writes to same file path
    'file_edit': 5,    # Max 5 edits to same file path
    'shell_run': 10,   # Max 10 shell commands (same command)
}

# Hard limit on total tool calls per task
MAX_TOTAL_TOOL_CALLS = 50


class ActionHistory:
    """Singleton tracker for all tool invocations to detect loops."""

    _instance = None
    _history: List[Tuple[str, Dict, datetime]] = []
    _tool_path_counts: Dict[str, Dict[str, int]] = {}  # {tool_name: {path: count}}
    _total_calls: int = 0

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._history = []
            cls._tool_path_counts = defaultdict(lambda: defaultdict(int))
            cls._total_calls = 0
        return cls._instance

    @classmethod
    def reset(cls):
        """Reset history (useful for testing or new task execution)."""
        cls._history = []
        cls._tool_path_counts = defaultdict(lambda: defaultdict(int))
        cls._total_calls = 0

    @classmethod
    def register_action(cls, tool_name: str, params: Dict) -> None:
        """
        Register a tool invocation and check for loops.

        Args:
            tool_name: Name of the tool being called
            params: Parameters passed to the tool

        Raises:
            ActionLoopDetected: If a duplicate or loop is detected
        """
        # Increment total call counter and check hard limit
        cls._total_calls += 1
        if cls._total_calls > MAX_TOTAL_TOOL_CALLS:
            raise ActionLoopDetected(
                f"ERROR: Hard limit exceeded - Made {cls._total_calls} tool calls.\n"
                f"Maximum allowed is {MAX_TOTAL_TOOL_CALLS} per task.\n"
                f"This task is too complex or the agent is stuck. Stopping execution."
            )

        # Track tool calls per path for file operations
        target_path = cls._extract_path_from_params(tool_name, params)
        if target_path and tool_name in TOOL_SPECIFIC_LIMITS:
            cls._tool_path_counts[tool_name][target_path] += 1
            count = cls._tool_path_counts[tool_name][target_path]
            limit = TOOL_SPECIFIC_LIMITS[tool_name]

            if count > limit:
                raise ActionLoopDetected(
                    f"ERROR: Tool limit exceeded - Called {tool_name} on '{target_path}' {count} times.\n"
                    f"Maximum allowed is {limit} calls to the same path.\n"
                    f"The agent is repeatedly modifying the same file. This indicates a loop.\n"
                    f"If the file still needs changes, the task may need to be decomposed differently."
                )

        # Add to history
        cls._history.append((tool_name, params, datetime.now()))

        # Only check after we have at least 3 actions
        if len(cls._history) < 3:
            return

        # Get recent actions
        recent_actions = cls._history[-5:]  # Last 5 actions
        current_action = (tool_name, params)

        # Check for EXACT duplicate in last 3 actions
        for i in range(max(0, len(recent_actions) - 3), len(recent_actions) - 1):
            past_tool, past_params, _ = recent_actions[i]
            if past_tool == tool_name and cls._params_match(params, past_params, threshold=1.0):
                # Exact duplicate detected
                raise ActionLoopDetected(
                    f"ERROR: Loop detected - Already executed {tool_name} with identical parameters.\n"
                    f"Previous: {cls._format_params(past_params)}\n"
                    f"Current:  {cls._format_params(params)}\n"
                    f"This means you are stuck in a loop. Choose a DIFFERENT approach."
                )

        # Check for SIMILAR duplicate in last 5 actions (80% similarity)
        for i in range(len(recent_actions) - 1):
            past_tool, past_params, _ = recent_actions[i]
            if past_tool == tool_name and cls._params_match(params, past_params, threshold=0.8):
                # Similar duplicate - warning but don't block
                print(f"\n[WARNING] Detected similar action to previous attempt")
                print(f"   Tool: {tool_name}")
                print(f"   Previous: {cls._format_params(past_params)}")
                print(f"   Current:  {cls._format_params(params)}")
                print(f"   Consider trying a different approach if this fails.\n")

        # Check for same tool 5+ times in recent history
        same_tool_count = sum(1 for t, _, _ in recent_actions if t == tool_name)
        if same_tool_count >= 5:
            raise ActionLoopDetected(
                f"ERROR: Loop detected - Used {tool_name} tool {same_tool_count} times in last 5 actions.\n"
                f"This suggests you are stuck. Try a completely different approach."
            )

    @classmethod
    def _extract_path_from_params(cls, tool_name: str, params: Dict) -> str:
        """
        Extract the target file path from tool parameters.

        Args:
            tool_name: Name of the tool
            params: Parameters passed to the tool

        Returns:
            The file path if found, empty string otherwise
        """
        # Common parameter names for file paths
        path_keys = ['path', 'file_path', 'filepath', 'filename', 'file']

        for key in path_keys:
            if key in params and isinstance(params[key], str):
                return params[key]

        # For shell_run, extract the command as the "path" for tracking
        if tool_name == 'shell_run':
            cmd = params.get('command', params.get('cmd', ''))
            if isinstance(cmd, str):
                return cmd

        return ''

    @classmethod
    def _params_match(cls, params1: Dict, params2: Dict, threshold: float = 1.0) -> bool:
        """
        Check if two parameter dictionaries match with given similarity threshold.

        Args:
            params1: First parameter dict
            params2: Second parameter dict
            threshold: Similarity threshold (0.0-1.0). 1.0 = exact match, 0.8 = 80% similar

        Returns:
            True if parameters match above threshold
        """
        # Convert to JSON strings for comparison
        try:
            str1 = json.dumps(params1, sort_keys=True)
            str2 = json.dumps(params2, sort_keys=True)
        except (TypeError, ValueError):
            # If params can't be serialized, compare string representations
            str1 = str(params1)
            str2 = str(params2)

        if threshold >= 1.0:
            # Exact match
            return str1 == str2
        else:
            # Similarity matching
            ratio = SequenceMatcher(None, str1, str2).ratio()
            return ratio >= threshold

    @classmethod
    def _format_params(cls, params: Dict) -> str:
        """Format parameters for display (truncate long values)."""
        formatted = {}
        for key, value in params.items():
            if isinstance(value, str) and len(value) > 100:
                formatted[key] = value[:97] + "..."
            else:
                formatted[key] = value
        return str(formatted)

    @classmethod
    def get_history(cls) -> List[Tuple[str, Dict, datetime]]:
        """Get the full action history."""
        return cls._history.copy()

    @classmethod
    def get_summary(cls) -> str:
        """Get a summary of recent actions."""
        if not cls._history:
            return "No actions recorded"

        recent = cls._history[-10:]  # Last 10 actions
        summary = [f"Recent action history ({len(recent)} actions):"]

        for i, (tool, params, timestamp) in enumerate(recent, 1):
            time_str = timestamp.strftime("%H:%M:%S")
            summary.append(f"  {i}. [{time_str}] {tool}: {cls._format_params(params)}")

        return "\n".join(summary)

    @classmethod
    def get_statistics(cls) -> Dict:
        """Get statistics about tool usage for debugging."""
        return {
            'total_calls': cls._total_calls,
            'max_allowed': MAX_TOTAL_TOOL_CALLS,
            'tool_path_counts': dict(cls._tool_path_counts),
            'tool_limits': TOOL_SPECIFIC_LIMITS,
            'history_length': len(cls._history),
        }
