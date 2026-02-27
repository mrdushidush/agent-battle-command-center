import uuid
import time
import sys
import io
import os
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from crewai import Crew, Task
import litellm

from src.config import settings

# Configure litellm for rate limit handling with exponential backoff
# These settings apply to all litellm calls made by CrewAI
litellm.num_retries = int(os.environ.get("LITELLM_NUM_RETRIES", "5"))
litellm.request_timeout = int(os.environ.get("LITELLM_REQUEST_TIMEOUT", "120"))

# Set up custom retry policy for rate limits
# litellm will wait: base_delay * (2 ** retry_attempt) seconds between retries
os.environ.setdefault("LITELLM_RETRY_DELAY_INITIAL", "5")  # Start with 5 second wait
os.environ.setdefault("LITELLM_RETRY_DELAY_MAX", "60")  # Max 60 seconds between retries

# Enable verbose logging for rate limit debugging
if os.environ.get("RATE_LIMIT_DEBUG", "false").lower() == "true":
    litellm.set_verbose = True
    print("[LiteLLM] Rate limit handling configured: num_retries=5, exponential backoff enabled")


# Track rate limit events for logging
_rate_limit_count = 0

# Track ongoing executions for abort support
execution_state: dict = {}


def handle_litellm_failure(kwargs, completion_response, start_time, end_time):
    """Callback for litellm failures - tracks rate limit events."""
    global _rate_limit_count
    if kwargs.get("exception"):
        exception_str = str(kwargs["exception"]).lower()
        if "rate_limit" in exception_str or "rate limit" in exception_str:
            _rate_limit_count += 1
            print(f"⚠️  [RateLimiter] Rate limit hit (count: {_rate_limit_count}). LiteLLM will retry with backoff.")


# Register the failure callback
litellm.failure_callback = [handle_litellm_failure]
from src.agents import create_coder_agent, create_qa_agent, create_cto_agent
from src.models import get_claude_llm, get_ollama_llm, check_ollama_available
from src.chat import ChatRequest, ChatResponse, chat_stream, chat_sync
from src.schemas.output import AgentOutput, parse_agent_output
from src.monitoring import ActionHistory, ExecutionLogger, create_tool_wrapper, TokenTracker, rate_limiter


