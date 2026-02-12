"""
Execution logger that captures agent thought/action/observation cycles
and sends them to the API for storage and analysis.
"""

import time
import json
import re
import os
from typing import Optional, Dict, Any
from datetime import datetime
import requests

from src.config import settings


class ExecutionLogger:
    """
    Captures and logs agent execution steps to the API.

    Parses CrewAI verbose output to extract:
    - Agent thoughts/reasoning
    - Actions (tool calls)
    - Action inputs (parameters)
    - Observations (tool results)
    - Durations
    - Loop detection flags
    """

    def __init__(self, task_id: str, agent_id: str, api_url: str, model_name: Optional[str] = None):
        self.task_id = task_id
        self.agent_id = agent_id
        self.api_url = api_url
        self.step_counter = 0
        self.current_step_start = None
        self.logs_buffer = []
        self.model_name = model_name

    def parse_and_log_output(self, output: str, is_loop: bool = False) -> None:
        """
        Parse CrewAI verbose output and extract execution steps.

        CrewAI verbose output format:
        ```
        > Entering new CrewAgentExecutor chain...
        Thought: [agent reasoning]
        Action: [tool_name]
        Action Input: [json or string]
        Observation: [tool result]
        ```
        """
        # Split output into individual steps
        # Each step starts with "Thought:" or contains an Action/Observation pair

        # Extract thought/action/observation patterns
        pattern = r"(?:Thought:\s*(.*?)(?=\nAction:|\n\n|$))?" \
                 r"(?:Action:\s*(.*?)(?=\nAction Input:|\n|$))?" \
                 r"(?:Action Input:\s*(.*?)(?=\nObservation:|\n|$))?" \
                 r"(?:Observation:\s*(.*?)(?=\nThought:|\n\n|$))?"

        matches = re.finditer(pattern, output, re.DOTALL)

        for match in matches:
            thought, action, action_input, observation = match.groups()

            # Skip empty matches
            if not any([thought, action, observation]):
                continue

            # Clean up extracted text
            thought = thought.strip() if thought else None
            action = action.strip() if action else None
            action_input_str = action_input.strip() if action_input else "{}"
            observation = observation.strip() if observation else None

            # Only log if we have at least an action or observation
            if action or observation:
                self.step_counter += 1

                # Parse action input (JSON or string)
                try:
                    action_input_dict = json.loads(action_input_str)
                except (json.JSONDecodeError, ValueError):
                    # If not JSON, wrap as string
                    action_input_dict = {"raw_input": action_input_str}

                # Create log entry
                log_entry = {
                    "taskId": self.task_id,
                    "agentId": self.agent_id,
                    "step": self.step_counter,
                    "thought": thought,
                    "action": action or "unknown",
                    "actionInput": action_input_dict,
                    "observation": observation or "",
                    "isLoop": is_loop,
                }

                # Send to API
                self._send_log(log_entry)

    def log_step(
        self,
        action: str,
        action_input: Dict[str, Any],
        observation: str,
        thought: Optional[str] = None,
        duration_ms: Optional[int] = None,
        is_loop: bool = False,
        error_trace: Optional[str] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        model_used: Optional[str] = None,
    ) -> None:
        """
        Manually log a single execution step.

        Use this for direct logging when you have structured data.
        """
        self.step_counter += 1

        log_entry = {
            "taskId": self.task_id,
            "agentId": self.agent_id,
            "step": self.step_counter,
            "thought": thought,
            "action": action,
            "actionInput": action_input,
            "observation": observation,
            "durationMs": duration_ms,
            "isLoop": is_loop,
            "errorTrace": error_trace,
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "modelUsed": model_used or self.model_name,
        }

        self._send_log(log_entry)

    def _send_log(self, log_entry: Dict[str, Any]) -> None:
        """
        Send log entry to API endpoint.

        Retries once on failure, then buffers for later if still failing.
        """
        try:
            # Remove None values
            log_entry = {k: v for k, v in log_entry.items() if v is not None}

            # Get API key from environment
            api_key = os.environ.get("API_KEY", "")
            headers = {
                "Content-Type": "application/json",
                "X-API-Key": api_key,
            }

            response = requests.post(
                f"{self.api_url}/api/execution-logs",
                json=log_entry,
                headers=headers,
                timeout=5,
            )

            if response.status_code == 201:
                print(f"✅ Logged step {log_entry['step']}: {log_entry['action']}")
            else:
                print(f"⚠️  Failed to log step {log_entry['step']}: {response.status_code}")
                self.logs_buffer.append(log_entry)

        except requests.RequestException as e:
            print(f"⚠️  Error logging step {log_entry.get('step', '?')}: {e}")
            self.logs_buffer.append(log_entry)

    def flush_buffer(self) -> None:
        """
        Retry sending buffered logs.
        """
        if not self.logs_buffer:
            return

        print(f"🔄 Retrying {len(self.logs_buffer)} buffered logs...")

        # Get API key from environment
        api_key = os.environ.get("API_KEY", "")
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": api_key,
        }

        failed = []
        for log_entry in self.logs_buffer:
            try:
                response = requests.post(
                    f"{self.api_url}/api/execution-logs",
                    json=log_entry,
                    headers=headers,
                    timeout=5,
                )
                if response.status_code != 201:
                    failed.append(log_entry)
            except requests.RequestException:
                failed.append(log_entry)

        self.logs_buffer = failed

        if failed:
            print(f"⚠️  {len(failed)} logs still failed after retry")
        else:
            print("✅ All buffered logs sent successfully")

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Estimate token count from text length.
        Rough approximation: ~4 characters per token for English text.
        """
        if not text:
            return 0
        return max(1, len(text) // 4)


def create_tool_wrapper(tool, logger: ExecutionLogger):
    """
    Wrap a tool to log its execution automatically.

    This wrapper intercepts tool calls and logs them with timing and token information.
    """
    original_run = tool._run

    def logged_run(*args, **kwargs):
        start_time = time.time()
        step_start = logger.step_counter + 1

        # Extract parameters
        action_input = kwargs if kwargs else {"args": args} if args else {}

        # Execute the tool
        try:
            result = original_run(*args, **kwargs)
            duration_ms = int((time.time() - start_time) * 1000)

            # Estimate token usage from input/output sizes
            # Most tool calls don't use LLM tokens, so these will be 0 or small estimates
            input_str = json.dumps(action_input) if isinstance(action_input, dict) else str(action_input)
            output_str = str(result)[:4000]

            estimated_input_tokens = ExecutionLogger.estimate_tokens(input_str)
            estimated_output_tokens = ExecutionLogger.estimate_tokens(output_str)

            # Log the execution
            logger.log_step(
                action=tool.name,
                action_input=action_input,
                observation=output_str,  # Truncate long results
                duration_ms=duration_ms,
                is_loop=False,
                input_tokens=estimated_input_tokens,
                output_tokens=estimated_output_tokens,
            )

            return result

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)

            error_msg = f"Error: {str(e)}"
            estimated_output_tokens = ExecutionLogger.estimate_tokens(error_msg)

            # Log the error
            logger.log_step(
                action=tool.name,
                action_input=action_input,
                observation=error_msg,
                duration_ms=duration_ms,
                is_loop=False,
                error_trace=str(e),
                output_tokens=estimated_output_tokens,
            )

            raise

    tool._run = logged_run
    return tool
