"""
Comprehensive tests for AIrchitect CLI plugin framework.

This module tests plugin discovery, loading, execution, configuration,
and lifecycle management for the Python plugin system.
"""

import sys
from pathlib import Path
from typing import Any, List

import pytest

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core import (
    Agent,
    AIProvider,
    PluginAPI,
    PluginContext,
    ProjectMemory,
    create_agent,
    get_ai_provider,
    get_project_memory,
    log_debug,
    log_error,
    log_info,
    log_warning,
)
from tests.fixtures import (
    MockComplexPlugin,
    MockFailingPlugin,
    MockSimplePlugin,
    mock_complex_plugin,  # noqa: F401
    mock_failing_plugin_execute,  # noqa: F401
    mock_failing_plugin_init,  # noqa: F401
    mock_plugin_context,  # noqa: F401
    mock_simple_plugin,  # noqa: F401
    temp_data_dir,  # noqa: F401
)


class TestPluginContext:
    """Test suite for PluginContext class."""

    def test_context_creation(self):
        """Test basic PluginContext creation."""
        context = PluginContext("test_plugin")
        assert context.plugin_name == "test_plugin"
        assert isinstance(context._config, dict)
        assert len(context._config) == 0

    def test_config_get_set(self):
        """Test configuration get and set operations."""
        context = PluginContext("test_plugin")

        # Test setting and getting string
        context.set_config("key1", "value1")
        assert context.get_config("key1") == "value1"

        # Test setting and getting different types
        context.set_config("key2", 42)
        assert context.get_config("key2") == 42

        context.set_config("key3", {"nested": "dict"})
        assert context.get_config("key3") == {"nested": "dict"}

        context.set_config("key4", ["list", "items"])
        assert context.get_config("key4") == ["list", "items"]

    def test_config_default_value(self):
        """Test configuration retrieval with default values."""
        context = PluginContext("test_plugin")

        # Test default value when key doesn't exist
        assert context.get_config("nonexistent") is None
        assert context.get_config("nonexistent", "default") == "default"
        assert context.get_config("nonexistent", 42) == 42

        # Test default value is not used when key exists
        context.set_config("existing", "value")
        assert context.get_config("existing", "default") == "value"

    def test_config_overwrite(self):
        """Test configuration value overwriting."""
        context = PluginContext("test_plugin")

        context.set_config("key", "value1")
        assert context.get_config("key") == "value1"

        context.set_config("key", "value2")
        assert context.get_config("key") == "value2"

    def test_data_directory_path(self):
        """Test data directory path generation."""
        context = PluginContext("test_plugin")
        data_dir = context.get_data_dir()

        assert isinstance(data_dir, Path)
        assert "test_plugin" in str(data_dir)
        assert ".aichitect" in str(data_dir)

    def test_ensure_data_dir(self, temp_data_dir):
        """Test data directory creation."""
        context = PluginContext("test_plugin")
        context._data_dir = temp_data_dir / "test_plugin"

        assert not context._data_dir.exists()

        context.ensure_data_dir()
        assert context._data_dir.exists()
        assert context._data_dir.is_dir()

    def test_write_data_file(self, temp_data_dir):
        """Test writing data files."""
        context = PluginContext("test_plugin")
        context._data_dir = temp_data_dir / "test_plugin"

        content = "test content\nwith multiple lines"
        context.write_data_file("test.txt", content)

        filepath = context._data_dir / "test.txt"
        assert filepath.exists()
        assert filepath.read_text() == content

    def test_read_data_file(self, temp_data_dir):
        """Test reading data files."""
        context = PluginContext("test_plugin")
        context._data_dir = temp_data_dir / "test_plugin"

        # Write file first
        content = "test content"
        context.write_data_file("test.txt", content)

        # Read it back
        read_content = context.read_data_file("test.txt")
        assert read_content == content

    def test_read_nonexistent_file(self, temp_data_dir):
        """Test reading nonexistent data file returns None."""
        context = PluginContext("test_plugin")
        context._data_dir = temp_data_dir / "test_plugin"

        result = context.read_data_file("nonexistent.txt")
        assert result is None

    def test_list_data_files(self, temp_data_dir):
        """Test listing data files."""
        context = PluginContext("test_plugin")
        context._data_dir = temp_data_dir / "test_plugin"

        # Empty directory
        assert context.list_data_files() == []

        # Create multiple files
        context.write_data_file("file1.txt", "content1")
        context.write_data_file("file2.txt", "content2")
        context.write_data_file("file3.json", '{"key": "value"}')

        files = context.list_data_files()
        assert len(files) == 3
        assert "file1.txt" in files
        assert "file2.txt" in files
        assert "file3.json" in files

    def test_list_data_files_ignores_directories(self, temp_data_dir):
        """Test that list_data_files ignores subdirectories."""
        context = PluginContext("test_plugin")
        context._data_dir = temp_data_dir / "test_plugin"

        context.write_data_file("file.txt", "content")
        (context._data_dir / "subdir").mkdir()

        files = context.list_data_files()
        assert len(files) == 1
        assert "file.txt" in files
        assert "subdir" not in files

    def test_multiple_contexts_isolated(self, temp_data_dir):
        """Test that multiple plugin contexts are isolated."""
        context1 = PluginContext("plugin1")
        context1._data_dir = temp_data_dir / "plugin1"

        context2 = PluginContext("plugin2")
        context2._data_dir = temp_data_dir / "plugin2"

        # Set different configs
        context1.set_config("key", "value1")
        context2.set_config("key", "value2")

        assert context1.get_config("key") == "value1"
        assert context2.get_config("key") == "value2"

        # Write different files
        context1.write_data_file("test.txt", "content1")
        context2.write_data_file("test.txt", "content2")

        assert context1.read_data_file("test.txt") == "content1"
        assert context2.read_data_file("test.txt") == "content2"