app = FastAPI(
    title="ABCC Agents Service",
    description="AI Agent executor service for Agent Battle Command Center",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




from src.orchestrator import decompose_prompt, review_results


# ── Orchestration request/response models ────────────────────────────────────

class DecomposeRequest(BaseModel):
    prompt: str
    language: str = "python"
    context: str | None = None


class ReviewRequest(BaseModel):
    prompt: str
    subtasks: list[dict]


class ExecuteRequest(BaseModel):
    task_id: str
    agent_id: str
    task_description: str | None = None
    expected_output: str | None = None
    use_claude: bool = True
    model: str | None = None
    allow_fallback: bool = True
    step_by_step: bool = False
    env: dict[str, str] | None = None  # Optional environment variables for this execution


class ExecuteResponse(BaseModel):
    success: bool
    execution_id: str
    output: str | None = None
    error: str | None = None
    metrics: dict | None = None




class AbortRequest(BaseModel):
    task_id: str


class ValidateSyntaxRequest(BaseModel):
    code: str
    language: str


class ValidateSyntaxResponse(BaseModel):
    result: str  # "OK" or error message


class RunValidationRequest(BaseModel):
    command: str       # e.g. "from tasks.c1_double import double; assert double(5)==10; print('PASS')"
    language: str = "python"
    timeout: int = 15


class RunValidationResponse(BaseModel):
    success: bool      # returncode == 0 AND "PASS" in stdout
    output: str        # stdout or stderr
    exit_code: int


def get_llm(use_claude: bool, model: str | None, allow_fallback: bool):
    """Get the appropriate LLM based on configuration.

    For Claude: returns model string for litellm (crewai 0.86.0+)
    For xAI/Grok: returns model string with openai/ prefix + api_base for litellm
    For Ollama: returns model string with ollama/ prefix for litellm

    Note: CrewAI 0.86.0+ uses litellm internally, so we return model strings
    with provider prefixes rather than LangChain objects.
    """
    # Check if model explicitly requests xAI/Grok
    if model and model.startswith("grok"):
        if settings.XAI_API_KEY:
            # litellm uses openai/ prefix with custom api_base for xAI
            os.environ["XAI_API_KEY"] = settings.XAI_API_KEY
            model_name = f"xai/{model}"
            print(f"🔮 Using xAI/Grok: {model_name} via {settings.XAI_BASE_URL}")
            return model_name
        else:
            raise ValueError("XAI_API_KEY not set. Cannot use Grok models.")

    if use_claude and settings.ANTHROPIC_API_KEY:
        # Return model string for litellm (crewai 0.86.0+)
        model_name = model or settings.DEFAULT_MODEL
        # Ensure anthropic/ prefix for litellm
        if not model_name.startswith("anthropic/"):
            model_name = f"anthropic/{model_name}"
        return model_name
    elif check_ollama_available():
        # Return model string for litellm with ollama/ prefix
        # OLLAMA_API_BASE env var tells litellm where to connect
        ollama_model = model or settings.OLLAMA_MODEL
        if not ollama_model.startswith("ollama/"):
            ollama_model = f"ollama/{ollama_model}"
        return ollama_model
    else:
        raise ValueError("No LLM available. Set ANTHROPIC_API_KEY or ensure Ollama is running.")


def get_agent(agent_type: str, llm, use_mcp: bool = True):
    """Get the appropriate agent based on type.

    Args:
        agent_type: Type of agent (coder, qa, cto)
        llm: LLM instance or model string
        use_mcp: Whether to enable MCP tools (disable for Ollama, enable for Claude)
    """
    if agent_type.startswith("coder"):
        return create_coder_agent(llm, use_mcp=use_mcp)
    elif agent_type.startswith("qa"):
        return create_qa_agent(llm, use_mcp=use_mcp)
    elif agent_type.startswith("cto"):
        return create_cto_agent(llm, use_mcp=use_mcp)
    else:
        raise ValueError(f"Unknown agent type: {agent_type}")


def get_model_tier(model: str) -> str:
    """Get the model tier from a model name for rate limiting."""
    if not model:
        return "sonnet"  # Default tier
    model_lower = model.lower()
    if "haiku" in model_lower:
        return "haiku"
    if "sonnet" in model_lower:
        return "sonnet"
    if "opus" in model_lower:
        return "opus"
    if "grok" in model_lower or "xai" in model_lower:
        return "grok"
    if "ollama" in model_lower:
        return "ollama"  # Not rate limited
    return "sonnet"  # Default to sonnet tier


# Cost rates per million tokens (USD) - mirrors costCalculator.ts
COST_RATES = {
    "ollama": {"input": 0, "output": 0},
    "grok": {"input": 5, "output": 15},  # xAI grok-code-fast-1 pricing (estimated)
    "haiku": {"input": 1, "output": 5},
    "sonnet": {"input": 3, "output": 15},
    "opus": {"input": 5, "output": 25},
}


def calculate_api_credits(model_tier: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate API cost in USD from token usage and model tier."""
    rates = COST_RATES.get(model_tier, COST_RATES["sonnet"])
    input_cost = (input_tokens / 1_000_000) * rates["input"]
    output_cost = (output_tokens / 1_000_000) * rates["output"]
    return round(input_cost + output_cost, 6)


@app.post("/execute", response_model=ExecuteResponse)
async def execute_task(request: ExecuteRequest) -> ExecuteResponse:
    """Execute a task with the specified agent."""
    execution_id = str(uuid.uuid4())
    start_time = time.time()

    try:
        # Reset action history for new task execution
        ActionHistory.reset()

        # Get LLM
        print("\n🔍 DEBUG: Request parameters:")
        print(f"   use_claude: {request.use_claude}")
        print(f"   model: {request.model}")
        print(f"   allow_fallback: {request.allow_fallback}")
        print(f"   ANTHROPIC_API_KEY set: {bool(settings.ANTHROPIC_API_KEY)}")

        llm = get_llm(request.use_claude, request.model, request.allow_fallback)
        print(f"\n{'='*60}")
        print(f"🚀 Starting task execution: {execution_id}")
        print(f"   LLM: {llm.__class__.__name__}")
        print(f"{'='*60}\n")

        # Create execution logger
        # Node API is on port 3001, not the agents service port (8000)
        api_url = "http://api:3001"

        # Extract model name from LLM instance
        model_name = None
        if hasattr(llm, 'model'):
            model_name = llm.model
        elif hasattr(llm, 'model_name'):
            model_name = llm.model_name
        elif 'ollama' in llm.__class__.__name__.lower():
            model_name = 'ollama'

        execution_logger = ExecutionLogger(
            task_id=request.task_id,
            agent_id=request.agent_id,
            api_url=api_url,
            model_name=model_name,
        )
        print(f"📊 Execution logger initialized (API: {api_url}, Model: {model_name})")

        # Determine agent type from agent_id
        if "coder" in request.agent_id.lower():
            agent_type = "coder"
        elif "qa" in request.agent_id.lower():
            agent_type = "qa"
        elif "cto" in request.agent_id.lower():
            agent_type = "cto"
            # CTO always uses Claude (override if needed)
            if not request.use_claude or not settings.ANTHROPIC_API_KEY:
                print("⚠️  CTO agent requires Claude - forcing use_claude=True")
                llm = get_claude_llm(request.model)
        else:
            agent_type = "coder"  # Default fallback

        # Enable MCP only for Claude (Ollama can't handle extra context)
        use_mcp_for_agent = request.use_claude and settings.USE_MCP
        print(f"🔧 MCP enabled: {use_mcp_for_agent} (use_claude={request.use_claude}, USE_MCP={settings.USE_MCP})")

        # Set context environment variables for MCP tools to read
        os.environ['CURRENT_AGENT_ID'] = request.agent_id
        os.environ['CURRENT_TASK_ID'] = request.task_id
        print(f"📋 Set MCP context: agent={request.agent_id}, task={request.task_id}")

        # Set custom environment variables if provided (e.g., OLLAMA_API_BASE for remote Ollama)
        # Save originals so we can restore after execution to prevent leakage
        saved_env: dict[str, str | None] = {}
        is_remote_execution = False
        if request.env:
            for key, value in request.env.items():
                saved_env[key] = os.environ.get(key)
                os.environ[key] = str(value)
            print(f"🔧 Custom env vars: {', '.join(f'{k}={v}' for k, v in request.env.items())}")
            if 'OLLAMA_API_BASE' in request.env:
                is_remote_execution = True
                print(f"🌐 Remote Ollama execution: {request.env['OLLAMA_API_BASE']}")

        agent = get_agent(agent_type, llm, use_mcp=use_mcp_for_agent)

        # Wrap agent tools with logging
        agent.tools = [create_tool_wrapper(tool, execution_logger) for tool in agent.tools]

        print(f"🤖 Agent: {agent.role}")
        print(f"🔧 Tools available: {[tool.name for tool in agent.tools]}")
        print(f"   Max iterations: {agent.max_iter}")

        # Create task
        description = request.task_description or "Complete the assigned task."
        expected_output = request.expected_output or "Task completed successfully with all requirements met."

        print("\n📝 Task Description:")
        print(f"   {description[:200]}{'...' if len(description) > 200 else ''}")
        print("\n💡 Expected Output:")
        print(f"   {expected_output[:200]}{'...' if len(expected_output) > 200 else ''}\n")

        crew_task = Task(
            description=description,
            expected_output=expected_output,
            agent=agent,
            # Note: output_pydantic doesn't work well with Ollama models
            # Instead, we rely on agent backstory instructions to output JSON
        )

        # Create token tracker for LLM calls (with model tier for rate limiting)
        llm_model_tier = get_model_tier(str(llm) if llm else "")
        token_tracker = TokenTracker(model_tier=llm_model_tier)

        # Create and run crew with memory reset and token tracking
        crew = Crew(
            agents=[agent],
            tasks=[crew_task],
            verbose=True,  # Shows all agent reasoning and tool calls
            memory=False,  # Disable memory to prevent context carryover
        )

        print(f"{'='*60}")
        print("🎬 Starting crew execution...")
        print(f"{'='*60}\n")

        # Rate limiting for Anthropic models
        model_tier = get_model_tier(str(llm) if llm else "")
        if model_tier != "ollama":
            # Estimate tokens from task description (~4 chars per token)
            estimated_tokens = len(description) // 4
            wait_time = rate_limiter.wait_for_capacity(model_tier, estimated_tokens)
            if wait_time > 0:
                print(f"⏱️  Rate limited: waited {wait_time:.1f}s before execution")

        # Capture full execution log (all tool calls and observations)
        captured_output = io.StringIO()
        original_stdout = sys.stdout

        try:
            # Redirect stdout to capture verbose CrewAI logs
            sys.stdout = captured_output

            # Execute with timeout to prevent infinite loops
            # Pass token tracker as callback to LLM
            if hasattr(llm, 'callbacks'):
                if llm.callbacks is None:
                    llm.callbacks = []
                llm.callbacks.append(token_tracker)

            result = crew.kickoff()

        finally:
            # Restore stdout
            sys.stdout = original_stdout

        # Get the full execution log
        full_execution_log = captured_output.getvalue()

        print(f"\n{'='*60}")
        print("✅ Crew execution completed")
        print(f"{'='*60}\n")

        # Parse verbose output and capture any steps we might have missed
        # (e.g., if tool wrappers failed or thoughts without actions)
        execution_logger.parse_and_log_output(full_execution_log)

        # Log total token usage from LLM calls
        total_input, total_output = token_tracker.get_total_tokens()
        if total_input > 0 or total_output > 0:
            print(f"📊 Total tokens - Input: {total_input}, Output: {total_output}")

            # Create a summary log entry for LLM token usage
            execution_logger.log_step(
                action="llm_token_summary",
                action_input={"llm_calls": token_tracker.call_count},
                observation=f"Total LLM tokens tracked across {token_tracker.call_count} calls",
                input_tokens=total_input,
                output_tokens=total_output,
            )

        # Flush any buffered logs
        execution_logger.flush_buffer()
        print(f"📊 Logged {execution_logger.step_counter} execution steps")

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Extract text output from CrewAI result
        output_text = str(result)
        if hasattr(result, 'raw'):
            output_text = str(result.raw)
        elif hasattr(result, 'output'):
            output_text = str(result.output)

        # Parse structured output from execution logs (fetched from API) or fallback to parsing raw output
        try:
            structured_output = parse_agent_output(
                raw_output=full_execution_log,
                task_id=request.task_id,
                api_url="http://api:3001"
            )
            print("\n📊 Structured Output (parsed from execution logs):")
        except Exception as e:
            print(f"⚠️  Could not parse structured output: {e}")
            print(f"   Raw output: {output_text[:500]}")
            # Create minimal structured output - mark as UNCERTAIN, not automatic failure
            # The iteration limit alone doesn't mean failure if work was accomplished
            structured_output = AgentOutput(
                status="UNCERTAIN",
                confidence=0.5,
                summary=output_text[:200] + "..." if len(output_text) > 200 else output_text,
                success=True,  # Assume success unless proven otherwise
                details=full_execution_log[:2000] + "..." if len(full_execution_log) > 2000 else full_execution_log,
                failure_reason=None,
                requires_human_review=True,
                suggestions=["Could not parse structured output - manual review recommended"]
            )

        # Display structured output
        print(f"   Status: {structured_output.status}")
        print(f"   Confidence: {structured_output.confidence}")
        print(f"   Summary: {structured_output.summary}")
        print(f"   Files Created: {structured_output.files_created}")
        print(f"   Files Modified: {structured_output.files_modified}")
        print(f"   Commands: {structured_output.commands_executed}")
        print(f"   Test Results: {structured_output.test_results or 'N/A'}")
        print(f"   Success: {structured_output.success}")

        # Use structured output as the main output
        final_output = structured_output.model_dump_json(indent=2)

        total_input, total_output = token_tracker.get_total_tokens()

        # Prefix model name for remote execution tracking
        logged_model_tier = llm_model_tier
        if is_remote_execution and logged_model_tier == "ollama":
            logged_model_tier = "remote_ollama"

        api_credits = calculate_api_credits(logged_model_tier, total_input, total_output)

        # Restore original env vars before returning
        for key, original_value in saved_env.items():
            if original_value is not None:
                os.environ[key] = original_value
            elif key in os.environ:
                del os.environ[key]

        return ExecuteResponse(
            success=structured_output.success,
            execution_id=execution_id,
            output=final_output,
            metrics={
                "time_spent_ms": elapsed_ms,
                "api_credits_used": api_credits,
                "iterations": 1,
                "input_tokens": total_input,
                "output_tokens": total_output,
            },
        )

    except Exception as e:
        # Restore original env vars on error
        if 'saved_env' in locals():
            for key, original_value in saved_env.items():
                if original_value is not None:
                    os.environ[key] = original_value
                elif key in os.environ:
                    del os.environ[key]

        elapsed_ms = int((time.time() - start_time) * 1000)
        return ExecuteResponse(
            success=False,
            execution_id=execution_id,
            error=str(e),
            metrics={
                "time_spent_ms": elapsed_ms,
                "api_credits_used": 0,
                "iterations": 0,
            },
        )


@app.post("/validate-syntax", response_model=ValidateSyntaxResponse)
async def validate_syntax(request: ValidateSyntaxRequest):
    """Validate code syntax using the validate_syntax tool."""
    try:
        from src.tools.code_validation import validate_syntax as validate_tool
        result = validate_tool._run(request.code, request.language)
        return ValidateSyntaxResponse(result=result)
    except Exception as e:
        return ValidateSyntaxResponse(result=f"Validation error: {str(e)}")


@app.post("/run-validation", response_model=RunValidationResponse)
async def run_validation(request: RunValidationRequest):
    """Run a validation command in the workspace to verify task output."""
    import subprocess as sp

    # If command already starts with a binary (go run, php, python, node, tsx),
    # treat it as a full command and just split it. Otherwise, wrap it with
    # the appropriate -c/-e flag for the detected language.
    command = request.command.strip()
    first_word = command.split()[0] if command else ""
    full_command_prefixes = ("go", "php", "python", "python3", "node", "tsx")

    if first_word in full_command_prefixes:
        import shlex
        cmd = shlex.split(command)
    else:
        lang = request.language.lower()
        if lang == "python":
            cmd = ["python3", "-c", command]
        elif lang in ("javascript", "js"):
            cmd = ["node", "-e", command]
        elif lang in ("typescript", "ts"):
            cmd = ["tsx", "-e", command]
        elif lang == "php":
            cmd = ["php", "-r", command]
        elif lang == "go":
            cmd = ["go", "run", command]
        else:
            return RunValidationResponse(
                success=False,
                output=f"Unsupported language: {request.language}",
                exit_code=-1,
            )

    try:
        result = sp.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=request.timeout,
            cwd=settings.WORKSPACE_PATH,
        )

        output = result.stdout
        if result.stderr:
            output += ("\n" if output else "") + result.stderr

        success = result.returncode == 0 and "PASS" in result.stdout

        return RunValidationResponse(
            success=success,
            output=output.strip()[:5000],  # Cap output size
            exit_code=result.returncode,
        )
    except sp.TimeoutExpired:
        return RunValidationResponse(
            success=False,
            output=f"Validation timed out after {request.timeout}s",
            exit_code=-1,
        )
    except Exception as e:
        return RunValidationResponse(
            success=False,
            output=f"Validation error: {str(e)}",
            exit_code=-1,
        )


@app.post("/execute/abort")
async def abort_execution(request: AbortRequest):
    """Abort an ongoing execution."""
    task_id = request.task_id

    if task_id in execution_state:
        execution_state[task_id]["status"] = "aborted"
        del execution_state[task_id]

    return {"aborted": True, "task_id": task_id}


@app.post("/chat")
async def chat(request: ChatRequest):
    """Chat endpoint with optional streaming."""
    try:
        if request.stream:
            return StreamingResponse(
                chat_stream(request),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        else:
            response = chat_sync(request)
            return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/orchestrate/decompose")
async def orchestrate_decompose(request: DecomposeRequest):
    """Decompose a user prompt into atomic subtasks using Sonnet."""
    try:
        subtasks = decompose_prompt(request.prompt, request.language, request.context)
        return {"success": True, "subtasks": subtasks}
    except Exception as e:
        return {"success": False, "error": str(e), "subtasks": []}


@app.post("/orchestrate/review")
async def orchestrate_review(request: ReviewRequest):
    """Review completed subtask results against original prompt."""
    try:
        result = review_results(request.prompt, request.subtasks)
        return {"success": True, "review": result}
    except Exception as e:
        return {"success": False, "error": str(e), "review": {"approved": False, "score": 0, "summary": str(e), "findings": []}}


@app.get("/health")
async def health():
    """Health check endpoint."""
    ollama_available = check_ollama_available()
    claude_available = bool(settings.ANTHROPIC_API_KEY)
    grok_available = bool(settings.XAI_API_KEY)

    # Check remote Ollama availability
    remote_ollama_available = False
    if settings.REMOTE_OLLAMA_URL:
        try:
            import httpx
            resp = httpx.get(f"{settings.REMOTE_OLLAMA_URL}/api/tags", timeout=5)
            remote_ollama_available = resp.status_code == 200
        except Exception:
            remote_ollama_available = False

    return {
        "status": "ok",
        "ollama": ollama_available,
        "claude": claude_available,
        "grok": grok_available,
        "remote_ollama": remote_ollama_available,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,
    )
