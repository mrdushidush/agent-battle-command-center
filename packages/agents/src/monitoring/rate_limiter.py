"""
Anthropic API Rate Limiter

Implements sliding window rate limiting to prevent hitting API limits.
Tracks requests per minute (RPM) and tokens per minute (TPM).
Uses singleton pattern for global rate limiting across all agents.
"""

import os
import time
import threading
from collections import deque
from dataclasses import dataclass
from typing import Optional


@dataclass
class RateLimits:
    rpm: int  # Requests per minute
    input_tpm: int  # Input tokens per minute
    output_tpm: int  # Output tokens per minute


@dataclass
class UsageEntry:
    timestamp: float
    input_tokens: int
    output_tokens: int


# Anthropic rate limits by model tier
MODEL_LIMITS: dict[str, RateLimits] = {
    "haiku": RateLimits(rpm=50, input_tpm=50000, output_tpm=10000),
    "sonnet": RateLimits(rpm=50, input_tpm=30000, output_tpm=8000),
    "opus": RateLimits(rpm=50, input_tpm=30000, output_tpm=8000),
}

# Buffer threshold - trigger rate limiting at this percentage of limit
RATE_LIMIT_BUFFER = float(os.environ.get("RATE_LIMIT_BUFFER", "0.8"))
# Minimum delay between API calls (seconds)
MIN_API_DELAY = float(os.environ.get("MIN_API_DELAY", "0.5"))
# Debug logging
RATE_LIMIT_DEBUG = os.environ.get("RATE_LIMIT_DEBUG", "false").lower() == "true"


def debug(message: str) -> None:
    """Print debug message if debugging is enabled."""
    if RATE_LIMIT_DEBUG:
        print(f"[RateLimiter] {message}")


