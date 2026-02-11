import os
from pathlib import Path
from crewai_tools import BaseTool
from src.config import settings
from src.monitoring import ActionHistory, ActionLoopDetected


class FileReadTool(BaseTool):
    name: str = "file_read"
    description: str = "Read the contents of a file. Args: path (str): file path to read"

    def _run(self, path: str) -> str:
        try:
            # Register action and check for loops
            ActionHistory.register_action("file_read", {"path": path})

            full_path = Path(settings.WORKSPACE_PATH) / path
            if not full_path.exists():
                return f"Error: File not found: {path}"

            # Security check - ensure we're within workspace
            if not str(full_path.resolve()).startswith(str(Path(settings.WORKSPACE_PATH).resolve())):
                return "Error: Access denied - path outside workspace"

            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
            return content
        except ActionLoopDetected as e:
            return str(e)
        except Exception as e:
            return f"Error reading file: {str(e)}"


class FileWriteTool(BaseTool):
    name: str = "file_write"
    description: str = "Write content to a file. Args: path (str): file path, content (str): file content"

    def _run(self, path: str, content: str) -> str:
        try:
            if not path or content is None:
                return "Error: Both 'path' and 'content' are required"

            # Validate directory structure - test files must go in tests/
            if 'test_' in path and 'tasks/' in path:
                return "Error: Test files must be in workspace/tests/, not workspace/tasks/. Please use the correct path (e.g., tests/test_module.py instead of tasks/test_module.py)."

            # Register action and check for loops (truncate content for comparison)
            ActionHistory.register_action("file_write", {
                "path": path,
                "content_length": len(content),
                "content_preview": content[:200] if len(content) > 200 else content
            })

            full_path = Path(settings.WORKSPACE_PATH) / path

            # Security check
            if not str(full_path.resolve()).startswith(str(Path(settings.WORKSPACE_PATH).resolve())):
                return "Error: Access denied - path outside workspace"

            # Create directories if needed
            full_path.parent.mkdir(parents=True, exist_ok=True)

            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

            return f"Successfully wrote to {path}"
        except ActionLoopDetected as e:
            return str(e)
        except Exception as e:
            return f"Error writing file: {str(e)}"


class FileEditTool(BaseTool):
    name: str = "file_edit"
    description: str = "Edit a file by replacing text. Args: path (str): file path, old_text (str): text to replace, new_text (str): replacement text"

    def _run(self, path: str, old_text: str, new_text: str) -> str:
        try:
            if not all([path, old_text is not None, new_text is not None]):
                return "Error: All arguments (path, old_text, new_text) are required"

            # Register action and check for loops
            ActionHistory.register_action("file_edit", {
                "path": path,
                "old_text_length": len(old_text),
                "new_text_length": len(new_text),
                "old_text_preview": old_text[:100] if len(old_text) > 100 else old_text
            })

            full_path = Path(settings.WORKSPACE_PATH) / path

            # Security check
            if not str(full_path.resolve()).startswith(str(Path(settings.WORKSPACE_PATH).resolve())):
                return "Error: Access denied - path outside workspace"

            if not full_path.exists():
                return f"Error: File not found: {path}"

            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()

            if old_text not in content:
                return f"Error: Text to replace not found in {path}"

            new_content = content.replace(old_text, new_text, 1)

            with open(full_path, "w", encoding="utf-8") as f:
                f.write(new_content)

            return f"Successfully edited {path}"
        except ActionLoopDetected as e:
            return str(e)
        except Exception as e:
            return f"Error editing file: {str(e)}"


class FileListTool(BaseTool):
    name: str = "file_list"
    description: str = "List files in a directory. Args: path (str, optional): directory path (empty or '.' for workspace root)"

    def _run(self, path: str = "") -> str:
        try:
            # Register action and check for loops
            ActionHistory.register_action("file_list", {"path": path or "/"})

            # Normalize empty string or '.' to workspace root
            dir_path = path if path and path != "." else ""
            full_path = Path(settings.WORKSPACE_PATH) / dir_path

            # Security check
            if not str(full_path.resolve()).startswith(str(Path(settings.WORKSPACE_PATH).resolve())):
                return "Error: Access denied - path outside workspace"

            if not full_path.exists():
                return f"Error: Directory not found: {dir_path or '/'}"

            if not full_path.is_dir():
                return f"Error: Not a directory: {dir_path}"

            items = []
            for item in sorted(full_path.iterdir()):
                prefix = "[DIR]" if item.is_dir() else "[FILE]"
                items.append(f"{prefix} {item.name}")

            return "\n".join(items) if items else "Directory is empty"
        except ActionLoopDetected as e:
            return str(e)
        except Exception as e:
            return f"Error listing directory: {str(e)}"


# Export tool instances
file_read = FileReadTool()
file_write = FileWriteTool()
file_edit = FileEditTool()
file_list = FileListTool()
