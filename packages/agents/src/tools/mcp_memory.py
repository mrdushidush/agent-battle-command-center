"""MCP-based memory tools for CrewAI agents.

These tools allow agents to:
- Recall solutions from similar past tasks
- Propose new learnings for human approval
- Record feedback on memory usefulness

Note: Uses synchronous httpx to avoid event loop issues with uvloop.
"""

import json
import logging
import os
from typing import Optional

from crewai_tools import tool
import httpx

logger = logging.getLogger(__name__)

# API URL for memory endpoints
API_URL = "http://api:3001/api/memories"

# Global synchronous HTTP client (reused across calls)
_client: Optional[httpx.Client] = None


def get_client() -> httpx.Client:
    """Get or create synchronous HTTP client."""
    global _client
    if _client is None:
        _client = httpx.Client(timeout=30.0)
    return _client


@tool("recall_similar_solutions")
def recall_similar_solutions(task_type: str, keywords: str) -> str:
    """Recall solutions from similar past tasks.

    Before starting a task, use this tool to check if there are relevant
    learnings from previous successful tasks.

    Args:
        task_type (str): Type of task - one of: file_creation, bug_fix, refactor, test
        keywords (str): Comma-separated keywords describing the problem (e.g., "async,timeout,http")

    Returns:
        str: JSON with relevant past solutions and patterns

    Example:
        memories = recall_similar_solutions("bug_fix", "async,timeout,http")
        # Returns: {"memories": [{"pattern": "...", "solution": "...", "successCount": 5}]}
    """
    try:
        client = get_client()
        response = client.get(
            f"{API_URL}/search",
            params={
                "taskType": task_type,
                "keywords": keywords,
                "limit": 5
            }
        )
        response.raise_for_status()
        data = response.json()
        memories = data.get("memories", [])

        if not memories:
            return json.dumps({
                "found": False,
                "message": f"No relevant memories found for {task_type} with keywords: {keywords}"
            })

        # Format memories for agent consumption
        formatted = []
        for m in memories:
            formatted.append({
                "pattern": m.get("pattern"),
                "solution": m.get("solution"),
                "errorPattern": m.get("errorPattern"),
                "successCount": m.get("successCount", 0),
                "id": m.get("id")
            })

        logger.info(f"Recalled {len(formatted)} memories for {task_type}")
        return json.dumps({
            "found": True,
            "count": len(formatted),
            "memories": formatted
        }, indent=2)

    except Exception as e:
        error_msg = f"Error recalling memories: {e}"
        logger.error(error_msg)
        return json.dumps({"error": error_msg})


@tool("learn_from_success")
def learn_from_success(
    task_type: str,
    pattern: str,
    solution: str,
    error_pattern: str = "",
    keywords: str = ""
) -> str:
    """Propose a learning from successful task completion.

    When you successfully solve a task, especially if it involved an error fix
    or a non-obvious solution, use this tool to propose the learning.
    It will be reviewed by a human before becoming available to other agents.

    Args:
        task_type (str): Type of task - one of: file_creation, bug_fix, refactor, test
        pattern (str): What problem pattern was encountered (describe the situation)
        solution (str): How it was solved (describe the approach)
        error_pattern (str): If this fixed an error, what was the error message/type (optional)
        keywords (str): Comma-separated keywords for searching (optional)

    Returns:
        str: Confirmation with memory ID, awaiting human approval

    Example:
        learn_from_success(
            "bug_fix",
            "Async function not awaited causing timeout",
            "Added 'await' keyword before the async call and increased timeout to 30s",
            "TimeoutError: operation timed out",
            "async,timeout,await"
        )
    """
    try:
        client = get_client()
        response = client.post(
            API_URL,
            json={
                "taskType": task_type,
                "pattern": pattern,
                "solution": solution,
                "errorPattern": error_pattern if error_pattern else None,
                "keywords": [k.strip() for k in keywords.split(",") if k.strip()],
            }
        )
        response.raise_for_status()
        memory = response.json()

        logger.info(f"Proposed memory {memory.get('id')} for human approval")
        return json.dumps({
            "success": True,
            "message": "Learning proposed and awaiting human approval",
            "memoryId": memory.get("id"),
            "taskType": task_type,
            "pattern": pattern[:100] + "..." if len(pattern) > 100 else pattern
        }, indent=2)

    except Exception as e:
        error_msg = f"Error proposing learning: {e}"
        logger.error(error_msg)
        return json.dumps({"error": error_msg})


