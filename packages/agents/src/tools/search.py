import os
import re
from pathlib import Path
from crewai_tools import BaseTool
from src.config import settings
from src.monitoring import ActionHistory, ActionLoopDetected


class CodeSearchTool(BaseTool):
    name: str = "code_search"
    description: str = "Search for text in files. Args: pattern (str), file_pattern (str, optional)"

    def _run(self, pattern: str, file_pattern: str = "*") -> str:
        try:
            # Register action and check for loops
            ActionHistory.register_action("code_search", {
                "pattern": pattern,
                "file_pattern": file_pattern
            })

            if not pattern:
                return "Error: 'pattern' is required"

            workspace = Path(settings.WORKSPACE_PATH)
            results = []

            # Common code file extensions
            code_extensions = {
                ".py", ".js", ".ts", ".tsx", ".jsx",
                ".java", ".go", ".rs", ".c", ".cpp", ".h",
                ".rb", ".php", ".swift", ".kt",
                ".json", ".yaml", ".yml", ".toml",
                ".md", ".txt", ".sql",
            }

            try:
                regex = re.compile(pattern, re.IGNORECASE)
            except re.error:
                # If not valid regex, search as literal string
                regex = re.compile(re.escape(pattern), re.IGNORECASE)

            for root, dirs, files in os.walk(workspace):
                # Skip common non-code directories
                dirs[:] = [d for d in dirs if d not in {
                    "node_modules", ".git", "__pycache__", "venv",
                    ".venv", "dist", "build", ".next", "target"
                }]

                for filename in files:
                    # Check file pattern
                    if file_pattern != "*":
                        from fnmatch import fnmatch
                        if not fnmatch(filename, file_pattern):
                            continue
                    else:
                        # Only search code files
                        ext = Path(filename).suffix
                        if ext not in code_extensions:
                            continue

                    file_path = Path(root) / filename
                    relative_path = file_path.relative_to(workspace)

                    try:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            for line_num, line in enumerate(f, 1):
                                if regex.search(line):
                                    results.append(
                                        f"{relative_path}:{line_num}: {line.strip()}"
                                    )
                                    if len(results) >= 50:  # Limit results
                                        results.append("... (results truncated)")
                                        return "\n".join(results)
                    except Exception:
                        continue

            return "\n".join(results) if results else "No matches found"

        except ActionLoopDetected as e:
            return str(e)
        except Exception as e:
            return f"Error searching: {str(e)}"


class FindFileTool(BaseTool):
    name: str = "find_file"
    description: str = "Find files by name. Args: pattern (str) e.g. '*.py'"

    def _run(self, pattern: str) -> str:
        try:
            # Register action and check for loops
            ActionHistory.register_action("find_file", {"pattern": pattern})

            from fnmatch import fnmatch

            workspace = Path(settings.WORKSPACE_PATH)
            results = []

            for root, dirs, files in os.walk(workspace):
                # Skip non-code directories
                dirs[:] = [d for d in dirs if d not in {
                    "node_modules", ".git", "__pycache__", "venv",
                    ".venv", "dist", "build", ".next", "target"
                }]

                for filename in files:
                    if fnmatch(filename, pattern):
                        file_path = Path(root) / filename
                        relative_path = file_path.relative_to(workspace)
                        results.append(str(relative_path))

                        if len(results) >= 100:
                            results.append("... (results truncated)")
                            return "\n".join(results)

            return "\n".join(results) if results else f"No files matching '{pattern}' found"

        except ActionLoopDetected as e:
            return str(e)
        except Exception as e:
            return f"Error finding files: {str(e)}"


code_search = CodeSearchTool()
find_file = FindFileTool()
