"""Unit tests for ActionHistory loop detection."""
import pytest
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from monitoring.action_history import (
    ActionHistory,
    ActionLoopDetected,
    TOOL_SPECIFIC_LIMITS,
    MAX_TOTAL_TOOL_CALLS,
)


def _interleave_read(path: str = "dummy.py"):
    """Register a file_read action to break up same-tool sequences.

    The loop detector flags 5+ consecutive calls to the same tool.
    Interleaving a different tool prevents false positives in tests.
    """
    ActionHistory.register_action("file_read", {"path": path})


class TestToolSpecificLimits:
    """Test TOOL_SPECIFIC_LIMITS enforcement for file_write, file_edit, shell_run."""

    def setup_method(self):
        """Reset ActionHistory before each test."""
        ActionHistory.reset()

    def test_file_write_limit_enforced(self):
        """Test that file_write is limited to 3 calls per path."""
        path = "tasks/myfile.py"
        limit = TOOL_SPECIFIC_LIMITS['file_write']
        assert limit == 3, "Expected file_write limit to be 3"

        # First 3 calls should succeed
        for i in range(limit):
            ActionHistory.register_action("file_write", {"path": path, "content": f"v{i}"})

        # 4th call should raise ActionLoopDetected (per-path limit)
        with pytest.raises(ActionLoopDetected) as exc_info:
            ActionHistory.register_action("file_write", {"path": path, "content": "v4"})

        assert "file_write" in str(exc_info.value)
        assert path in str(exc_info.value)
        assert "4 times" in str(exc_info.value)

    def test_file_edit_limit_enforced(self):
        """Test that file_edit is limited to 5 calls per path."""
        path = "tasks/editme.py"
        limit = TOOL_SPECIFIC_LIMITS['file_edit']
        assert limit == 5, "Expected file_edit limit to be 5"

        # Make 5 calls, interleaving reads to avoid "same tool 5x" detection
        for i in range(limit):
            ActionHistory.register_action("file_edit", {
                "path": path,
                "old_text": f"old{i}",
                "new_text": f"new{i}"
            })
            if i < limit - 1:  # Interleave reads between edits
                _interleave_read(f"check{i}.py")

        # 6th call should raise ActionLoopDetected (per-path limit)
        with pytest.raises(ActionLoopDetected) as exc_info:
            ActionHistory.register_action("file_edit", {
                "path": path,
                "old_text": "old6",
                "new_text": "new6"
            })

        assert "file_edit" in str(exc_info.value)
        assert path in str(exc_info.value)
        assert "6 times" in str(exc_info.value)

    def test_shell_run_limit_enforced(self):
        """Test that shell_run is limited to 10 calls for same command."""
        limit = TOOL_SPECIFIC_LIMITS['shell_run']
        assert limit == 10, "Expected shell_run limit to be 10"

        command = "python test.py"
        # Make 10 calls with same command but vary run_id to avoid exact duplicate detection.
        # Interleave reads to avoid "same tool 5x" detection.
        # The per-path tracker uses only the "command" field, so run_id doesn't affect it.
        for i in range(limit):
            ActionHistory.register_action("shell_run", {"command": command, "run_id": i})
            if i < limit - 1:
                _interleave_read(f"check{i}.py")

        # 11th call should raise (per-path limit)
        with pytest.raises(ActionLoopDetected) as exc_info:
            ActionHistory.register_action("shell_run", {"command": command, "run_id": limit})

        assert "shell_run" in str(exc_info.value)


class TestDifferentPathsTrackedSeparately:
    """Test that different file paths are tracked independently."""

    def setup_method(self):
        """Reset ActionHistory before each test."""
        ActionHistory.reset()

    def test_different_paths_have_separate_counts(self):
        """Test that writes to different files don't share a counter."""
        path1 = "tasks/file1.py"
        path2 = "tasks/file2.py"

        # Write 3 times to path1 (at limit)
        for i in range(3):
            ActionHistory.register_action("file_write", {"path": path1, "content": f"v{i}"})

        # Writing to path2 should still work (different counter)
        ActionHistory.register_action("file_write", {"path": path2, "content": "content"})

        # But path1 should fail on next write
        with pytest.raises(ActionLoopDetected):
            ActionHistory.register_action("file_write", {"path": path1, "content": "fail"})

    def test_different_tools_have_separate_counts(self):
        """Test that file_write and file_edit have separate counters per path."""
        path = "tasks/shared.py"

        # Write 3 times (file_write limit)
        for i in range(3):
            ActionHistory.register_action("file_write", {"path": path, "content": f"v{i}"})

        # file_edit on same path should still work (different tool)
        ActionHistory.register_action("file_edit", {
            "path": path,
            "old_text": "old",
            "new_text": "new"
        })

        # file_write should now fail (per-path limit)
        with pytest.raises(ActionLoopDetected):
            ActionHistory.register_action("file_write", {"path": path, "content": "fail"})

        # file_edit can still continue, interleave reads to avoid "same tool 5x"
        for i in range(4):
            ActionHistory.register_action("file_edit", {
                "path": path,
                "old_text": f"old{i}",
                "new_text": f"new{i}"
            })
            if i < 3:
                _interleave_read(f"verify{i}.py")


