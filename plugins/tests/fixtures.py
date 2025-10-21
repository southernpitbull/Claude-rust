"""
Test fixtures for AIrchitect CLI plugin framework tests.

This module provides reusable fixtures, mock plugins, and test data
for comprehensive plugin testing.
"""

import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


# Mock Plugin Implementations
class MockSimplePlugin:
    """
    Simple mock plugin for basic testing.

    This plugin implements the minimal required interface for testing
    plugin discovery and loading functionality.
    """

    def __init__(self, context=None):
        self.context = context
        self._initialized = False

    def get_name(self) -> str:
        """Get plugin name."""
        return "mock_simple"

    def get_version(self) -> str:
        """Get plugin version."""
        return "1.0.0"

    def get_description(self) -> str:
        """Get plugin description."""
        return "A simple mock plugin for testing"

    def get_commands(self) -> List[str]:
        """Get list of commands."""
        return ["test", "echo"]

    def execute_command(self, command: str, args: List[str]) -> Any:
        """
        Execute a plugin command.

        Args:
            command: Command name to execute
            args: Command arguments

        Returns:
            Command result

        Raises:
            ValueError: If command is not recognized
        """
        if command == "test":
            return "test_result"
        elif command == "echo":
            return " ".join(args) if args else ""
        else:
            raise ValueError(f"Unknown command: {command}")

    def initialize(self) -> bool:
        """
        Initialize the plugin.

        Returns:
            True if initialization successful
        """
        self._initialized = True
        return True

    def cleanup(self) -> None:
        """Clean up plugin resources."""
        self._initialized = False

    def get_info(self) -> Dict[str, Any]:
        """Get plugin information."""
        return {
            "name": self.get_name(),
            "version": self.get_version(),
            "description": self.get_description(),
            "commands": self.get_commands(),
            "initialized": self._initialized,
        }


class MockComplexPlugin:
    """
    Complex mock plugin for advanced testing scenarios.

    This plugin implements additional features including configuration,
    data persistence, and error handling for comprehensive testing.
    """

    def __init__(self, context=None):
        self.context = context
        self._initialized = False
        self._execution_count = 0
        self._config: Dict[str, Any] = {}

    def get_name(self) -> str:
        """Get plugin name."""
        return "mock_complex"

    def get_version(self) -> str:
        """Get plugin version."""
        return "2.0.0"

    def get_description(self) -> str:
        """Get plugin description."""
        return "A complex mock plugin for advanced testing"

    def get_commands(self) -> List[str]:
        """Get list of commands."""
        return ["calculate", "config", "store", "retrieve", "fail"]

    def execute_command(self, command: str, args: List[str]) -> Any:
        """
        Execute a plugin command.

        Args:
            command: Command name to execute
            args: Command arguments

        Returns:
            Command result

        Raises:
            ValueError: If command arguments are invalid
            RuntimeError: If command execution fails
        """
        self._execution_count += 1

        if command == "calculate":
            if len(args) != 2:
                raise ValueError("Calculate requires exactly 2 arguments")
            try:
                a, b = float(args[0]), float(args[1])
                return {"sum": a + b, "product": a * b}
            except ValueError as e:
                raise ValueError(f"Invalid number format: {e}")

        elif command == "config":
            if len(args) == 1:
                return self._config.get(args[0])
            elif len(args) == 2:
                self._config[args[0]] = args[1]
                return f"Set {args[0]} = {args[1]}"
            else:
                raise ValueError("Config requires 1 or 2 arguments")

        elif command == "store":
            if self.context and len(args) == 2:
                self.context.set_config(args[0], args[1])
                return f"Stored {args[0]}"
            else:
                raise ValueError("Store requires context and 2 arguments")

        elif command == "retrieve":
            if self.context and len(args) == 1:
                return self.context.get_config(args[0])
            else:
                raise ValueError("Retrieve requires context and 1 argument")

        elif command == "fail":
            raise RuntimeError("Intentional failure for testing")

        else:
            raise ValueError(f"Unknown command: {command}")

    def initialize(self) -> bool:
        """
        Initialize the plugin.

        Returns:
            True if initialization successful
        """
        if self.context:
            self.context.set_config("initialized", True)
        self._initialized = True
        return True

    def cleanup(self) -> None:
        """Clean up plugin resources."""
        self._initialized = False
        self._execution_count = 0
        self._config.clear()

    def get_info(self) -> Dict[str, Any]:
        """Get plugin information."""
        return {
            "name": self.get_name(),
            "version": self.get_version(),
            "description": self.get_description(),
            "commands": self.get_commands(),
            "initialized": self._initialized,
            "execution_count": self._execution_count,
        }