class TestPluginAPI:
    """Test suite for PluginAPI abstract base class."""

    def test_plugin_api_is_abstract(self):
        """Test that PluginAPI cannot be instantiated directly."""
        context = PluginContext("test")

        # Should raise TypeError because PluginAPI is abstract
        with pytest.raises(TypeError, match="abstract"):
            PluginAPI(context)

    def test_plugin_api_requires_subclass_implementation(self):
        """Test that subclasses must implement abstract methods."""
        context = PluginContext("test")

        # Create incomplete subclass
        class IncompletePlugin(PluginAPI):
            pass

        # Should raise TypeError when trying to instantiate
        with pytest.raises(TypeError):
            IncompletePlugin(context)

    def test_plugin_api_complete_subclass(self):
        """Test that complete subclass can be instantiated."""
        context = PluginContext("test")

        # Create complete subclass
        class CompletePlugin(PluginAPI):
            def get_name(self) -> str:
                return "complete"

            def get_version(self) -> str:
                return "1.0.0"

            def get_commands(self) -> List[str]:
                return ["test"]

            def execute_command(self, command: str, args: List[str]) -> Any:
                return "result"

        # Should be able to instantiate
        plugin = CompletePlugin(context)
        assert plugin.context == context
        assert plugin.get_name() == "complete"
        assert plugin.get_version() == "1.0.0"

    def test_plugin_api_default_methods(self):
        """Test default implementations of non-abstract methods."""
        context = PluginContext("test")

        # Create minimal subclass
        class MinimalPlugin(PluginAPI):
            def get_name(self) -> str:
                return "minimal"

            def get_version(self) -> str:
                return "1.0.0"

            def get_commands(self) -> List[str]:
                return []

            def execute_command(self, command: str, args: List[str]) -> Any:
                raise NotImplementedError(f"Command {command} not implemented")

        plugin = MinimalPlugin(context)

        # Test default initialize returns True
        assert plugin.initialize() is True

        # Test default cleanup doesn't raise
        plugin.cleanup()

        # Test get_info with implemented methods
        info = plugin.get_info()
        assert info["name"] == "minimal"
        assert info["version"] == "1.0.0"
        assert info["commands"] == []


