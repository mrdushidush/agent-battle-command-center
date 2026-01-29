"""
Token tracking callback handler for LangChain LLM calls.
"""

from typing import Any, Dict, List, Optional
from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import LLMResult

from .rate_limiter import rate_limiter


class TokenTracker(BaseCallbackHandler):
    """
    Callback handler that tracks token usage from LLM calls.
    """

    def __init__(self, model_tier: str = "sonnet"):
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.last_input_tokens = 0
        self.last_output_tokens = 0
        self.call_count = 0
        self.model_tier = model_tier

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Called when LLM starts running."""
        # Reset last call tokens
        self.last_input_tokens = 0
        self.last_output_tokens = 0

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Called when LLM ends running."""
        self.call_count += 1

        # Extract token usage from response
        if response.llm_output and "token_usage" in response.llm_output:
            usage = response.llm_output["token_usage"]

            # Anthropic format
            if "input_tokens" in usage and "output_tokens" in usage:
                input_tokens = usage["input_tokens"]
                output_tokens = usage["output_tokens"]
            # OpenAI format
            elif "prompt_tokens" in usage and "completion_tokens" in usage:
                input_tokens = usage["prompt_tokens"]
                output_tokens = usage["completion_tokens"]
            else:
                return

            self.last_input_tokens = input_tokens
            self.last_output_tokens = output_tokens
            self.total_input_tokens += input_tokens
            self.total_output_tokens += output_tokens

            # Record usage with rate limiter
            rate_limiter.record_usage(self.model_tier, input_tokens, output_tokens)

    def get_last_call_tokens(self) -> tuple[int, int]:
        """Get tokens from the last LLM call (input, output)."""
        return (self.last_input_tokens, self.last_output_tokens)

    def get_total_tokens(self) -> tuple[int, int]:
        """Get total tokens across all calls (input, output)."""
        return (self.total_input_tokens, self.total_output_tokens)

    def reset(self) -> None:
        """Reset all counters."""
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.last_input_tokens = 0
        self.last_output_tokens = 0
        self.call_count = 0