class MockFailingPlugin:
    """
    Mock plugin that fails during initialization or execution.

    Used for testing error handling and recovery mechanisms.
    """

    def __init__(self, context=None, fail_on_init=False, fail_on_execute=False):
        self.context = context
        self.fail_on_init = fail_on_init
        self.fail_on_execute = fail_on_execute

    def get_name(self) -> str:
        """Get plugin name."""
        return "mock_failing"

    def get_version(self) -> str:
        """Get plugin version."""
        return "0.1.0"

    def get_commands(self) -> List[str]:
        """Get list of commands."""
        return ["test"]

    def execute_command(self, command: str, args: List[str]) -> Any:
        """
        Execute a plugin command.

        Args:
            command: Command name
            args: Command arguments

        Returns:
            Command result

        Raises:
            RuntimeError: If plugin is configured to fail on execute
        """
        if self.fail_on_execute:
            raise RuntimeError("Plugin configured to fail on execute")
        return "success"

    def initialize(self) -> bool:
        """
        Initialize the plugin.

        Returns:
            False if plugin is configured to fail on init

        Raises:
            RuntimeError: If plugin is configured to fail on init
        """
        if self.fail_on_init:
            raise RuntimeError("Plugin configured to fail on init")
        return True

    def cleanup(self) -> None:
        """Clean up plugin resources."""
        pass

    def get_info(self) -> Dict[str, Any]:
        """Get plugin information."""
        return {
            "name": self.get_name(),
            "version": self.get_version(),
            "commands": self.get_commands(),
        }


# Pytest Fixtures
@pytest.fixture
def temp_plugin_dir():
    """
    Create a temporary directory for plugin testing.

    Yields:
        Path: Temporary directory path

    Cleanup:
        Removes the temporary directory after test completion
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_data_dir():
    """
    Create a temporary data directory for plugin data storage.

    Yields:
        Path: Temporary data directory path

    Cleanup:
        Removes the temporary directory after test completion
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_simple_plugin():
    """
    Create a simple mock plugin instance.

    Returns:
        MockSimplePlugin: Simple mock plugin for basic testing
    """
    return MockSimplePlugin()


@pytest.fixture
def mock_complex_plugin():
    """
    Create a complex mock plugin instance.

    Returns:
        MockComplexPlugin: Complex mock plugin for advanced testing
    """
    return MockComplexPlugin()


@pytest.fixture
def mock_failing_plugin_init():
    """
    Create a mock plugin that fails on initialization.

    Returns:
        MockFailingPlugin: Plugin configured to fail during init
    """
    return MockFailingPlugin(fail_on_init=True)


@pytest.fixture
def mock_failing_plugin_execute():
    """
    Create a mock plugin that fails on command execution.

    Returns:
        MockFailingPlugin: Plugin configured to fail during execution
    """
    return MockFailingPlugin(fail_on_execute=True)


@pytest.fixture
def sample_plugin_config():
    """
    Provide sample plugin configuration data.

    Returns:
        Dict[str, Any]: Sample configuration data
    """
    return {
        "plugin_name": "test_plugin",
        "enabled": True,
        "api_key": "test_api_key_12345",
        "timeout": 30,
        "max_retries": 3,
        "features": {
            "caching": True,
            "logging": True,
            "metrics": False,
        },
        "endpoints": ["https://api.example.com/v1", "https://api.example.com/v2"],
    }


@pytest.fixture
def sample_command_args():
    """
    Provide sample command arguments for testing.

    Returns:
        Dict[str, List[str]]: Sample command arguments
    """
    return {
        "simple": [],
        "with_single_arg": ["value"],
        "with_multiple_args": ["arg1", "arg2", "arg3"],
        "numeric_args": ["10", "20", "30"],
        "mixed_args": ["text", "123", "true", "3.14"],
    }


@pytest.fixture
def sample_plugin_metadata():
    """
    Provide sample plugin metadata.

    Returns:
        Dict[str, Any]: Sample plugin metadata
    """
    return {
        "name": "test_plugin",
        "version": "1.2.3",
        "description": "Test plugin for AIrchitect CLI",
        "author": "Test Author",
        "license": "MIT",
        "homepage": "https://github.com/test/test-plugin",
        "tags": ["testing", "example", "mock"],
        "dependencies": ["requests>=2.0.0", "pydantic>=2.0.0"],
    }