class TestMockPlugins:
    """Test suite for mock plugin implementations."""

    def test_simple_plugin_creation(self, mock_simple_plugin):
        """Test creation of simple mock plugin."""
        assert mock_simple_plugin is not None
        assert mock_simple_plugin.get_name() == "mock_simple"
        assert mock_simple_plugin.get_version() == "1.0.0"

    def test_simple_plugin_commands(self, mock_simple_plugin):
        """Test simple plugin command list."""
        commands = mock_simple_plugin.get_commands()
        assert isinstance(commands, list)
        assert len(commands) == 2
        assert "test" in commands
        assert "echo" in commands

    def test_simple_plugin_execute_test(self, mock_simple_plugin):
        """Test executing test command on simple plugin."""
        result = mock_simple_plugin.execute_command("test", [])
        assert result == "test_result"

    def test_simple_plugin_execute_echo(self, mock_simple_plugin):
        """Test executing echo command on simple plugin."""
        result = mock_simple_plugin.execute_command("echo", ["hello", "world"])
        assert result == "hello world"

        result = mock_simple_plugin.execute_command("echo", [])
        assert result == ""

    def test_simple_plugin_execute_unknown(self, mock_simple_plugin):
        """Test executing unknown command raises error."""
        with pytest.raises(ValueError, match="Unknown command"):
            mock_simple_plugin.execute_command("nonexistent", [])

    def test_simple_plugin_initialize(self, mock_simple_plugin):
        """Test simple plugin initialization."""
        assert not mock_simple_plugin._initialized

        result = mock_simple_plugin.initialize()
        assert result is True
        assert mock_simple_plugin._initialized

    def test_simple_plugin_cleanup(self, mock_simple_plugin):
        """Test simple plugin cleanup."""
        mock_simple_plugin.initialize()
        assert mock_simple_plugin._initialized

        mock_simple_plugin.cleanup()
        assert not mock_simple_plugin._initialized

    def test_simple_plugin_info(self, mock_simple_plugin):
        """Test simple plugin info retrieval."""
        info = mock_simple_plugin.get_info()

        assert info["name"] == "mock_simple"
        assert info["version"] == "1.0.0"
        assert info["commands"] == ["test", "echo"]
        assert "initialized" in info

    def test_complex_plugin_creation(self, mock_complex_plugin):
        """Test creation of complex mock plugin."""
        assert mock_complex_plugin is not None
        assert mock_complex_plugin.get_name() == "mock_complex"
        assert mock_complex_plugin.get_version() == "2.0.0"

    def test_complex_plugin_calculate(self, mock_complex_plugin):
        """Test complex plugin calculate command."""
        result = mock_complex_plugin.execute_command("calculate", ["10", "5"])

        assert isinstance(result, dict)
        assert result["sum"] == 15.0
        assert result["product"] == 50.0

    def test_complex_plugin_calculate_invalid_args(self, mock_complex_plugin):
        """Test calculate command with invalid arguments."""
        with pytest.raises(ValueError, match="requires exactly 2 arguments"):
            mock_complex_plugin.execute_command("calculate", ["10"])

        with pytest.raises(ValueError, match="Invalid number format"):
            mock_complex_plugin.execute_command("calculate", ["abc", "def"])

    def test_complex_plugin_config(self, mock_complex_plugin):
        """Test complex plugin config command."""
        # Set config
        result = mock_complex_plugin.execute_command("config", ["key", "value"])
        assert "Set key = value" in result

        # Get config
        result = mock_complex_plugin.execute_command("config", ["key"])
        assert result == "value"

    def test_complex_plugin_execution_count(self, mock_complex_plugin):
        """Test that complex plugin tracks execution count."""
        assert mock_complex_plugin._execution_count == 0

        mock_complex_plugin.execute_command("calculate", ["1", "2"])
        assert mock_complex_plugin._execution_count == 1

        mock_complex_plugin.execute_command("config", ["key"])
        assert mock_complex_plugin._execution_count == 2

    def test_complex_plugin_fail_command(self, mock_complex_plugin):
        """Test complex plugin fail command."""
        with pytest.raises(RuntimeError, match="Intentional failure"):
            mock_complex_plugin.execute_command("fail", [])

    def test_complex_plugin_with_context(self, mock_plugin_context):
        """Test complex plugin with context."""
        plugin = MockComplexPlugin(context=mock_plugin_context)

        result = plugin.execute_command("store", ["test_key", "test_value"])
        assert "Stored test_key" in result

        result = plugin.execute_command("retrieve", ["test_key"])
        assert result == "test_value"

    def test_failing_plugin_init(self, mock_failing_plugin_init):
        """Test plugin that fails on initialization."""
        with pytest.raises(RuntimeError, match="fail on init"):
            mock_failing_plugin_init.initialize()

    def test_failing_plugin_execute(self, mock_failing_plugin_execute):
        """Test plugin that fails on execution."""
        # Initialize should work
        result = mock_failing_plugin_execute.initialize()
        assert result is True

        # Execute should fail
        with pytest.raises(RuntimeError, match="fail on execute"):
            mock_failing_plugin_execute.execute_command("test", [])


