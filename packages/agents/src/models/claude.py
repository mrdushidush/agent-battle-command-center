from langchain_anthropic import ChatAnthropic
from src.config import settings


def get_claude_llm(model: str | None = None):
    """Get a Claude LLM instance with timeout and retry configuration."""
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not set")

    return ChatAnthropic(
        model=model or settings.DEFAULT_MODEL,
        anthropic_api_key=settings.ANTHROPIC_API_KEY,
        temperature=0.7,
        max_tokens=4096,
        timeout=settings.ANTHROPIC_TIMEOUT,
        max_retries=settings.ANTHROPIC_MAX_RETRIES,
    )