@pytest.fixture
def mock_plugin_context(temp_data_dir):
    """
    Create a mock PluginContext for testing.

    Args:
        temp_data_dir: Temporary data directory fixture

    Returns:
        MockPluginContext: Mock context with temporary storage
    """

    class MockPluginContext:
        """Mock implementation of PluginContext."""

        def __init__(self, plugin_name: str, data_dir: Path):
            self.plugin_name = plugin_name
            self._config: Dict[str, Any] = {}
            self._data_dir = data_dir / plugin_name

        def get_config(self, key: str, default: Any = None) -> Any:
            """Get configuration value."""
            return self._config.get(key, default)

        def set_config(self, key: str, value: Any) -> None:
            """Set configuration value."""
            self._config[key] = value

        def get_data_dir(self) -> Path:
            """Get plugin data directory."""
            return self._data_dir

        def ensure_data_dir(self) -> None:
            """Ensure data directory exists."""
            self._data_dir.mkdir(parents=True, exist_ok=True)

        def write_data_file(self, filename: str, content: str) -> None:
            """Write data file."""
            self.ensure_data_dir()
            filepath = self._data_dir / filename
            filepath.write_text(content, encoding="utf-8")

        def read_data_file(self, filename: str) -> Optional[str]:
            """Read data file."""
            filepath = self._data_dir / filename
            if filepath.exists():
                return filepath.read_text(encoding="utf-8")
            return None

        def list_data_files(self) -> List[str]:
            """List data files."""
            if self._data_dir.exists():
                return [f.name for f in self._data_dir.iterdir() if f.is_file()]
            return []

    return MockPluginContext("test_plugin", temp_data_dir)


# Test Data Constants
VALID_PLUGIN_NAMES = [
    "simple_plugin",
    "complex-plugin",
    "plugin123",
    "my_awesome_plugin",
]

INVALID_PLUGIN_NAMES = [
    "",
    "plugin with spaces",
    "plugin/with/slashes",
    "plugin\\with\\backslashes",
    "../malicious",
    "plugin@special#chars",
]

SAMPLE_PLUGIN_CODE = '''
"""Sample plugin for testing."""

class SamplePlugin:
    """Sample plugin implementation."""

    def get_name(self) -> str:
        return "sample"

    def get_version(self) -> str:
        return "1.0.0"

    def get_commands(self):
        return ["test"]

    def execute_command(self, command, args):
        return "test_result"

    def initialize(self) -> bool:
        return True

    def cleanup(self) -> None:
        pass

    def get_info(self):
        return {
            "name": self.get_name(),
            "version": self.get_version(),
            "commands": self.get_commands(),
        }
'''

MALICIOUS_PLUGIN_CODE = '''
"""Malicious plugin for security testing."""
import os
import sys

class MaliciousPlugin:
    """Plugin that attempts unsafe operations."""

    def get_name(self) -> str:
        return "malicious"

    def get_version(self) -> str:
        return "1.0.0"

    def get_commands(self):
        return ["unsafe"]

    def execute_command(self, command, args):
        # Attempt to read sensitive files
        try:
            with open("/etc/passwd", "r") as f:
                return f.read()
        except:
            pass

        # Attempt to execute system commands
        os.system("whoami")

        return "malicious_result"

    def initialize(self) -> bool:
        return True

    def cleanup(self) -> None:
        pass
'''


def create_plugin_file(plugin_dir: Path, plugin_name: str, plugin_code: str) -> Path:
    """
    Create a plugin file for testing.

    Args:
        plugin_dir: Directory to create plugin in
        plugin_name: Name of the plugin
        plugin_code: Python code for the plugin

    Returns:
        Path to the created plugin file
    """
    plugin_dir.mkdir(parents=True, exist_ok=True)
    plugin_file = plugin_dir / f"{plugin_name}.py"
    plugin_file.write_text(plugin_code, encoding="utf-8")
    return plugin_file


def create_plugin_package(
    plugin_dir: Path, package_name: str, has_init: bool = True
) -> Path:
    """
    Create a plugin package directory for testing.

    Args:
        plugin_dir: Directory to create package in
        package_name: Name of the package
        has_init: Whether to create __init__.py

    Returns:
        Path to the created package directory
    """
    package_path = plugin_dir / package_name
    package_path.mkdir(parents=True, exist_ok=True)

    if has_init:
        init_file = package_path / "__init__.py"
        init_file.write_text('"""Plugin package."""\n', encoding="utf-8")

    return package_path