class TestAIProvider:
    """Test suite for AI provider integration."""

    def test_ai_provider_creation(self):
        """Test AI provider creation."""
        provider = AIProvider("test_provider")
        assert provider.name == "test_provider"

    def test_ai_provider_send_prompt(self):
        """Test sending prompts to AI provider."""
        provider = AIProvider("test_provider")
        response = provider.send_prompt("Test prompt")

        assert isinstance(response, str)
        assert "test_provider" in response
        assert "Test prompt" in response

    def test_ai_provider_send_prompt_with_kwargs(self):
        """Test sending prompts with additional parameters."""
        provider = AIProvider("test_provider")
        response = provider.send_prompt("Test prompt", temperature=0.7, max_tokens=100)

        assert isinstance(response, str)
        assert "Test prompt" in response

    def test_ai_provider_get_models(self):
        """Test retrieving available models."""
        provider = AIProvider("test_provider")
        models = provider.get_models()

        assert isinstance(models, list)
        assert len(models) > 0

    def test_ai_provider_get_default_model(self):
        """Test retrieving default model."""
        provider = AIProvider("test_provider")
        default_model = provider.get_default_model()

        assert isinstance(default_model, str)
        assert len(default_model) > 0

    def test_get_ai_provider_function(self):
        """Test get_ai_provider factory function."""
        provider = get_ai_provider("custom_provider")

        assert isinstance(provider, AIProvider)
        assert provider.name == "custom_provider"

    def test_get_ai_provider_default(self):
        """Test get_ai_provider with default name."""
        provider = get_ai_provider()

        assert isinstance(provider, AIProvider)
        assert provider.name == "default"


class TestProjectMemory:
    """Test suite for project memory integration."""

    def test_project_memory_store(self, capsys):
        """Test storing data in project memory."""
        memory = ProjectMemory()
        result = memory.store("test_key", "test_value")

        assert result is True
        captured = capsys.readouterr()
        assert "Storing test_key" in captured.out

    def test_project_memory_retrieve(self, capsys):
        """Test retrieving data from project memory."""
        memory = ProjectMemory()
        result = memory.retrieve("test_key")

        assert result is not None
        assert "test_key" in result
        captured = capsys.readouterr()
        assert "Retrieving test_key" in captured.out

    def test_project_memory_search(self, capsys):
        """Test searching project memory."""
        memory = ProjectMemory()
        results = memory.search("test query")

        assert isinstance(results, list)
        assert len(results) > 0
        captured = capsys.readouterr()
        assert "Searching for 'test query'" in captured.out

    def test_get_project_memory_function(self):
        """Test get_project_memory factory function."""
        memory = get_project_memory()

        assert isinstance(memory, ProjectMemory)


class TestAgent:
    """Test suite for agent integration."""

    def test_agent_creation(self):
        """Test agent creation."""
        agent = Agent("test_agent", ["capability1", "capability2"])

        assert agent.name == "test_agent"
        assert agent.capabilities == ["capability1", "capability2"]

    def test_agent_execute_task(self):
        """Test agent task execution."""
        agent = Agent("test_agent", ["capability1"])
        result = agent.execute_task("Test task")

        assert isinstance(result, str)
        assert "test_agent" in result
        assert "Test task" in result

    def test_agent_get_info(self):
        """Test agent info retrieval."""
        capabilities = ["read", "write", "analyze"]
        agent = Agent("test_agent", capabilities)
        info = agent.get_info()

        assert info["name"] == "test_agent"
        assert info["capabilities"] == capabilities

    def test_create_agent_function(self):
        """Test create_agent factory function."""
        agent = create_agent("new_agent", ["cap1", "cap2"])

        assert isinstance(agent, Agent)
        assert agent.name == "new_agent"
        assert agent.capabilities == ["cap1", "cap2"]


class TestLoggingFunctions:
    """Test suite for logging functions."""

    def test_log_info(self, capsys):
        """Test info logging."""
        log_info("Test info message")
        captured = capsys.readouterr()

        assert "[INFO]" in captured.out
        assert "Test info message" in captured.out

    def test_log_warning(self, capsys):
        """Test warning logging."""
        log_warning("Test warning message")
        captured = capsys.readouterr()

        assert "[WARN]" in captured.out
        assert "Test warning message" in captured.out

    def test_log_error(self, capsys):
        """Test error logging."""
        log_error("Test error message")
        captured = capsys.readouterr()

        assert "[ERROR]" in captured.out
        assert "Test error message" in captured.out

    def test_log_debug(self, capsys):
        """Test debug logging."""
        log_debug("Test debug message")
        captured = capsys.readouterr()

        assert "[DEBUG]" in captured.out
        assert "Test debug message" in captured.out