class TestResetFunctionality:
    """Test that reset clears all history and counters."""

    def setup_method(self):
        """Reset ActionHistory before each test."""
        ActionHistory.reset()

    def test_reset_clears_tool_path_counts(self):
        """Test that reset allows the same operations again."""
        path = "tasks/file.py"

        # Use up all file_write attempts
        for i in range(3):
            ActionHistory.register_action("file_write", {"path": path, "content": f"v{i}"})

        # Verify it would fail
        with pytest.raises(ActionLoopDetected):
            ActionHistory.register_action("file_write", {"path": path, "content": "fail"})

        # Reset
        ActionHistory.reset()

        # Now it should work again
        ActionHistory.register_action("file_write", {"path": path, "content": "works again"})

    def test_reset_clears_total_calls(self):
        """Test that reset clears the total call counter."""
        # Make calls, alternating tools to avoid "same tool 5x" detection
        tools = ["file_read", "file_list"]
        for i in range(10):
            tool = tools[i % 2]
            ActionHistory.register_action(tool, {"path": f"dir{i}"})

        stats = ActionHistory.get_statistics()
        assert stats['total_calls'] == 10

        ActionHistory.reset()

        stats = ActionHistory.get_statistics()
        assert stats['total_calls'] == 0

    def test_reset_clears_history(self):
        """Test that reset clears action history."""
        ActionHistory.register_action("file_read", {"path": "file.py"})
        ActionHistory.register_action("file_write", {"path": "file.py", "content": "x"})

        history = ActionHistory.get_history()
        assert len(history) == 2

        ActionHistory.reset()

        history = ActionHistory.get_history()
        assert len(history) == 0


class TestExactDuplicateDetection:
    """Test detection of exact duplicate actions."""

    def setup_method(self):
        """Reset ActionHistory before each test."""
        ActionHistory.reset()

    def test_exact_duplicate_in_last_3_raises_error(self):
        """Test that exact duplicate action in last 3 raises ActionLoopDetected."""
        params = {"path": "test.py"}

        # First call
        ActionHistory.register_action("file_read", params)
        # Second call (different)
        ActionHistory.register_action("file_list", {"path": "."})
        # Third call - exact duplicate of first
        with pytest.raises(ActionLoopDetected) as exc_info:
            ActionHistory.register_action("file_read", params)

        assert "Loop detected" in str(exc_info.value)
        assert "identical parameters" in str(exc_info.value)


class TestMaxTotalToolCalls:
    """Test hard limit on total tool calls."""

    def setup_method(self):
        """Reset ActionHistory before each test."""
        ActionHistory.reset()

    def test_max_total_calls_enforced(self):
        """Test that exceeding MAX_TOTAL_TOOL_CALLS raises error."""
        assert MAX_TOTAL_TOOL_CALLS == 50, "Expected max total calls to be 50"

        # Make 50 unique calls, alternating tools to avoid "same tool 5x" detection
        tools = ["file_read", "file_list"]
        for i in range(MAX_TOTAL_TOOL_CALLS):
            tool = tools[i % 2]
            ActionHistory.register_action(tool, {"path": f"unique_path_{i}"})

        # 51st call should fail
        with pytest.raises(ActionLoopDetected) as exc_info:
            ActionHistory.register_action("file_read", {"path": "one_more"})

        assert "Hard limit exceeded" in str(exc_info.value)
        assert str(MAX_TOTAL_TOOL_CALLS) in str(exc_info.value)


class TestGetStatistics:
    """Test the get_statistics method."""

    def setup_method(self):
        """Reset ActionHistory before each test."""
        ActionHistory.reset()

    def test_statistics_accurate(self):
        """Test that statistics accurately reflect tool usage."""
        # Make some calls
        ActionHistory.register_action("file_write", {"path": "a.py", "content": "x"})
        ActionHistory.register_action("file_write", {"path": "a.py", "content": "y"})
        ActionHistory.register_action("file_write", {"path": "b.py", "content": "z"})
        ActionHistory.register_action("file_edit", {"path": "a.py", "old": "x", "new": "y"})

        stats = ActionHistory.get_statistics()

        assert stats['total_calls'] == 4
        assert stats['max_allowed'] == MAX_TOTAL_TOOL_CALLS
        assert stats['history_length'] == 4
        assert stats['tool_limits'] == TOOL_SPECIFIC_LIMITS

        # Check tool_path_counts
        tool_counts = stats['tool_path_counts']
        assert tool_counts['file_write']['a.py'] == 2
        assert tool_counts['file_write']['b.py'] == 1
        assert tool_counts['file_edit']['a.py'] == 1


class TestPathExtraction:
    """Test path extraction from different parameter formats."""

    def setup_method(self):
        """Reset ActionHistory before each test."""
        ActionHistory.reset()

    def test_path_key_extraction(self):
        """Test extraction with 'path' key."""
        ActionHistory.register_action("file_write", {"path": "test.py", "content": "x"})
        stats = ActionHistory.get_statistics()
        assert 'test.py' in stats['tool_path_counts']['file_write']

    def test_file_path_key_extraction(self):
        """Test extraction with 'file_path' key."""
        ActionHistory.register_action("file_write", {"file_path": "test2.py", "content": "x"})
        stats = ActionHistory.get_statistics()
        assert 'test2.py' in stats['tool_path_counts']['file_write']

    def test_shell_run_command_as_path(self):
        """Test that shell_run uses command as the path for tracking."""
        ActionHistory.register_action("shell_run", {"command": "python test.py"})
        stats = ActionHistory.get_statistics()
        assert 'python test.py' in stats['tool_path_counts']['shell_run']
