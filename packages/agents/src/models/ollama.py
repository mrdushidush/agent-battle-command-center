import httpx
from langchain_community.chat_models import ChatOllama
from src.config import settings


def check_ollama_available() -> bool:
    """Check if Ollama is available."""
    try:
        response = httpx.get(f"{settings.OLLAMA_URL}/api/tags", timeout=5.0)
        return response.status_code == 200
    except Exception:
        return False


def get_ollama_llm(model: str | None = None):
    """Get an Ollama LLM instance with function calling support.

    Note: Using ChatOllama instead of Ollama for better tool/function calling support.
    Each call creates a fresh instance to avoid context carryover between tasks.

    IMPORTANT: temperature=0 is critical for consistent tool calling.
    Higher temps cause the model to sometimes skip tool calls and just output code.
    """
    return ChatOllama(
        base_url=settings.OLLAMA_URL,
        model=model or settings.OLLAMA_MODEL,
        temperature=0,  # Critical: 0 for deterministic tool calling
        # Increase timeout for larger models
        timeout=120,
        # Verbose to see tool calls in logs
        verbose=True,
        # Disable caching to ensure clean state
        cache=False,
    )
