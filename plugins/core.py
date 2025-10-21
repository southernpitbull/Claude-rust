"""
Core Plugin API for AIrchitect CLI

This module provides the core plugin API that Python plugins
can use to interact with the AIrchitect CLI system.
"""

import json
import os
from typing import Any, Dict, List, Optional, Union
from pathlib import Path
from abc import ABC, abstractmethod


class PluginContext:
    """
    Context object that provides plugins with access to
    AIrchitect CLI system resources.
    """
    
    def __init__(self, plugin_name: str):
        self.plugin_name = plugin_name
        self._config: Dict[str, Any] = {}
        self._data_dir = Path.home() / ".aichitect" / "plugins" / plugin_name
    
    def get_config(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value.
        
        Args:
            key: Configuration key
            default: Default value if key not found
            
        Returns:
            Configuration value
        """
        return self._config.get(key, default)
    
    def set_config(self, key: str, value: Any) -> None:
        """
        Set a configuration value.
        
        Args:
            key: Configuration key
            value: Configuration value
        """
        self._config[key] = value
    
    def get_data_dir(self) -> Path:
        """
        Get the plugin's data directory.
        
        Returns:
            Path to the data directory
        """
        return self._data_dir
    
    def ensure_data_dir(self) -> None:
        """
        Ensure the plugin's data directory exists.
        """
        self._data_dir.mkdir(parents=True, exist_ok=True)
    
    def read_data_file(self, filename: str) -> Optional[str]:
        """
        Read a data file from the plugin's data directory.
        
        Args:
            filename: Name of the file to read
            
        Returns:
            File contents or None if file doesn't exist
        """
        filepath = self._data_dir / filename
        if filepath.exists():
            return filepath.read_text()
        return None
    
    def write_data_file(self, filename: str, content: str) -> None:
        """
        Write a data file to the plugin's data directory.
        
        Args:
            filename: Name of the file to write
            content: File content
        """
        self.ensure_data_dir()
        filepath = self._data_dir / filename
        filepath.write_text(content)
    
    def list_data_files(self) -> List[str]:
        """
        List all files in the plugin's data directory.
        
        Returns:
            List of filenames
        """
        if self._data_dir.exists():
            return [f.name for f in self._data_dir.iterdir() if f.is_file()]
        return []


class PluginAPI(ABC):
    """
    Abstract base class for plugin APIs.
    
    Plugins can extend this class to provide custom functionality.
    """
    
    def __init__(self, context: PluginContext):
        self.context = context
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Get the plugin name.
        
        Returns:
            Plugin name
        """
        pass
    
    @abstractmethod
    def get_version(self) -> str:
        """
        Get the plugin version.
        
        Returns:
            Plugin version
        """
        pass
    
    @abstractmethod
    def get_commands(self) -> List[str]:
        """
        Get a list of commands provided by this plugin.
        
        Returns:
            List of command names
        """
        pass
    
    @abstractmethod
    def execute_command(self, command: str, args: List[str]) -> Any:
        """
        Execute a plugin command.
        
        Args:
            command: Command name to execute
            args: Command arguments
            
        Returns:
            Command result
        """
        pass
    
    def initialize(self) -> bool:
        """
        Initialize the plugin.
        
        Returns:
            True if initialization was successful
        """
        return True
    
    def cleanup(self) -> None:
        """
        Clean up plugin resources.
        """
        pass
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get plugin information.
        
        Returns:
            Plugin information
        """
        return {
            "name": self.get_name(),
            "version": self.get_version(),
            "commands": self.get_commands()
        }


class AIProvider:
    """
    AI provider interface for plugins to interact with
    various AI services.
    """
    
    def __init__(self, name: str):
        self.name = name
    
    def send_prompt(self, prompt: str, **kwargs) -> str:
        """
        Send a prompt to the AI provider.
        
        Args:
            prompt: Prompt to send
            **kwargs: Additional parameters
            
        Returns:
            AI response
        """
        # In a real implementation, this would call the Rust AI engine
        # through the Python bindings
        return f"[{self.name}] Response to: {prompt}"
    
    def get_models(self) -> List[str]:
        """
        Get available models for this provider.
        
        Returns:
            List of model names
        """
        # In a real implementation, this would query the provider
        return ["default-model"]
    
    def get_default_model(self) -> str:
        """
        Get the default model for this provider.
        
        Returns:
            Default model name
        """
        models = self.get_models()
        return models[0] if models else "default-model"


class ProjectMemory:
    """
    Project memory interface for plugins to store and
    retrieve contextual information.
    """
    
    def store(self, key: str, value: Any) -> bool:
        """
        Store information in project memory.
        
        Args:
            key: Memory key
            value: Value to store
            
        Returns:
            True if storage was successful
        """
        # In a real implementation, this would call the Rust memory system
        print(f"Storing {key} -> {value} in project memory")
        return True
    
    def retrieve(self, key: str) -> Optional[Any]:
        """
        Retrieve information from project memory.
        
        Args:
            key: Memory key
            
        Returns:
            Retrieved value or None if not found
        """
        # In a real implementation, this would call the Rust memory system
        print(f"Retrieving {key} from project memory")
        return f"Value for {key}"
    
    def search(self, query: str) -> List[str]:
        """
        Search project memory.
        
        Args:
            query: Search query
            
        Returns:
            List of search results
        """
        # In a real implementation, this would call the Rust memory system
        print(f"Searching for '{query}' in project memory")
        return [f"Result 1 for {query}", f"Result 2 for {query}"]


class Agent:
    """
    Agent interface for plugins to create and interact with
    intelligent agents.
    """
    
    def __init__(self, name: str, capabilities: List[str]):
        self.name = name
        self.capabilities = capabilities
    
    def execute_task(self, task: str) -> str:
        """
        Execute a task with this agent.
        
        Args:
            task: Task to execute
            
        Returns:
            Task result
        """
        # In a real implementation, this would call the Rust agent framework
        return f"Agent {self.name} executed task: {task}"
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get agent information.
        
        Returns:
            Agent information
        """
        return {
            "name": self.name,
            "capabilities": self.capabilities
        }


# Global instances that plugins can access
ai_provider = AIProvider("default")
project_memory = ProjectMemory()


def get_ai_provider(name: str = "default") -> AIProvider:
    """
    Get an AI provider instance.
    
    Args:
        name: Provider name
        
    Returns:
        AI provider instance
    """
    # In a real implementation, this would return the appropriate provider
    return AIProvider(name)


def get_project_memory() -> ProjectMemory:
    """
    Get the project memory instance.
    
    Returns:
        Project memory instance
    """
    return project_memory


def create_agent(name: str, capabilities: List[str]) -> Agent:
    """
    Create a new agent.
    
    Args:
        name: Agent name
        capabilities: Agent capabilities
        
    Returns:
        New agent instance
    """
    return Agent(name, capabilities)


# Convenience functions for plugins
def log_info(message: str) -> None:
    """
    Log an informational message.
    
    Args:
        message: Message to log
    """
    print(f"[INFO] {message}")


def log_warning(message: str) -> None:
    """
    Log a warning message.
    
    Args:
        message: Message to log
    """
    print(f"[WARN] {message}")


def log_error(message: str) -> None:
    """
    Log an error message.
    
    Args:
        message: Message to log
    """
    print(f"[ERROR] {message}")


def log_debug(message: str) -> None:
    """
    Log a debug message.
    
    Args:
        message: Message to log
    """
    print(f"[DEBUG] {message}")