@tool("record_memory_feedback")
def record_memory_feedback(memory_id: str, was_helpful: bool) -> str:
    """Record whether a recalled memory was helpful.

    After using a recalled solution, report back whether it worked.
    This helps improve memory quality over time.

    Args:
        memory_id (str): ID of the memory that was used
        was_helpful (bool): True if the memory helped solve the task, False otherwise

    Returns:
        str: Confirmation message

    Example:
        record_memory_feedback("mem-123", True)  # The solution worked!
    """
    try:
        client = get_client()
        response = client.post(
            f"{API_URL}/{memory_id}/feedback",
            json={"success": was_helpful}
        )
        response.raise_for_status()
        memory = response.json()

        logger.info(f"Recorded feedback for memory {memory_id}: helpful={was_helpful}")
        return json.dumps({
            "success": True,
            "message": f"Feedback recorded: {'helpful' if was_helpful else 'not helpful'}",
            "memoryId": memory_id,
            "newSuccessCount": memory.get("successCount"),
            "newFailureCount": memory.get("failureCount")
        }, indent=2)

    except Exception as e:
        error_msg = f"Error recording feedback: {e}"
        logger.error(error_msg)
        return json.dumps({"error": error_msg})


@tool("get_previous_attempt")
def get_previous_attempt(task_id: str) -> str:
    """Get context from a previous failed attempt on this task.

    When retrying a task after a failed review, use this tool to understand
    what went wrong and what needs to be fixed.

    Args:
        task_id (str): The task ID to check for previous attempts

    Returns:
        str: JSON with previous attempt context including:
            - previousAttempts: number of prior attempts
            - reviewScore: quality score from last review
            - criticalFindings: list of critical issues found
            - suggestions: list of fix suggestions
            - previousModel: which model tried before

    Example:
        context = get_previous_attempt("task-123")
        # If task failed review, shows what to fix
    """
    try:
        client = get_client()
        # Get task details from API
        response = client.get(f"http://api:3001/api/tasks/{task_id}")
        if response.status_code == 404:
            return json.dumps({"previousAttempts": 0, "message": "Task not found"})
        response.raise_for_status()
        task = response.json()
        result = task.get("result", {}) or {}

        # Check if this task has review context from a failed review
        if result.get("reviewFailed"):
            review_context = result.get("reviewContext", {})
            return json.dumps({
                "previousAttempts": task.get("currentIteration", 0),
                "reviewFailed": True,
                "reviewScore": result.get("reviewScore"),
                "previousModel": result.get("previousModel"),
                "preferredModel": result.get("preferredModel"),
                "criticalFindings": review_context.get("findings", []),
                "suggestions": [
                    f.get("suggestion") for f in review_context.get("findings", [])
                    if f.get("suggestion")
                ],
                "hasSyntaxErrors": review_context.get("hasSyntaxErrors", False),
                "summary": review_context.get("summary"),
            }, indent=2)

        # No previous failed review
        return json.dumps({
            "previousAttempts": task.get("currentIteration", 0),
            "reviewFailed": False,
            "message": "No failed review context available"
        })

    except Exception as e:
        error_msg = f"Error getting previous attempt: {e}"
        logger.error(error_msg)
        return json.dumps({"error": error_msg})


@tool("get_project_context")
def get_project_context(section: str = "all") -> str:
    """Get architectural context for the project.

    Use this tool to understand project structure, coding standards,
    API conventions, and agent roles before starting a task.

    Args:
        section (str): Which section to retrieve:
            - "all" - Complete context
            - "structure" - Project structure and file patterns
            - "standards" - Coding standards (TypeScript, Python)
            - "api" - API conventions and endpoints
            - "routing" - Tier routing and escalation
            - "agents" - Agent roles and capabilities

    Returns:
        str: JSON with project context

    Example:
        context = get_project_context("standards")
        # Returns coding standards for TypeScript and Python
    """
    try:
        client = get_client()
        response = client.get(f"{API_URL}/architecture")
        if response.status_code == 404:
            return json.dumps({"error": "No architectural context found. Run: node scripts/generate-arch-context.js"})
        response.raise_for_status()
        data = response.json()

        if "error" in data:
            return json.dumps(data)

        context = data.get("context", {})

        if section == "all":
            return json.dumps(context, indent=2)

        section_data = context.get(section)
        if section_data is None:
            return json.dumps({
                "error": f"Unknown section: {section}",
                "available": ["structure", "standards", "api", "routing", "agents", "testing"]
            })

        return json.dumps(section_data, indent=2)

    except Exception as e:
        error_msg = f"Error getting project context: {e}"
        logger.error(error_msg)
        return json.dumps({"error": error_msg})


# Tool collections
MCP_MEMORY_TOOLS = [
    recall_similar_solutions,
    learn_from_success,
    record_memory_feedback,
    get_previous_attempt,
    get_project_context,
]
