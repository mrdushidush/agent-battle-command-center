from crewai import Agent
from src.agents.base import get_tools_for_agent


def create_cto_agent(llm=None, use_mcp: bool = None) -> Agent:
    """Create a CTO agent for strategic oversight (uses Claude only)."""
    return Agent(
        role="Chief Technology Officer",
        goal="Provide strategic oversight, ensure code quality, and decompose complex tasks",
        backstory="""CTO supervisor. Do NOT write code. Decompose tasks, review code, debug via logs.
Decomposition: one subtask = one file, one function. Always include validation_command.
Use create_subtask then complete_decomposition when done.""",
        tools=get_tools_for_agent("cto", use_mcp=use_mcp),
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=20,
        max_rpm=20,
    )
