import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "anthropic/claude-sonnet-4-5-20250929")
    WORKSPACE_PATH: str = os.getenv("WORKSPACE_PATH", "/app/workspace")
    API_KEY: str = os.getenv("API_KEY", "")
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))

    # Network resilience settings
    ANTHROPIC_TIMEOUT: int = int(os.getenv("ANTHROPIC_TIMEOUT", "120"))  # seconds
    ANTHROPIC_MAX_RETRIES: int = int(os.getenv("ANTHROPIC_MAX_RETRIES", "3"))

    # Rate limit settings (for litellm)
    LITELLM_NUM_RETRIES: int = int(os.getenv("LITELLM_NUM_RETRIES", "5"))
    LITELLM_REQUEST_TIMEOUT: int = int(os.getenv("LITELLM_REQUEST_TIMEOUT", "120"))

    # MCP Gateway settings (Real-time Agent Collaboration)
    USE_MCP: bool = os.getenv("USE_MCP", "false").lower() == "true"
    MCP_GATEWAY_URL: str = os.getenv("MCP_GATEWAY_URL", "http://mcp-gateway:8001")
    MCP_GATEWAY_TIMEOUT: int = int(os.getenv("MCP_GATEWAY_TIMEOUT", "30"))


settings = Settings()
