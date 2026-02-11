"""Pytest configuration and shared fixtures for agents tests."""
import sys
from pathlib import Path

import pytest

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


@pytest.fixture(autouse=True)
def reset_action_history():
    """Reset ActionHistory singleton before each test.

    Resets both import paths (monitoring.* and src.monitoring.*) because
    Python treats them as separate modules when both packages/agents and
    packages/agents/src are on sys.path. file_ops.py uses src.monitoring
    while tests use monitoring directly.
    """
    from monitoring.action_history import ActionHistory
    ActionHistory.reset()

    # Also reset the src.monitoring variant if it was loaded separately
    try:
        from src.monitoring.action_history import ActionHistory as SrcActionHistory
        if SrcActionHistory is not ActionHistory:
            SrcActionHistory.reset()
    except ImportError:
        pass

    yield

    ActionHistory.reset()
    try:
        from src.monitoring.action_history import ActionHistory as SrcActionHistory
        if SrcActionHistory is not ActionHistory:
            SrcActionHistory.reset()
    except ImportError:
        pass
