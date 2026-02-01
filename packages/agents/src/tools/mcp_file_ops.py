"""MCP-based file operation tools for CrewAI agents.

These tools use the MCP Gateway for file operations with distributed locking
and real-time collaboration features.

Note: Uses synchronous httpx to avoid event loop issues with uvloop.
"""

import logging
import os
from typing import Optional

import httpx
from crewai_tools import tool

logger = logging.getLogger(__name__)

# MCP Gateway URL
MCP_GATEWAY_URL = os.environ.get("MCP_GATEWAY_URL", "http://mcp-gateway:8001")

# Global synchronous HTTP client (reused across calls)
_http_client: Optional[httpx.Client] = None


def get_http_client() -> httpx.Client:
    """Get or create synchronous HTTP client."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.Client(timeout=30.0)
    return _http_client


def get_context() -> tuple[str, str]:
    """Get current agent_id and task_id from environment variables.

    These are set by main.py before agent execution starts.

    Returns:
        Tuple of (agent_id, task_id)
    """
    agent_id = os.environ.get('CURRENT_AGENT_ID', 'unknown-agent')
    task_id = os.environ.get('CURRENT_TASK_ID', 'unknown-task')
    return agent_id, task_id


@tool("mcp_file_read")
def mcp_file_read(path: str) -> str:
    """Read file via MCP Gateway.

    Uses distributed caching and real-time synchronization via MCP Gateway.

    Args:
        path (str): File path relative to workspace/tasks/

    Returns:
        str: File content

    Example:
        content = mcp_file_read("calculator.py")
    """
    agent_id, task_id = get_context()
    try:
        client = get_http_client()
        response = client.get(
            f"{MCP_GATEWAY_URL}/files/read",
            params={"path": path, "task_id": task_id, "agent_id": agent_id}
        )
        response.raise_for_status()
        data = response.json()
        content = data.get("content", "")

        logger.info(f"[{agent_id}] Read file via MCP: {path} ({len(content)} bytes)")
        return content

    except httpx.HTTPStatusError as e:
        error_msg = f"MCP file read failed: {e.response.status_code} - {e.response.text}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"
    except Exception as e:
        error_msg = f"Unexpected error reading file via MCP: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"


@tool("mcp_file_write")
def mcp_file_write(path: str, content: str) -> str:
    """Write file via MCP Gateway.

    Uses distributed file locking to prevent conflicts when multiple agents
    work on the same task.

    Args:
        path (str): File path relative to workspace/tasks/
        content (str): File content to write

    Returns:
        str: Success message or error

    Example:
        result = mcp_file_write("calculator.py", "def add(a, b):\\n    return a + b")
    """
    agent_id, task_id = get_context()
    try:
        client = get_http_client()
        response = client.post(
            f"{MCP_GATEWAY_URL}/files/write",
            json={
                "path": path,
                "content": content,
                "task_id": task_id,
                "agent_id": agent_id
            }
        )
        response.raise_for_status()
        result = response.json()

        bytes_written = result.get('bytes', len(content))
        logger.info(f"[{agent_id}] Wrote file via MCP: {path} ({bytes_written} bytes)")
        return f"File written successfully: {path} ({bytes_written} bytes)"

    except httpx.HTTPStatusError as e:
        error_msg = f"MCP file write failed: {e.response.status_code} - {e.response.text}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"
    except Exception as e:
        error_msg = f"Unexpected error writing file via MCP: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"


@tool("mcp_file_edit")
def mcp_file_edit(path: str, old_content: str, new_content: str) -> str:
    """Edit file by replacing content via MCP Gateway.

    Uses distributed file locking and provides atomic read-modify-write operations.

    Args:
        path (str): File path relative to workspace/tasks/
        old_content (str): Content to replace
        new_content (str): New content

    Returns:
        str: Success message or error

    Example:
        result = mcp_file_edit("calc.py", "return a+b", "return a + b  # Add numbers")
    """
    agent_id, task_id = get_context()
    try:
        # Read current file content
        read_result = mcp_file_read(path)
        if read_result.startswith("ERROR:"):
            return read_result

        current_content = read_result

        # Replace content
        if old_content not in current_content:
            error_msg = f"Old content not found in file {path}"
            logger.error(f"[{agent_id}] {error_msg}")
            return f"ERROR: {error_msg}"

        updated_content = current_content.replace(old_content, new_content, 1)

        # Write updated content
        write_result = mcp_file_write(path, updated_content)
        if write_result.startswith("ERROR:"):
            return write_result

        logger.info(f"[{agent_id}] Edited file via MCP: {path}")
        return f"File edited successfully: {path}"

    except Exception as e:
        error_msg = f"Unexpected error editing file via MCP: {e}"
        logger.error(f"[{agent_id}] {error_msg}")
        return f"ERROR: {error_msg}"


# Tool collections for different agent types
MCP_CODER_TOOLS = [
    mcp_file_read,
    mcp_file_write,
    mcp_file_edit,
]

MCP_QA_TOOLS = [
    mcp_file_read,
    mcp_file_write,
    mcp_file_edit,
]
