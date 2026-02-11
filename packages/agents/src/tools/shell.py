import subprocess
import shlex
import re
from crewai_tools import BaseTool
from src.config import settings
from src.monitoring import ActionHistory, ActionLoopDetected


ALLOWED_COMMANDS = [
    "ls", "cat", "head", "tail", "grep", "find", "wc",
    "python", "pip", "npm", "node", "pnpm",
    "git", "echo", "pwd", "mkdir", "touch",
    "pytest", "jest", "vitest", "cargo", "go",
]

BLOCKED_COMMANDS = [
    "rm", "rmdir", "mv", "cp",  # Destructive operations need explicit approval
    "sudo", "su", "chmod", "chown",
    "curl", "wget", "ssh", "scp",
    "kill", "pkill", "killall",
]

# Patterns that indicate shell injection attempts
DANGEROUS_PATTERNS = [
    r';\s*\w',           # Command chaining with semicolon
    r'\|\s*\w',          # Piping to another command
    r'&&\s*\w',          # AND chaining
    r'\|\|\s*\w',        # OR chaining
    r'\$\(',             # Command substitution $(...)
    r'`[^`]+`',          # Backtick command substitution
    r'>\s*/',            # Redirect to absolute path
    r'>>\s*/',           # Append to absolute path
    r'\beval\b',         # eval command
    r'\bexec\b',         # exec command
    r'\bsource\b',       # source command
    r'\b__import__\b',   # Python import exploit
    r'\bos\.system\b',   # os.system in python -c
    r'\bsubprocess\b',   # subprocess in python -c
    r'\bos\.popen\b',    # os.popen in python -c
    r'\bos\.exec',       # os.exec* in python -c
    r'\bcommands\.',     # commands module (deprecated but dangerous)
    r'\bpty\.',          # pty module
    r'\bsocket\.',       # socket operations
]


def _check_dangerous_patterns(command: str) -> str | None:
    """Check for shell injection patterns. Returns error message if found, None if safe."""
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return "Error: Command contains potentially dangerous pattern. Shell operators and system calls are not allowed for security."
    return None


def _validate_python_code(args: list[str]) -> str | None:
    """Additional validation for python -c commands."""
    if len(args) < 3:
        return None

    # Check if this is a python -c command
    if args[1] == '-c':
        code = args[2] if len(args) > 2 else ""

        # Check for dangerous imports/calls in the Python code
        dangerous_python = [
            r'\bos\s*\.\s*system',
            r'\bos\s*\.\s*popen',
            r'\bos\s*\.\s*exec',
            r'\bsubprocess',
            r'\b__import__',
            r'\beval\s*\(',
            r'\bexec\s*\(',
            r'\bopen\s*\([^)]*[\'\"]/(?!app/workspace)',  # open() with absolute path outside workspace
            r'\bcompile\s*\(',
            r'\bsocket\b',
            r'\bpty\b',
            r'\brequests\b',
            r'\burllib\b',
            r'\bhttplib\b',
        ]

        for pattern in dangerous_python:
            if re.search(pattern, code, re.IGNORECASE):
                return "Error: Python code contains restricted operation for security. Avoid os.system, subprocess, eval, exec, and network operations."

    return None


class ShellRunTool(BaseTool):
    name: str = "shell_run"
    description: str = "Run a shell command. Args: command (str): the shell command to execute. Only certain safe commands are allowed. Shell operators (|, &&, ;) are blocked."

    def _run(self, command: str) -> str:
        try:
            # Register action and check for loops
            ActionHistory.register_action("shell_run", {"command": command})

            # Check for dangerous shell patterns BEFORE parsing
            danger_check = _check_dangerous_patterns(command)
            if danger_check:
                return danger_check

            # Parse command safely
            try:
                parts = shlex.split(command)
            except ValueError as e:
                return f"Error: Invalid command syntax - {str(e)}"

            if not parts:
                return "Error: Empty command"

            cmd_name = parts[0]

            # Check if command is blocked
            if cmd_name in BLOCKED_COMMANDS:
                return f"Error: Command '{cmd_name}' is not allowed for safety reasons"

            # Check if command is in allowed list
            if cmd_name not in ALLOWED_COMMANDS:
                return f"Error: Command '{cmd_name}' is not in the allowed list. Allowed: {', '.join(ALLOWED_COMMANDS)}"

            # Additional validation for python -c
            if cmd_name == "python":
                python_check = _validate_python_code(parts)
                if python_check:
                    return python_check

            # SECURITY FIX: Use shell=False with parsed arguments
            # This prevents shell injection by not interpreting shell metacharacters
            result = subprocess.run(
                parts,           # Pass as list, not string
                shell=False,     # SECURE: No shell interpretation
                capture_output=True,
                text=True,
                timeout=60,
                cwd=settings.WORKSPACE_PATH,
            )

            output = ""
            if result.stdout:
                output += result.stdout
            if result.stderr:
                output += f"\n[stderr]\n{result.stderr}"

            if result.returncode != 0:
                output += f"\n[exit code: {result.returncode}]"

            return output.strip() or "Command completed with no output"

        except ActionLoopDetected as e:
            return str(e)
        except subprocess.TimeoutExpired:
            return "Error: Command timed out after 60 seconds"
        except FileNotFoundError:
            return "Error: Command not found"
        except Exception as e:
            return f"Error running command: {str(e)}"


shell_run = ShellRunTool()