class AnthropicRateLimiter:
    """
    Thread-safe rate limiter for Anthropic API calls.
    Uses singleton pattern to ensure all agents share the same rate limit tracking.
    """

    _instance: Optional["AnthropicRateLimiter"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "AnthropicRateLimiter":
        """Singleton pattern for global rate limiting."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize the rate limiter (only runs once due to singleton)."""
        if self._initialized:
            return

        self._usage_by_tier: dict[str, deque[UsageEntry]] = {}
        self._last_call_time: float = 0
        self._tier_locks: dict[str, threading.Lock] = {}

        # Initialize usage deques and locks for each tier
        for tier in MODEL_LIMITS:
            self._usage_by_tier[tier] = deque()
            self._tier_locks[tier] = threading.Lock()

        self._initialized = True

    def get_model_tier(self, model: str) -> str:
        """Get the model tier from a model name."""
        model_lower = model.lower()
        if "haiku" in model_lower:
            return "haiku"
        if "sonnet" in model_lower:
            return "sonnet"
        if "opus" in model_lower:
            return "opus"
        # Default to most restrictive tier
        return "opus"

    def _clean_old_entries(self, tier: str) -> None:
        """Remove entries older than 60 seconds."""
        cutoff = time.time() - 60.0
        entries = self._usage_by_tier[tier]

        # Remove old entries from the left (deque is sorted by time)
        while entries and entries[0].timestamp < cutoff:
            entries.popleft()

    def _get_current_usage(self, tier: str) -> tuple[int, int, int]:
        """Get current usage in the sliding window: (requests, input_tokens, output_tokens)."""
        self._clean_old_entries(tier)
        entries = self._usage_by_tier[tier]

        requests = len(entries)
        input_tokens = sum(e.input_tokens for e in entries)
        output_tokens = sum(e.output_tokens for e in entries)

        return requests, input_tokens, output_tokens

    def _calculate_delay(
        self, tier: str, estimated_input_tokens: int, estimated_output_tokens: int = 0
    ) -> float:
        """Calculate delay needed to stay under limits (in seconds)."""
        limits = MODEL_LIMITS.get(tier)
        if not limits:
            return 0.0

        requests, input_tokens, output_tokens = self._get_current_usage(tier)
        entries = list(self._usage_by_tier[tier])

        # Calculate thresholds with buffer
        rpm_threshold = limits.rpm * RATE_LIMIT_BUFFER
        input_tpm_threshold = limits.input_tpm * RATE_LIMIT_BUFFER
        output_tpm_threshold = limits.output_tpm * RATE_LIMIT_BUFFER

        max_delay = 0.0
        now = time.time()

        # Check RPM
        if requests >= rpm_threshold:
            if entries:
                oldest_timestamp = min(e.timestamp for e in entries)
                rpm_delay = (oldest_timestamp + 60.0) - now
                if rpm_delay > max_delay:
                    max_delay = rpm_delay
                    debug(f"RPM limit: {requests}/{limits.rpm}, need delay: {rpm_delay:.1f}s")

        # Check input TPM
        if input_tokens + estimated_input_tokens >= input_tpm_threshold:
            tokens_to_free = (
                input_tokens + estimated_input_tokens - input_tpm_threshold
            )
            sorted_entries = sorted(entries, key=lambda e: e.timestamp)

            for entry in sorted_entries:
                if tokens_to_free <= 0:
                    break
                delay = (entry.timestamp + 60.0) - now
                if delay > max_delay:
                    max_delay = delay
                    debug(
                        f"Input TPM limit: {input_tokens}/{limits.input_tpm}, need delay: {delay:.1f}s"
                    )
                tokens_to_free -= entry.input_tokens

        # Check output TPM
        if output_tokens + estimated_output_tokens >= output_tpm_threshold:
            tokens_to_free = (
                output_tokens + estimated_output_tokens - output_tpm_threshold
            )
            sorted_entries = sorted(entries, key=lambda e: e.timestamp)

            for entry in sorted_entries:
                if tokens_to_free <= 0:
                    break
                delay = (entry.timestamp + 60.0) - now
                if delay > max_delay:
                    max_delay = delay
                    debug(
                        f"Output TPM limit: {output_tokens}/{limits.output_tpm}, need delay: {delay:.1f}s"
                    )
                tokens_to_free -= entry.output_tokens

        # Enforce minimum delay between calls
        time_since_last_call = now - self._last_call_time
        if time_since_last_call < MIN_API_DELAY:
            min_delay = MIN_API_DELAY - time_since_last_call
            if min_delay > max_delay:
                max_delay = min_delay

        return max(0.0, max_delay)

    def wait_for_capacity(
        self,
        model_or_tier: str,
        estimated_input_tokens: int,
        estimated_output_tokens: int = 0,
    ) -> float:
        """
        Block until capacity is available.

        Args:
            model_or_tier: Model name or tier (haiku/sonnet/opus)
            estimated_input_tokens: Estimated input tokens for the call
            estimated_output_tokens: Estimated output tokens (default 0)

        Returns:
            Number of seconds waited
        """
        tier = (
            model_or_tier
            if model_or_tier in MODEL_LIMITS
            else self.get_model_tier(model_or_tier)
        )

        with self._tier_locks[tier]:
            delay = self._calculate_delay(
                tier, estimated_input_tokens, estimated_output_tokens
            )

            if delay > 0:
                print(
                    f"[RateLimiter] Waiting {delay:.1f}s for {tier} capacity "
                    f"(estimated: {estimated_input_tokens} input tokens)"
                )
                time.sleep(delay)

            self._last_call_time = time.time()
            return delay

    def record_usage(
        self, model_or_tier: str, input_tokens: int, output_tokens: int
    ) -> None:
        """
        Record actual token usage after an API call completes.

        Args:
            model_or_tier: Model name or tier
            input_tokens: Actual input tokens used
            output_tokens: Actual output tokens used
        """
        tier = (
            model_or_tier
            if model_or_tier in MODEL_LIMITS
            else self.get_model_tier(model_or_tier)
        )

        with self._tier_locks[tier]:
            self._usage_by_tier[tier].append(
                UsageEntry(
                    timestamp=time.time(),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
            )
            debug(
                f"Recorded usage for {tier}: {input_tokens} input, {output_tokens} output tokens"
            )

    def get_status(self) -> dict[str, dict]:
        """Get current rate limit status for monitoring."""
        status = {}

        for tier, limits in MODEL_LIMITS.items():
            with self._tier_locks[tier]:
                requests, input_tokens, output_tokens = self._get_current_usage(tier)
                status[tier] = {
                    "requests": requests,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "limits": {
                        "rpm": limits.rpm,
                        "input_tpm": limits.input_tpm,
                        "output_tpm": limits.output_tpm,
                    },
                }

        return status


# Global singleton instance
rate_limiter = AnthropicRateLimiter()
