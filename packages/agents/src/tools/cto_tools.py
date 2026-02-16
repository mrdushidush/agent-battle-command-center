"""
CTO Agent Tools - Strategic decision-making and orchestration tools.

These tools are exclusive to the CTO agent for:
- Reviewing code quality
- Assigning tasks to agents
- Querying execution logs for debugging
- Escalating tasks for human review
- Making architectural decisions
"""

import json
import requests
from typing import Dict, Any, List
from crewai_tools import tool

from src.config import settings

API_URL = "http://api:3001"


def _api_headers():
    """Get headers with API key for internal API calls."""
    h = {"Content-Type": "application/json"}
    if settings.API_KEY:
        h["X-API-Key"] = settings.API_KEY
    return h


@tool("Review Code Quality")
def review_code(file_path: str) -> str:
    """Review code quality. Args: file_path (str) relative to workspace."""
    try:
        # Read the file content
        import os
        full_path = os.path.join("/app/workspace", file_path)

        if not os.path.exists(full_path):
            return json.dumps({"error": f"File not found: {file_path}"})

        with open(full_path, 'r') as f:
            content = f.read()

        # Simple heuristic-based review (can be enhanced with Claude analysis)
        issues = []
        suggestions = []
        positive_aspects = []
        quality_score = 8  # Default decent score

        # Check for common issues
        lines = content.split('\n')

        # Check for very long lines
        long_lines = [i+1 for i, line in enumerate(lines) if len(line) > 100]
        if long_lines:
            issues.append(f"Long lines detected at: {long_lines[:5]}")
            suggestions.append("Consider breaking long lines for readability (PEP 8 recommends <79 chars)")
            quality_score -= 1

        # Check for docstrings in Python files
        if file_path.endswith('.py'):
            if 'def ' in content and '"""' not in content and "'''" not in content:
                issues.append("Missing docstrings")
                suggestions.append("Add docstrings to functions and classes")
                quality_score -= 1
            else:
                positive_aspects.append("Contains docstrings")

        # Check for error handling
        if file_path.endswith('.py'):
            if 'try:' in content or 'except' in content:
                positive_aspects.append("Includes error handling")
            elif 'def ' in content:
                suggestions.append("Consider adding error handling with try/except blocks")

        # Check for tests
        if file_path.endswith('.py') and 'test_' in file_path:
            if 'assert' in content or 'self.assert' in content:
                positive_aspects.append("Contains test assertions")
            else:
                issues.append("Test file lacks assertions")
                quality_score -= 2

        # Check for type hints (Python 3.5+)
        if file_path.endswith('.py') and 'def ' in content:
            if '->' in content or ': str' in content or ': int' in content:
                positive_aspects.append("Uses type hints")
            else:
                suggestions.append("Consider adding type hints for better code clarity")

        return json.dumps({
            "quality_score": max(1, min(10, quality_score)),
            "issues": issues,
            "suggestions": suggestions,
            "positive_aspects": positive_aspects,
            "file_analyzed": file_path,
            "lines_of_code": len(lines)
        }, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("Query Execution Logs")
def query_logs(task_id: str) -> str:
    """Get execution logs for a task. Args: task_id (str)."""
    try:
        response = requests.get(
            f"{API_URL}/api/execution-logs/task/{task_id}",
            headers=_api_headers(),
            timeout=10
        )

        if response.status_code == 200:
            logs = response.json()

            # Format for easy reading
            formatted = {
                "task_id": task_id,
                "total_steps": len(logs),
                "steps": []
            }

            for log in logs:
                formatted["steps"].append({
                    "step": log.get("step"),
                    "action": log.get("action"),
                    "duration_ms": log.get("durationMs"),
                    "thought": log.get("thought"),
                    "input": log.get("actionInput"),
                    "result": log.get("observation")[:200] + "..." if len(log.get("observation", "")) > 200 else log.get("observation"),
                    "is_loop": log.get("isLoop"),
                    "error": log.get("errorTrace")
                })

            return json.dumps(formatted, indent=2)
        else:
            return json.dumps({
                "error": f"Failed to fetch logs: HTTP {response.status_code}",
                "task_id": task_id
            })

    except Exception as e:
        return json.dumps({"error": str(e), "task_id": task_id})


@tool("Assign Task to Agent")
def assign_task(task_id: str, agent_id: str, reason: str = "") -> str:
    """Assign task to agent. Args: task_id (str), agent_id (str), reason (str, optional)."""
    try:
        response = requests.patch(
            f"{API_URL}/api/tasks/{task_id}",
            json={"assignedAgentId": agent_id, "status": "assigned"},
            headers=_api_headers(),
            timeout=10
        )

        if response.status_code == 200:
            return json.dumps({
                "success": True,
                "task_id": task_id,
                "assigned_to": agent_id,
                "reason": reason,
                "message": f"Task assigned to {agent_id}"
            })
        else:
            return json.dumps({
                "success": False,
                "error": f"HTTP {response.status_code}",
                "task_id": task_id
            })

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@tool("Escalate Task for Human Review")
def escalate_task(task_id: str, reason: str, urgency: str = "normal") -> str:
    """Escalate task for human review. Args: task_id (str), reason (str), urgency (str)."""
    try:
        response = requests.patch(
            f"{API_URL}/api/tasks/{task_id}",
            json={"status": "needs_human", "error": f"[{urgency.upper()}] {reason}"},
            headers=_api_headers(),
            timeout=10
        )

        if response.status_code == 200:
            return json.dumps({
                "success": True,
                "task_id": task_id,
                "escalated": True,
                "reason": reason,
                "urgency": urgency,
                "message": "Task escalated for human review"
            })
        else:
            return json.dumps({
                "success": False,
                "error": f"HTTP {response.status_code}"
            })

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@tool("Get Task Details")
def get_task_info(task_id: str) -> str:
    """Get task details. Args: task_id (str)."""
    try:
        response = requests.get(
            f"{API_URL}/api/tasks/{task_id}",
            headers=_api_headers(),
            timeout=10
        )

        if response.status_code == 200:
            task = response.json()
            return json.dumps({
                "id": task.get("id"),
                "title": task.get("title"),
                "description": task.get("description"),
                "status": task.get("status"),
                "taskType": task.get("taskType"),
                "priority": task.get("priority"),
                "assignedAgentId": task.get("assignedAgentId"),
                "currentIteration": task.get("currentIteration"),
                "maxIterations": task.get("maxIterations"),
                "result": task.get("result"),
                "error": task.get("error"),
                "createdAt": task.get("createdAt"),
                "completedAt": task.get("completedAt")
            }, indent=2)
        else:
            return json.dumps({"error": f"HTTP {response.status_code}"})

    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("List Available Agents")
def list_agents() -> str:
    """List all agents and their status."""
    try:
        response = requests.get(
            f"{API_URL}/api/agents",
            headers=_api_headers(),
            timeout=10
        )

        if response.status_code == 200:
            agents = response.json()
            formatted = []

            for agent in agents:
                formatted.append({
                    "id": agent.get("id"),
                    "name": agent.get("name"),
                    "type": agent.get("agentType", {}).get("name"),
                    "status": agent.get("status"),
                    "currentTaskId": agent.get("currentTaskId"),
                    "stats": agent.get("stats")
                })

            return json.dumps(formatted, indent=2)
        else:
            return json.dumps({"error": f"HTTP {response.status_code}"})

    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("Create Subtask")
def create_subtask(
    parent_task_id: str,
    title: str,
    description: str,
    acceptance_criteria: str,
    validation_command: str = "",
    context_notes: str = "",
    suggested_agent: str = "coder",
    priority: int = 5
) -> str:
    """Create an atomic subtask for a parent task. One subtask = one file/function.
    Args: parent_task_id, title, description, acceptance_criteria, validation_command, context_notes, suggested_agent, priority."""
    try:
        # Map suggested_agent to requiredAgent
        agent_type_map = {
            "coder": "coder",
            "qa": "qa",
            "cto": "cto"
        }
        required_agent = agent_type_map.get(suggested_agent.lower(), "coder")

        # Determine task type based on description/title
        task_type = "code"
        lower_title = title.lower()
        lower_desc = description.lower()
        if any(word in lower_title or word in lower_desc for word in ["test", "verify", "check", "validate"]):
            task_type = "test"
        elif any(word in lower_title or word in lower_desc for word in ["review", "analyze", "audit"]):
            task_type = "review"
        elif any(word in lower_title or word in lower_desc for word in ["refactor", "restructure", "reorganize"]):
            task_type = "refactor"

        # Append validation command to description if provided
        full_description = description
        if validation_command:
            full_description += f"\n\nVALIDATION (run this to verify):\n{validation_command}"

        # Create the subtask
        response = requests.post(
            f"{API_URL}/api/tasks",
            headers=_api_headers(),
            json={
                "title": title[:200],  # Enforce max length
                "description": full_description,
                "taskType": task_type,
                "requiredAgent": required_agent,
                "priority": max(1, min(10, priority)),
                "maxIterations": 10,
                "humanTimeoutMinutes": 15,
                "parentTaskId": parent_task_id,
                "acceptanceCriteria": acceptance_criteria,
                "contextNotes": context_notes,
                "validationCommand": validation_command
            },
            timeout=10
        )

        if response.status_code == 201 or response.status_code == 200:
            task = response.json()
            return json.dumps({
                "success": True,
                "subtask_id": task.get("id"),
                "parent_task_id": parent_task_id,
                "title": task.get("title"),
                "task_type": task_type,
                "suggested_agent": suggested_agent,
                "priority": priority,
                "message": f"Subtask created successfully: {title}"
            }, indent=2)
        else:
            error_text = response.text[:200] if response.text else "Unknown error"
            return json.dumps({
                "success": False,
                "error": f"HTTP {response.status_code}: {error_text}"
            })

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@tool("Mark Task Decomposition Complete")
def complete_decomposition(parent_task_id: str, summary: str, subtask_count: int) -> str:
    """Mark decomposition done. Args: parent_task_id, summary, subtask_count."""
    try:
        response = requests.patch(
            f"{API_URL}/api/tasks/{parent_task_id}",
            headers=_api_headers(),
            json={
                "status": "completed",
                "result": json.dumps({
                    "decomposed": True,
                    "subtask_count": subtask_count,
                    "summary": summary,
                    "status": "SUCCESS",
                    "confidence": 1.0
                })
            },
            timeout=10
        )

        if response.status_code == 200:
            return json.dumps({
                "success": True,
                "parent_task_id": parent_task_id,
                "subtask_count": subtask_count,
                "summary": summary,
                "message": f"Task decomposed into {subtask_count} subtasks"
            }, indent=2)
        else:
            return json.dumps({
                "success": False,
                "error": f"HTTP {response.status_code}"
            })

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})