class TestPluginLifecycle:
    """Test suite for plugin lifecycle management."""

    def test_plugin_full_lifecycle(self, mock_simple_plugin):
        """Test complete plugin lifecycle from init to cleanup."""
        # Initial state
        assert not mock_simple_plugin._initialized

        # Initialize
        result = mock_simple_plugin.initialize()
        assert result is True
        assert mock_simple_plugin._initialized

        # Execute commands
        result = mock_simple_plugin.execute_command("test", [])
        assert result == "test_result"

        # Cleanup
        mock_simple_plugin.cleanup()
        assert not mock_simple_plugin._initialized

    def test_plugin_multiple_initializations(self, mock_simple_plugin):
        """Test plugin behavior with multiple initializations."""
        mock_simple_plugin.initialize()
        assert mock_simple_plugin._initialized

        # Second initialization should still work
        result = mock_simple_plugin.initialize()
        assert result is True
        assert mock_simple_plugin._initialized

    def test_plugin_execute_without_initialize(self, mock_simple_plugin):
        """Test executing commands without initialization."""
        # Should work even without explicit initialization
        result = mock_simple_plugin.execute_command("test", [])
        assert result == "test_result"

    def test_plugin_cleanup_multiple_times(self, mock_simple_plugin):
        """Test cleaning up plugin multiple times."""
        mock_simple_plugin.initialize()
        mock_simple_plugin.cleanup()
        assert not mock_simple_plugin._initialized

        # Second cleanup should not cause issues
        mock_simple_plugin.cleanup()
        assert not mock_simple_plugin._initialized


class TestPluginErrorHandling:
    """Test suite for plugin error handling."""

    def test_invalid_command_raises_error(self, mock_simple_plugin):
        """Test that invalid commands raise appropriate errors."""
        with pytest.raises(ValueError, match="Unknown command"):
            mock_simple_plugin.execute_command("invalid_command", [])

    def test_invalid_arguments_raise_error(self, mock_complex_plugin):
        """Test that invalid arguments raise appropriate errors."""
        with pytest.raises(ValueError):
            mock_complex_plugin.execute_command("calculate", ["not_a_number", "123"])

    def test_missing_arguments_raise_error(self, mock_complex_plugin):
        """Test that missing arguments raise appropriate errors."""
        with pytest.raises(ValueError, match="requires exactly 2 arguments"):
            mock_complex_plugin.execute_command("calculate", [])

    def test_plugin_initialization_failure(self):
        """Test handling of plugin initialization failures."""
        plugin = MockFailingPlugin(fail_on_init=True)

        with pytest.raises(RuntimeError, match="fail on init"):
            plugin.initialize()

    def test_plugin_execution_failure(self):
        """Test handling of plugin execution failures."""
        plugin = MockFailingPlugin(fail_on_execute=True)
        plugin.initialize()

        with pytest.raises(RuntimeError, match="fail on execute"):
            plugin.execute_command("test", [])


class TestPluginIntegration:
    """Test suite for plugin integration scenarios."""

    def test_plugin_with_context_integration(self, mock_plugin_context):
        """Test plugin integration with context."""
        plugin = MockComplexPlugin(context=mock_plugin_context)

        # Initialize plugin
        assert plugin.initialize()

        # Store data via context
        plugin.execute_command("store", ["key1", "value1"])
        result = plugin.execute_command("retrieve", ["key1"])
        assert result == "value1"

    def test_plugin_data_persistence(self, mock_plugin_context):
        """Test plugin data persistence through context."""
        MockSimplePlugin(context=mock_plugin_context)

        # Write data
        mock_plugin_context.write_data_file("test.txt", "test content")

        # Read data back
        content = mock_plugin_context.read_data_file("test.txt")
        assert content == "test content"

    def test_multiple_plugins_with_shared_context(self, mock_plugin_context):
        """Test multiple plugins sharing a context."""
        plugin1 = MockSimplePlugin(context=mock_plugin_context)
        plugin2 = MockComplexPlugin(context=mock_plugin_context)

        # Both plugins should access the same context
        mock_plugin_context.set_config("shared_key", "shared_value")

        assert plugin1.context.get_config("shared_key") == "shared_value"
        assert plugin2.context.get_config("shared_key") == "shared_value"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
