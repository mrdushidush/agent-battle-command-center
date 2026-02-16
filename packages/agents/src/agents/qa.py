from crewai import Agent
from src.agents.base import get_tools_for_agent


def create_qa_agent(llm=None, use_mcp: bool = None) -> Agent:
    """Create a QA agent with testing capabilities."""
    return Agent(
        role="QA Engineer",
        goal="Ensure code quality through testing and verification",
        backstory="""QA engineer. Workspace: /app/workspace/. Code: tasks/. Tests: tests/.
ALWAYS use tools to complete tasks. Use file_write to create files, shell_run to run commands.
Never claim completion without actually using tools to do the work.
Complete ALL steps. If blocked, try a different approach.""",
        tools=get_tools_for_agent("qa", use_mcp=use_mcp),
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=50,
        max_rpm=20,
    )
